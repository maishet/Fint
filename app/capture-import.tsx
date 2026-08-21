import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock, History, Plus, Trash2 } from '@tamagui/lucide-icons-2'
import * as ImagePicker from 'expo-image-picker'
import { Stack, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Paragraph, XStack, YStack } from 'tamagui'
import { formatMoney } from '../src/api/mappers'
import { ApiRequestError } from '../src/api/client'
import { financeApi } from '../src/api/finance'
import type { CaptureResultPreview, TransactionType } from '../src/api/types'
import { useAuth } from '../src/auth/AuthProvider'
import { resolveDisplayName } from '../src/auth/displayName'
import { CaptureRejectedError, MAX_CAPTURE_BATCH_SIZE, prepareImageForOcr, sweepStaleCaptureFiles } from '../src/capture/image-pipeline'
import { consumeShareQueue } from '../src/capture/shareQueue'
import { extractReceipt, VISION_MODEL, VisionRequestError } from '../src/capture/visionClient'
import { SwipeableRow } from '../src/components/SwipeableRow'
import { formatDateString } from '../src/finance/dates'
import { getAppLocale } from '../src/i18n'
import { Screen } from '../src/components/Screen'
import { randomId } from '../src/shared/id'
import { FintButton, FintCard, FintConfirmDialog, FintSpinner, useNotify } from '../src/ui'

type RowStatus = 'queued' | 'processing' | 'created' | 'duplicate' | 'unrecognized' | 'failed'

// Pasos reales del pipeline de una captura, en orden. No es una animación
// simulada: el progreso salta a la siguiente marca exactamente cuando ese
// paso termina de verdad (lectura local del archivo, respuesta del Worker,
// respuesta del backend) — no hay temporizador ni estimación de tiempo. Cada
// fila corre su propio pipeline en paralelo con las demás.
type ProcessingPhase = 'preparing' | 'extracting' | 'saving'

const PHASE_PROGRESS: Record<ProcessingPhase, number> = {
  preparing: 0.05,
  extracting: 0.3,
  saving: 0.85,
}

// El texto durante 'processing' rota entre estas frases en vez de mostrar el
// paso técnico real (que sí sigue siendo exacto en la barra/porcentaje) — el
// nombre del paso no le dice nada útil al usuario, esto lo mantiene animado.
const ROTATING_TEXT_KEYS = [
  'capture.rotating1',
  'capture.rotating2',
  'capture.rotating3',
  'capture.rotating4',
  'capture.rotating5',
]
const ROTATING_TEXT_INTERVAL_MS = 1600

type CaptureRow = {
  clientCaptureId: string
  uri: string
  status: RowStatus
  bank: string | null
  preview: CaptureResultPreview | null
  warnings: string[]
  pendingMovementId: string | null
  errorText: string | null
  processingPhase: ProcessingPhase | null
}

type ScreenPhase = 'opening' | 'processing'

