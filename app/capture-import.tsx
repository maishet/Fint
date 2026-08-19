import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle2 } from '@tamagui/lucide-icons-2'
import * as ImagePicker from 'expo-image-picker'
import { Stack, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ComponentProps } from 'react'
import { Paragraph, XStack, YStack } from 'tamagui'
import { financeApi } from '../src/api/finance'
import type { CaptureItemInput, CreateFromCaptureResult, TransactionType } from '../src/api/types'
import { useAuth } from '../src/auth/AuthProvider'
import { resolveDisplayName } from '../src/auth/displayName'
import { CaptureRejectedError, MAX_CAPTURE_BATCH_SIZE, prepareImageForOcr, sweepStaleCaptureFiles } from '../src/capture/image-pipeline'
import { extractReceipt, VISION_MODEL, VisionRequestError } from '../src/capture/visionClient'
import { Screen } from '../src/components/Screen'
import { randomId } from '../src/shared/id'
import { FintButton, FintCard, FintSpinner, useNotify } from '../src/ui'

type FailedCapture = {
  clientCaptureId: string
  reasonKey: string
}

type ScreenPhase = 'opening' | 'working' | 'results'

function reasonKeyFor(error: unknown): string {
  if (error instanceof CaptureRejectedError) return `capture.pipelineErrors.${error.reasonCode}`
  if (error instanceof VisionRequestError) {
    if (error.kind === 'quota_exceeded') return 'capture.errors.quotaExhausted'
    if (error.kind === 'unauthorized') return 'capture.errors.unauthorized'
    return 'capture.errors.visionUnavailable'
  }
  return 'capture.errors.unknown'
}

