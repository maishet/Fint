import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Paragraph, Sheet, Spinner, YStack } from 'tamagui'
import { z } from 'zod'
import { financeApi } from '../api/finance'
import type { PaymentOccurrence } from '../api/types'
import { getValidationMessage, parseDecimalInput, useSubmitValidation } from '../forms'
import { useSheetBackHandler } from '../hooks/useSheetBackHandler'
import { FintButton, FintFormField, FintInput } from '../ui'

export function CardAmountsSheet({ occurrence, onOpenChange, open }: { occurrence: PaymentOccurrence | null; onOpenChange: (open: boolean) => void; open: boolean }) {
  const { i18n, t } = useTranslation()
  const toast = useToastController()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const [totalAmount, setTotalAmount] = useState('')
  const [minimumAmount, setMinimumAmount] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const validation = useSubmitValidation<'totalAmount' | 'minimumAmount'>()
  const amountMessage = getValidationMessage(t, i18n.resolvedLanguage, 'amount')
  const schema = z.object({
    totalAmount: z.number({ error: amountMessage }).positive(getValidationMessage(t, i18n.resolvedLanguage, 'positiveAmount')),
    minimumAmount: z.number({ error: amountMessage }).positive(getValidationMessage(t, i18n.resolvedLanguage, 'positiveAmount')),
  }).refine((value) => value.minimumAmount <= value.totalAmount, { path: ['minimumAmount'], message: t('payments.minimumTooHigh') })

  useEffect(() => {
    if (!open || !occurrence) return
    setTotalAmount(occurrence.totalAmount ? String(occurrence.totalAmount) : '')
    setMinimumAmount(occurrence.minimumAmount ? String(occurrence.minimumAmount) : '')
    setErrorMessage(null)
    validation.resetErrors()
  }, [occurrence, open, validation.resetErrors])

  const mutation = useMutation({
    mutationFn: async (payload: z.infer<typeof schema>) => {
      if (!occurrence) throw new Error('Missing payment occurrence')
      return financeApi.updateCardOccurrenceAmounts(occurrence.id, payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payment-occurrences'] })
      onOpenChange(false)
      toast.show(t('payments.amountConfigured'), { message: t('payments.canRecordPayment'), preset: 'success', duration: 3500 })
    },
    onError: () => setErrorMessage(t('payments.amountConfigError')),
  })

  const submit = () => {
    setErrorMessage(null)
    const payload = validation.validate(schema, { totalAmount: parseDecimalInput(totalAmount), minimumAmount: parseDecimalInput(minimumAmount) })
    if (payload) mutation.mutate(payload)
  }
  const closeSheet = useCallback(() => { if (!mutation.isPending) onOpenChange(false) }, [mutation.isPending, onOpenChange])
  useSheetBackHandler(open, closeSheet)

  return (
    <Sheet modal open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)} snapPoints={[54]} moveOnKeyboardChange zIndex={100_000}>
      <Sheet.Overlay bg="rgba(4,18,28,0.64)" />
      <Sheet.Handle bg="$color5" />
      <Sheet.Frame bg="$popover" px="$4" pt="$4" pb={Math.max(insets.bottom, 16)} rounded={18}>
        <YStack gap="$5" pb="$4">
          <YStack gap="$1"><Paragraph color="$color12" fontFamily="$heading" fontSize="$7" fontWeight="700">{t('payments.configureCard')}</Paragraph><Paragraph color="$color10">{occurrence?.title ?? ''}</Paragraph></YStack>
          <FintFormField label={t('payments.statementTotal')} required error={validation.errors.totalAmount}><FintInput width="100%" placeholder="0.00" value={totalAmount} onChangeText={(value) => { setTotalAmount(value); validation.clearError('totalAmount') }} keyboardType="decimal-pad" /></FintFormField>
          <FintFormField label={t('payments.minimumPayment')} required error={validation.errors.minimumAmount}><FintInput width="100%" placeholder="0.00" value={minimumAmount} onChangeText={(value) => { setMinimumAmount(value); validation.clearError('minimumAmount') }} keyboardType="decimal-pad" /></FintFormField>
          {errorMessage ? <Paragraph color="$red10">{errorMessage}</Paragraph> : null}
          <FintButton disabled={mutation.isPending} icon={mutation.isPending ? <Spinner color="$primaryForeground" /> : <Save size={18} />} onPress={submit}>{mutation.isPending ? t('payments.saving') : t('payments.saveAmounts')}</FintButton>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  )
}