export default function CaptureImportScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const toast = useNotify()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const [phase, setPhase] = useState<ScreenPhase>('opening')
  const [rows, setRows] = useState<CaptureRow[]>([])
  const [directionAnswers, setDirectionAnswers] = useState<Record<string, TransactionType>>({})
  const [deleteTarget, setDeleteTarget] = useState<CaptureRow | null>(null)
  const didAutoPick = useRef(false)
  const deletedIdsRef = useRef<Set<string>>(new Set())
  const locale = getAppLocale(i18n.resolvedLanguage)

  useEffect(() => {
    sweepStaleCaptureFiles()
  }, [])

  useEffect(() => {
    if (didAutoPick.current) return
    didAutoPick.current = true
    void (async () => {
      const shared = await consumeShareQueue()
      if (shared.length > 0) await processUris('share', shared)
      else await pickFromGallery()
    })()
  }, [])

  const displayName = resolveDisplayName(session) ?? null
  const hasWeakName = !displayName || displayName.trim().split(/\s+/).filter(Boolean).length < 2

  function updateRow(id: string, patch: Partial<CaptureRow>) {
    setRows((current) => current.map((row) => (row.clientCaptureId === id ? { ...row, ...patch } : row)))
  }

  function describeError(error: unknown): string {
    if (error instanceof CaptureRejectedError) return t(`capture.pipelineErrors.${error.reasonCode}`, { defaultValue: t('capture.errors.unknown') })
    if (error instanceof VisionRequestError) {
      if (error.kind === 'quota_exceeded') return t('capture.errors.quotaExhausted')
      if (error.kind === 'unauthorized') return t('capture.errors.unauthorized')
      return t('capture.errors.visionUnavailable')
    }
    if (error instanceof ApiRequestError) return error.message
    return t('capture.errors.unknown')
  }

  async function processRow(source: 'camera' | 'gallery' | 'share', row: CaptureRow) {
    if (deletedIdsRef.current.has(row.clientCaptureId)) return
    updateRow(row.clientCaptureId, { status: 'processing', processingPhase: 'preparing' })
    let prepared: Awaited<ReturnType<typeof prepareImageForOcr>> | null = null
    try {
      prepared = await prepareImageForOcr(row.uri)
      updateRow(row.clientCaptureId, { processingPhase: 'extracting' })
      const { extraction, latencyMs } = await extractReceipt(prepared.base64)
      updateRow(row.clientCaptureId, { processingPhase: 'saving' })
      const result = await financeApi.createPendingFromCapture(
        [{
          clientCaptureId: row.clientCaptureId,
          source,
          capturedAt: null,
          extraction,
          extractor: { provider: 'cloudflare-workers-ai', model: VISION_MODEL, latencyMs },
        }],
        displayName,
      )
      const item = result.results[0]
      if (!item) throw new Error('empty capture result')
      updateRow(row.clientCaptureId, {
        status: item.status,
        bank: item.bank,
        preview: item.preview,
        warnings: item.warnings,
        pendingMovementId: item.pendingMovementId,
        processingPhase: null,
      })
    } catch (error) {
      updateRow(row.clientCaptureId, { status: 'failed', errorText: describeError(error), processingPhase: null })
    } finally {
      prepared?.cleanup()
    }
  }

  // Se usa tanto para la primera carga como para "agregar más" — cada
  // llamada agrega filas nuevas a las que ya hay y procesa esas en paralelo,
  // sin tocar las filas de rondas anteriores.
  async function processUris(source: 'camera' | 'gallery' | 'share', uris: string[]) {
    setPhase('processing')

    const capped = uris.slice(0, MAX_CAPTURE_BATCH_SIZE)
    if (uris.length > capped.length) {
      toast.info(t('capture.batchLimitExceeded', { max: MAX_CAPTURE_BATCH_SIZE }))
    }
    if (hasWeakName) toast.info(t('capture.nameHint'))

    const newRows: CaptureRow[] = capped.map((uri) => ({
      clientCaptureId: randomId(),
      uri,
      status: 'queued',
      bank: null,
      preview: null,
      warnings: [],
      pendingMovementId: null,
      errorText: null,
      processingPhase: null,
    }))
    setRows((current) => [...current, ...newRows])

    await Promise.all(newRows.map((row) => processRow(source, row)))

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['pending-movements'] }),
      queryClient.invalidateQueries({ queryKey: ['pending-movements', 'summary'] }),
    ])
  }

  async function pickFromGallery() {
    setPhase('opening')
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      toast.error(t('capture.errors.permissionDenied'))
      router.back()
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: MAX_CAPTURE_BATCH_SIZE,
    })
    if (result.canceled || result.assets.length === 0) {
      router.back()
      return
    }
    await processUris('gallery', result.assets.map((asset) => asset.uri))
  }

  async function addMoreImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      toast.error(t('capture.errors.permissionDenied'))
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: MAX_CAPTURE_BATCH_SIZE,
    })
    if (result.canceled || result.assets.length === 0) return
    await processUris('gallery', result.assets.map((asset) => asset.uri))
  }

  const isProcessing = rows.some((row) => row.status === 'queued' || row.status === 'processing')
  const createdCount = rows.filter((row) => row.status === 'created').length
  const duplicateCount = rows.filter((row) => row.status === 'duplicate').length
  const unrecognizedCount = rows.filter((row) => row.status === 'unrecognized').length
  const failedCount = rows.filter((row) => row.status === 'failed').length

  // Solo 'created' pide dirección: un 'duplicate' apunta al pendiente que ya
  // existía de una captura anterior, que puede no seguir en estado 'pending'
  // (ya confirmado, ya descartado) — reintentar set-type ahí da 409.
  const undeterminedRows = rows.filter(
    (row) => row.status === 'created' && row.pendingMovementId && row.warnings.includes('direction_undetermined'),
  )
  const needsAnswers = undeterminedRows.length > 0
  const allAnswered = undeterminedRows.every((row) => directionAnswers[row.clientCaptureId])

  const finishMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        undeterminedRows.map((row) => {
          const type = directionAnswers[row.clientCaptureId]
          if (!type || !row.pendingMovementId) return Promise.resolve()
          return financeApi.setPendingMovementType(row.pendingMovementId, { type })
        }),
      )
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pending-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['pending-movements', 'summary'] }),
      ])
      router.replace('/pending-movements')
    },
    onError: (error) => toast.error(t('capture.errors.saveFailed'), { message: error instanceof Error ? error.message : undefined }),
  })

  const deleteRowMutation = useMutation({
    mutationFn: async (row: CaptureRow) => {
      if (row.status === 'created' && row.pendingMovementId) {
        await financeApi.discardPendingMovement(row.pendingMovementId, { reason: 'capture_review' })
      }
    },
    onSuccess: async (_data, row) => {
      deletedIdsRef.current.add(row.clientCaptureId)
      let remaining = 0
      setRows((current) => {
        const next = current.filter((r) => r.clientCaptureId !== row.clientCaptureId)
        remaining = next.length
        return next
      })
      setDirectionAnswers((current) => {
        if (!(row.clientCaptureId in current)) return current
        const next = { ...current }
        delete next[row.clientCaptureId]
        return next
      })
      setDeleteTarget(null)
      if (row.status === 'created' && row.pendingMovementId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['pending-movements'] }),
          queryClient.invalidateQueries({ queryKey: ['pending-movements', 'summary'] }),
        ])
      }
      // Sin filas no hay nada que guardar — no tiene sentido dejar al usuario
      // parado frente a un botón "Listo" que no hace nada.
      if (remaining === 0) router.back()
    },
    onError: (error) => toast.error(t('capture.errors.deleteFailed'), { message: error instanceof Error ? error.message : undefined }),
  })

  const finish = () => {
    if (needsAnswers) finishMutation.mutate()
    else router.replace('/pending-movements')
  }

  return (
    <>
      <Stack.Screen options={{ title: phase === 'opening' ? '' : t('capture.title') }} />
      <Screen>
        <YStack gap="$4" pb="$5">
          {phase === 'opening' ? (
            <FintCard items="center" gap="$3" py="$6">
              <FintSpinner color="$primary" />
              <Paragraph color="$color11" fontWeight="600">{t('capture.opening')}</Paragraph>
            </FintCard>
          ) : null}

          {phase === 'processing' ? (
            <>
              <FintCard items="center" gap="$3" py="$5">
                <YStack width={56} height={56} rounded="$12" bg={isProcessing ? '$secondary' : '$green2'} items="center" justify="center">
                  {isProcessing ? <FintSpinner color="$primary" /> : <CheckCircle2 size={28} color="$green10" />}
                </YStack>
                <Paragraph color="$color12" fontFamily="$heading" fontSize="$5" fontWeight="800">
                  {isProcessing ? t('capture.summaryWorking') : t('capture.resultTitle')}
                </Paragraph>
                <XStack gap="$2" flexWrap="wrap" justify="center">
                  <StatBadge label={t('capture.created')} value={createdCount} color="$green10" />
                  <StatBadge label={t('capture.duplicates')} value={duplicateCount} color="$color10" />
                  {unrecognizedCount > 0 ? <StatBadge label={t('capture.unrecognized')} value={unrecognizedCount} color="$yellow10" /> : null}
                  {failedCount > 0 ? <StatBadge label={t('capture.failed')} value={failedCount} color="$red10" /> : null}
                </XStack>
                <FintButton
                  variant="outlined"
                  width="100%"
                  minH={48}
                  disabled={isProcessing || deleteRowMutation.isPending || finishMutation.isPending}
                  icon={<Plus size={16} color="$primary" />}
                  onPress={addMoreImages}
                >
                  {t('capture.addMore')}
                </FintButton>
              </FintCard>

              <YStack gap="$3">
                {rows.map((row) => (
                  <CaptureRowCard
                    key={row.clientCaptureId}
                    row={row}
                    locale={locale}
                    t={t}
                    selectedType={directionAnswers[row.clientCaptureId]}
                    onSelectType={(type) => setDirectionAnswers((current) => ({ ...current, [row.clientCaptureId]: type }))}
                    onRequestDelete={setDeleteTarget}
                  />
                ))}
              </YStack>

              <FintButton
                width="100%"
                minH={52}
                disabled={isProcessing || (needsAnswers && !allAnswered) || finishMutation.isPending || deleteRowMutation.isPending}
                icon={finishMutation.isPending ? <FintSpinner color="$primaryForeground" /> : undefined}
                onPress={finish}
              >
                {needsAnswers ? t('capture.save') : t('capture.done')}
              </FintButton>
            </>
          ) : null}
        </YStack>
      </Screen>
      <DeleteRowDialog
        row={deleteTarget}
        isPending={deleteRowMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteRowMutation.mutate(deleteTarget)}
      />
    </>
  )
}

