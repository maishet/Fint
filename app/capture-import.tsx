import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock, Copy } from '@tamagui/lucide-icons-2'
import * as ImagePicker from 'expo-image-picker'
import { Stack, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ComponentProps } from 'react'
import { Paragraph, XStack, YStack } from 'tamagui'
import { formatMoney } from '../src/api/mappers'
import { ApiRequestError } from '../src/api/client'
import { financeApi } from '../src/api/finance'
import type { CaptureResultPreview, TransactionType } from '../src/api/types'
import { useAuth } from '../src/auth/AuthProvider'
import { resolveDisplayName } from '../src/auth/displayName'
import { CaptureRejectedError, MAX_CAPTURE_BATCH_SIZE, prepareImageForOcr, sweepStaleCaptureFiles } from '../src/capture/image-pipeline'
import { consumeShareQueue } from '../src/capture/shareQueue'
import { extractReceipt, VISION_MODEL, VisionRequestError } from '../src/capture/visionClient'
import { formatDateString } from '../src/finance/dates'
import { getAppLocale } from '../src/i18n'
import { Screen } from '../src/components/Screen'
import { randomId } from '../src/shared/id'
import { FintButton, FintCard, FintSpinner, useNotify } from '../src/ui'

type RowStatus = 'queued' | 'processing' | 'created' | 'duplicate' | 'unrecognized' | 'failed'