export default function CaptureImportScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useNotify()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const [phase, setPhase] = useState<ScreenPhase>('opening')
  const [progressLabel, setProgressLabel] = useState('')
  const [response, setResponse] = useState<CreateFromCaptureResult | null>(null)
  const [failed, setFailed] = useState<FailedCapture[]>([])
  const [directionAnswers, setDirectionAnswers] = useState<Record<string, TransactionType>>({})
  const didAutoPick = useRef(false)

  useEffect(() => {
    sweepStaleCaptureFiles()
  }, [])

  useEffect(() => {
    if (didAutoPick.current) return
    didAutoPick.current = true
    void pickFromGallery()
  }, [])

  const displayName = resolveDisplayName(session) ?? null
  const hasWeakName = !displayName || displayName.trim().split(/\s+/).filter(Boolean).length < 2

  async function invalidatePending() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['pending-movements'] }),
      queryClient.invalidateQueries({ queryKey: ['pending-movements', 'summary'] }),
    ])
  }

  async function runBatch(source: 'camera' | 'gallery', uris: string[]) {
    setPhase('working')
    setResponse(null)
    setFailed([])
    setDirectionAnswers({})

    const capped = uris.slice(0, MAX_CAPTURE_BATCH_SIZE)
    if (uris.length > capped.length) {
      toast.info(t('capture.batchLimitExceeded', { max: MAX_CAPTURE_BATCH_SIZE }))
    }
    if (hasWeakName) toast.info(t('capture.nameHint'))

    const captures: CaptureItemInput[] = []
    const failures: FailedCapture[] = []

    for (let index = 0; index < capped.length; index += 1) {
      setProgressLabel(t('capture.progress', { current: index + 1, total: capped.length }))
      const clientCaptureId = randomId()
      let prepared: Awaited<ReturnType<typeof prepareImageForOcr>> | null = null
      try {
        prepared = await prepareImageForOcr(capped[index]!)
        const { extraction, latencyMs } = await extractReceipt(prepared.base64)
        captures.push({
          clientCaptureId,
          source,
          capturedAt: null,
          extraction,
          extractor: { provider: 'cloudflare-workers-ai', model: VISION_MODEL, latencyMs },
        })
      } catch (error) {
        failures.push({ clientCaptureId, reasonKey: reasonKeyFor(error) })
      } finally {
        prepared?.cleanup()
      }
    }

    setFailed(failures)

    if (captures.length === 0) {
      setPhase('results')
      return
    }

    try {
      const result = await financeApi.createPendingFromCapture(captures, displayName)
      setResponse(result)
      await invalidatePending()
    } catch (error) {
      toast.error(t('capture.errors.saveFailed'), { message: error instanceof Error ? error.message : undefined })
    } finally {
      setPhase('results')
    }
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

  const undeterminedItems = (response?.results ?? []).filter(
    (item) => item.status !== 'unrecognized' && item.pendingMovementId && item.warnings.includes('direction_undetermined'),
  )
  const needsAnswers = undeterminedItems.length > 0
  const allAnswered = undeterminedItems.every((item) => directionAnswers[item.clientCaptureId])

  const finishMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        undeterminedItems.map((item) => {
          const type = directionAnswers[item.clientCaptureId]
          if (!type || !item.pendingMovementId) return Promise.resolve()
          return financeApi.setPendingMovementType(item.pendingMovementId, { type })
        }),
      )
    },
    onSuccess: async () => {
      await invalidatePending()
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
              <Paragraph color="$color11" fontWeight="600">{t('capture.openingGallery')}</Paragraph>
            </FintCard>
          ) : null}

          {phase === 'working' ? (
            <FintCard items="center" gap="$3" py="$6">
              <FintSpinner color="$primary" />
              <Paragraph color="$color11" fontWeight="600">{progressLabel}</Paragraph>
            </FintCard>
          ) : null}

          {phase === 'results' ? (
            <>
              <FintCard items="center" gap="$3" py="$5">
                <YStack width={60} height={60} rounded="$12" bg="$green2" items="center" justify="center">
                  <CheckCircle2 size={30} color="$green10" />
                </YStack>
                <Paragraph color="$color12" fontFamily="$heading" fontSize="$6" fontWeight="800">
                  {t('capture.resultTitle')}
                </Paragraph>
                <YStack gap="$2" width="100%">
                  <ResultRow label={t('capture.created')} value={response?.created ?? 0} color="$green10" />
                  <ResultRow label={t('capture.duplicates')} value={response?.duplicates ?? 0} color="$color10" />
                  <ResultRow label={t('capture.unrecognized')} value={response?.unrecognized ?? 0} color={response?.unrecognized ? '$yellow10' : '$color10'} />
                  {failed.length > 0 ? <ResultRow label={t('capture.failed')} value={failed.length} color="$red10" /> : null}
                </YStack>
              </FintCard>

              {needsAnswers ? (
                <YStack gap="$3">
                  <Paragraph color="$color11" fontWeight="700" fontSize="$3">{t('capture.needsReviewTitle')}</Paragraph>
                  {undeterminedItems.map((item) => (
                    <FintCard key={item.clientCaptureId} gap="$2.5">
                      <Paragraph color="$color12" fontWeight="700">{item.preview?.title ?? item.bank}</Paragraph>
                      {item.preview?.recipientName ? (
                        <Paragraph color="$color10" fontSize="$2">{t('capture.recipientLabel', { name: item.preview.recipientName })}</Paragraph>
                      ) : null}
                      <Paragraph color="$color11" fontSize="$2" fontWeight="600">{t('capture.whoDidThis')}</Paragraph>
                      <XStack gap="$2">
                        <DirectionOption
                          selected={directionAnswers[item.clientCaptureId] === 'income'}
                          icon={<ArrowDownLeft size={16} />}
                          label={t('capture.iWasPaid')}
                          onPress={() => setDirectionAnswers((current) => ({ ...current, [item.clientCaptureId]: 'income' }))}
                        />
                        <DirectionOption
                          selected={directionAnswers[item.clientCaptureId] === 'expense'}
                          icon={<ArrowUpRight size={16} />}
                          label={t('capture.iPaid')}
                          onPress={() => setDirectionAnswers((current) => ({ ...current, [item.clientCaptureId]: 'expense' }))}
                        />
                      </XStack>
                    </FintCard>
                  ))}
                </YStack>
              ) : null}

              {failed.length > 0 ? (
                <YStack gap="$2" bg="$red2" borderColor="$red7" borderWidth={1} rounded="$6" p="$3">
                  <XStack items="center" gap="$2">
                    <AlertTriangle size={16} color="$red10" />
                    <Paragraph color="$red11" fontWeight="700" fontSize="$2">{t('capture.someFailedTitle')}</Paragraph>
                  </XStack>
                  {failed.map((item) => (
                    <Paragraph key={item.clientCaptureId} color="$red10" fontSize="$1">
                      {t(item.reasonKey, { defaultValue: t('capture.errors.unknown') })}
                    </Paragraph>
                  ))}
                </YStack>
              ) : null}

              <FintButton
                width="100%"
                minH={52}
                disabled={(needsAnswers && !allAnswered) || finishMutation.isPending}
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

function ResultRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <XStack items="center" justify="space-between" bg="$muted" rounded="$5" px="$3" py="$2.5">
      <Paragraph color="$color11" fontWeight="600">{label}</Paragraph>
      <Paragraph color={color as never} fontSize="$5" fontWeight="900">{value}</Paragraph>
    </XStack>
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