function StatBadge({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <XStack items="center" gap="$1.5" bg="$muted" rounded="$5" px="$2.5" py="$1.5">
      <Paragraph color={color as never} fontSize="$3" fontWeight="900">{value}</Paragraph>
      <Paragraph color="$color10" fontSize="$1" fontWeight="600">{label}</Paragraph>
    </XStack>
  )
}

function useRotatingText(active: boolean): number {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!active) {
      setIndex(0)
      return
    }
    const interval = setInterval(() => setIndex((current) => (current + 1) % ROTATING_TEXT_KEYS.length), ROTATING_TEXT_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [active])

  return index
}

function RowIcon({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <YStack width={42} height={42} rounded="$8" bg={bg as never} items="center" justify="center">
      {children}
    </YStack>
  )
}

function statusVisual(row: CaptureRow): { icon: ReactNode; bg: string } {
  switch (row.status) {
    case 'queued':
      return { icon: <Clock size={20} color="$color9" />, bg: '$color4' }
    case 'processing':
      return { icon: <FintSpinner color="$primary" />, bg: '$secondary' }
    case 'created':
      return { icon: <CheckCircle2 size={20} color="$green10" />, bg: '$green2' }
    case 'duplicate':
      return { icon: <History size={20} color="$color9" />, bg: '$color4' }
    case 'unrecognized':
      return { icon: <AlertTriangle size={20} color="$yellow10" />, bg: '$yellow2' }
    case 'failed':
      return { icon: <AlertTriangle size={20} color="$red10" />, bg: '$red2' }
  }
}