type CaptureRow = {
  clientCaptureId: string
  uri: string
  status: RowStatus
  bank: string | null
  preview: CaptureResultPreview | null
  warnings: string[]
  pendingMovementId: string | null
  errorText: string | null
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
  const didAutoPick = useRef(false)
  const locale = getAppLocale(i18n.resolvedLanguage)

  useEffect(() => {
    sweepStaleCaptureFiles()
  }, [])

  useEffect(() => {
    if (didAutoPick.current) return
    didAutoPick.current = true
    void (async () => {
      const shared = await consumeShareQueue()
      if (shared.length > 0) await runBatch('share', shared)
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

  async function runBatch(source: 'camera' | 'gallery' | 'share', uris: string[]) {
    setPhase('processing')
    setDirectionAnswers({})

    const capped = uris.slice(0, MAX_CAPTURE_BATCH_SIZE)
    if (uris.length > capped.length) {
      toast.info(t('capture.batchLimitExceeded', { max: MAX_CAPTURE_BATCH_SIZE }))
    }
    if (hasWeakName) toast.info(t('capture.nameHint'))

    const initialRows: CaptureRow[] = capped.map((uri) => ({
      clientCaptureId: randomId(),
      uri,
      status: 'queued',
      bank: null,
      preview: null,
      warnings: [],
      pendingMovementId: null,
      errorText: null,
    }))
    setRows(initialRows)

    for (const row of initialRows) {
      updateRow(row.clientCaptureId, { status: 'processing' })
      let prepared: Awaited<ReturnType<typeof prepareImageForOcr>> | null = null
      try {
        prepared = await prepareImageForOcr(row.uri)
        const { extraction, latencyMs } = await extractReceipt(prepared.base64)
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
        })
      } catch (error) {
        updateRow(row.clientCaptureId, { status: 'failed', errorText: describeError(error) })
      } finally {
        prepared?.cleanup()
      }
    }

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
    await runBatch('gallery', result.assets.map((asset) => asset.uri))
  }

  const isProcessing = rows.some((row) => row.status === 'queued' || row.status === 'processing')
  const createdCount = rows.filter((row) => row.status === 'created').length
  const duplicateCount = rows.filter((row) => row.status === 'duplicate').length
  const unrecognizedCount = rows.filter((row) => row.status === 'unrecognized').length
  const failedCount = rows.filter((row) => row.status === 'failed').length

  const undeterminedRows = rows.filter(
    (row) => row.status !== 'unrecognized' && row.status !== 'failed' && row.status !== 'queued' && row.status !== 'processing'
      && row.pendingMovementId && row.warnings.includes('direction_undetermined'),
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
              <XStack gap="$2" flexWrap="wrap">
                <StatBadge label={t('capture.created')} value={createdCount} color="$green10" />
                <StatBadge label={t('capture.duplicates')} value={duplicateCount} color="$color10" />
                {unrecognizedCount > 0 ? <StatBadge label={t('capture.unrecognized')} value={unrecognizedCount} color="$yellow10" /> : null}
                {failedCount > 0 ? <StatBadge label={t('capture.failed')} value={failedCount} color="$red10" /> : null}
              </XStack>

              <YStack gap="$3">
                {rows.map((row) => (
                  <CaptureRowCard
                    key={row.clientCaptureId}
                    row={row}
                    locale={locale}
                    t={t}
                    selectedType={directionAnswers[row.clientCaptureId]}
                    onSelectType={(type) => setDirectionAnswers((current) => ({ ...current, [row.clientCaptureId]: type }))}
                  />
                ))}
              </YStack>

              <FintButton
                width="100%"
                minH={52}
                disabled={isProcessing || (needsAnswers && !allAnswered) || finishMutation.isPending}
                icon={finishMutation.isPending ? <FintSpinner color="$primaryForeground" /> : undefined}
                onPress={finish}
              >
                {needsAnswers ? t('capture.save') : t('capture.done')}
              </FintButton>
            </>
          ) : null}
        </YStack>
      </Screen>
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

function previewLine(preview: CaptureResultPreview | null, locale: string): string | null {
  if (!preview) return null
  const parts: string[] = []
  if (preview.amount != null) parts.push(formatMoney(preview.amount, preview.currency ?? 'PEN', locale))
  if (preview.occurredAt) parts.push(formatDateString(preview.occurredAt, locale))
  return parts.length > 0 ? parts.join(' · ') : null
}

function CaptureRowCard({
  row, locale, t, selectedType, onSelectType,
}: {
  row: CaptureRow
  locale: string
  t: (key: string, opts?: Record<string, unknown>) => string
  selectedType: TransactionType | undefined
  onSelectType: (type: TransactionType) => void
}) {
  const title = row.preview?.title ?? row.bank ?? '—'
  const amountDate = previewLine(row.preview, locale)
  const needsAnswer = (row.status === 'created' || row.status === 'duplicate')
    && Boolean(row.pendingMovementId) && row.warnings.includes('direction_undetermined')

  return (
    <FintCard gap="$2">
      {row.status === 'queued' ? (
        <XStack items="center" gap="$2.5">
          <Clock size={18} color="$color9" />
          <Paragraph color="$color9" fontWeight="600">{t('capture.rowQueued')}</Paragraph>
        </XStack>
      ) : null}

      {row.status === 'processing' ? (
        <XStack items="center" gap="$2.5">
          <FintSpinner color="$color10" />
          <Paragraph color="$color11" fontWeight="600">{t('capture.rowProcessing')}</Paragraph>
        </XStack>
      ) : null}

      {row.status === 'failed' ? (
        <XStack items="center" gap="$2.5">
          <AlertTriangle size={18} color="$red10" />
          <Paragraph color="$red11" fontWeight="600" flex={1}>{row.errorText}</Paragraph>
        </XStack>
      ) : null}

      {row.status === 'unrecognized' ? (
        <XStack items="center" gap="$2.5">
          <AlertTriangle size={18} color="$yellow10" />
          <Paragraph color="$color11" fontWeight="600">{t('capture.rowUnrecognized')}</Paragraph>
        </XStack>
      ) : null}

      {row.status === 'created' || row.status === 'duplicate' ? (
        <YStack gap="$1.5">
          <XStack items="center" gap="$2.5">
            {row.status === 'created' ? <CheckCircle2 size={18} color="$green10" /> : <Copy size={18} color="$color9" />}
            <Paragraph color="$color12" fontWeight="700" flex={1}>{title}</Paragraph>
          </XStack>
          {amountDate ? <Paragraph color="$color11" fontSize="$3" fontWeight="600">{amountDate}</Paragraph> : null}
          {row.preview?.recipientName ? (
            <Paragraph color="$color10" fontSize="$2">{t('capture.recipientLabel', { name: row.preview.recipientName })}</Paragraph>
          ) : null}
          {row.status === 'duplicate' ? (
            <Paragraph color="$color9" fontSize="$2">{t('capture.rowDuplicate')}</Paragraph>
          ) : null}

          {needsAnswer ? (
            <YStack gap="$1.5" pt="$1.5">
              <Paragraph color="$color11" fontSize="$2" fontWeight="600">{t('capture.whoDidThis')}</Paragraph>
              <XStack gap="$2">
                <DirectionOption
                  selected={selectedType === 'income'}
                  icon={<ArrowDownLeft size={16} />}
                  label={t('capture.iWasPaid')}
                  onPress={() => onSelectType('income')}
                />
                <DirectionOption
                  selected={selectedType === 'expense'}
                  icon={<ArrowUpRight size={16} />}
                  label={t('capture.iPaid')}
                  onPress={() => onSelectType('expense')}
                />
              </XStack>
            </YStack>
          ) : null}
        </YStack>
      ) : null}
    </FintCard>
  )
}

function DirectionOption({
  icon, label, onPress, selected,
}: { icon: ComponentProps<typeof FintButton>['icon']; label: string; onPress: () => void; selected: boolean }) {
  return (
    <FintButton
      flex={1}
      minH={52}
      variant="solid"
      bg={selected ? '$accent2' : 'transparent'}
      color={selected ? '$accent11' : '$color10'}
      borderColor={selected ? '$accent8' : '$borderColor'}
      borderWidth={1}
      icon={icon}
      onPress={onPress}
    >
      {label}
    </FintButton>
  )
}