function subtitleFor(row: CaptureRow, locale: string, t: (key: string, opts?: Record<string, unknown>) => string): string | null {
  if (row.status !== 'created' && row.status !== 'duplicate') return null
  const parts: string[] = []
  if (row.preview?.occurredAt) parts.push(formatDateString(row.preview.occurredAt, locale))
  if (row.status === 'duplicate') parts.push(t('capture.rowDuplicate'))
  else if (row.preview?.recipientName) parts.push(row.preview.recipientName)
  return parts.length > 0 ? parts.join(' · ') : null
}

function CaptureRowCard({
  row, locale, t, selectedType, onSelectType, onRequestDelete,
}: {
  row: CaptureRow
  locale: string
  t: (key: string, opts?: Record<string, unknown>) => string
  selectedType: TransactionType | undefined
  onSelectType: (type: TransactionType) => void
  onRequestDelete: (row: CaptureRow) => void
}) {
  const rotatingIndex = useRotatingText(row.status === 'processing')
  const canDelete = row.status !== 'processing'
  const needsAnswer = row.status === 'created' && Boolean(row.pendingMovementId) && row.warnings.includes('direction_undetermined')
  const progress = row.processingPhase ? PHASE_PROGRESS[row.processingPhase] : 0
  const { icon, bg } = statusVisual(row)

  const titleText = row.status === 'queued'
    ? t('capture.rowQueued')
    : row.status === 'processing'
      ? t(ROTATING_TEXT_KEYS[rotatingIndex]!)
      : row.status === 'failed'
        ? row.errorText ?? t('capture.errors.unknown')
        : row.status === 'unrecognized'
          ? t('capture.rowUnrecognized')
          : (row.preview?.title ?? row.bank ?? '—')

  const subtitleText = subtitleFor(row, locale, t)
  const amountText = row.preview?.amount != null && (row.status === 'created' || row.status === 'duplicate')
    ? formatMoney(row.preview.amount, row.preview.currency ?? 'PEN', locale)
    : null
  const amountColor = row.preview?.type === 'income' ? '$green10' : row.preview?.type === 'expense' ? '$red10' : '$color12'

  return (
    <SwipeableRow
      enabled={canDelete}
      onAction={() => onRequestDelete(row)}
      actionIcon={<Trash2 size={20} color="white" />}
      actionLabel={t('capture.deleteRow')}
    >
      <FintCard py="$3" gap="$2.5">
        <XStack items="center" gap="$3">
          <RowIcon bg={bg}>{icon}</RowIcon>
          <YStack flex={1} minW={0} gap="$0.5">
            <Paragraph numberOfLines={1} color={row.status === 'failed' ? '$red11' : '$color12'} fontWeight="800" fontSize="$3">
              {titleText}
            </Paragraph>
            {subtitleText ? <Paragraph numberOfLines={1} color="$color10" fontSize="$1">{subtitleText}</Paragraph> : null}
          </YStack>
          {row.status === 'processing' ? (
            <Paragraph color="$color9" fontSize="$2" fontWeight="700">{Math.round(progress * 100)}%</Paragraph>
          ) : amountText || canDelete ? (
            <YStack items="flex-end" gap="$1">
              {amountText ? <Paragraph color={amountColor as never} fontSize="$3" fontWeight="900">{amountText}</Paragraph> : null}
              {canDelete ? (
                <Button
                  circular
                  chromeless
                  size="$2"
                  icon={<Trash2 size={14} color="$color8" />}
                  pressStyle={{ bg: '$color4' }}
                  onPress={() => onRequestDelete(row)}
                  aria-label={t('capture.deleteRow')}
                />
              ) : null}
            </YStack>
          ) : null}
        </XStack>

        {row.status === 'processing' ? (
          <YStack height={4} rounded={999} bg="$muted" overflow="hidden">
            <YStack height={4} width={`${progress * 100}%`} rounded={999} bg="$primary" />
          </YStack>
        ) : null}

        {needsAnswer ? (
          <YStack gap="$1.5">
            <Paragraph color="$color11" fontSize="$2" fontWeight="600">{t('capture.whoDidThis')}</Paragraph>
            <XStack gap="$2">
              <DirectionOption
                type="income"
                selected={selectedType === 'income'}
                label={t('capture.iWasPaid')}
                onPress={() => onSelectType('income')}
              />
              <DirectionOption
                type="expense"
                selected={selectedType === 'expense'}
                label={t('capture.iPaid')}
                onPress={() => onSelectType('expense')}
              />
            </XStack>
          </YStack>
        ) : null}
      </FintCard>
    </SwipeableRow>
  )
}

function DeleteRowDialog({
  row, isPending, onCancel, onConfirm,
}: { row: CaptureRow | null; isPending: boolean; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useTranslation()
  const willDiscardPending = row?.status === 'created' && Boolean(row.pendingMovementId)
  return (
    <FintConfirmDialog
      open={Boolean(row)}
      isPending={isPending}
      title={t('capture.deleteRowTitle')}
      description={t(willDiscardPending ? 'capture.deleteRowDescriptionCreated' : 'capture.deleteRowDescription')}
      cancelLabel={t('actions.cancel')}
      confirmLabel={t('capture.deleteRowConfirm')}
      pendingLabel={t('capture.deletingRow')}
      destructive
      icon={<Trash2 size={17} color="$primaryForeground" />}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

function DirectionOption({
  type, label, onPress, selected,
}: { type: TransactionType; label: string; onPress: () => void; selected: boolean }) {
  const income = type === 'income'
  const accent = income ? '$green9' : '$red9'
  const Icon = income ? ArrowDownLeft : ArrowUpRight
  return (
    <FintButton
      flex={1}
      minH={52}
      variant="solid"
      bg={selected ? (income ? '$green2' : '$red2') : 'transparent'}
      color={selected ? (income ? '$green11' : '$red11') : '$color10'}
      borderColor={selected ? accent : '$borderColor'}
      borderWidth={1}
      icon={
        <YStack width={26} height={26} rounded="$10" bg={selected ? accent : '$color4'} items="center" justify="center">
          <Icon size={14} color={selected ? 'white' : '$color10'} />
        </YStack>
      }
      onPress={onPress}
    >
      {label}
    </FintButton>
  )
}
