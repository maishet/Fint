import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Wallet } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Paragraph, ScrollView, Sheet, XStack, YStack } from 'tamagui'
import { z } from 'zod'
import { financeApi } from '../api/finance'
import { formatMoney } from '../api/mappers'
import type { AccountOption, PaymentOccurrence } from '../api/types'
import { todayDateString } from '../finance/dates'
import { getValidationMessage, parseDecimalInput, useSubmitValidation } from '../forms'
import { useSheetBackHandler } from '../hooks/useSheetBackHandler'
import { getInstallationId } from '../notifications/pushNotifications'
import { FintButton, FintDateField, FintFormField, FintInput, FintSpinner } from '../ui'
import { MovementPickerTrigger } from './MovementFormControls'

export function OccurrencePaymentSheet({ accounts, occurrence, onOpenChange, open }: { accounts: AccountOption[]; occurrence: PaymentOccurrence | null; onOpenChange: (open: boolean) => void; open: boolean }) {
  const { i18n, t } = useTranslation()
  const toast = useToastController()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const eligibleAccounts = occurrence ? accounts.filter((account) => account.currency === occurrence.currency) : []
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [transactionDate, setTransactionDate] = useState(todayDateString)
  const [note, setNote] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const validation = useSubmitValidation<'accountId' | 'amount' | 'transactionDate'>()
  const maxAmount = occurrence?.remainingAmount ?? 0
  const amountMessage = getValidationMessage(t, i18n.resolvedLanguage, 'amount')
  const paymentSchema = z.object({
    amount: z.number({ error: amountMessage }).positive(getValidationMessage(t, i18n.resolvedLanguage, 'positiveAmount')).max(maxAmount, getValidationMessage(t, i18n.resolvedLanguage, 'maxAmount')),
    accountId: z.string().uuid(getValidationMessage(t, i18n.resolvedLanguage, 'required')),
    transactionDate: z.string().date(getValidationMessage(t, i18n.resolvedLanguage, 'date')),
    note: z.string().trim().optional(),
  })

  useEffect(() => {
    if (!open || !occurrence) return
    setAmount(String(occurrence.remainingAmount ?? 0))
    setAccountId(eligibleAccounts[0]?.id ?? '')
    setTransactionDate(todayDateString())
    setNote('')
    setErrorMessage(null)
    validation.resetErrors()
  }, [occurrence, open, validation.resetErrors])

  const mutation = useMutation({
    mutationFn: async (payload: z.infer<typeof paymentSchema>) => {
      if (!occurrence) throw new Error('Missing payment occurrence')
      return financeApi.payPaymentOccurrence(occurrence.id, { ...payload, originInstallationId: await getInstallationId() })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payment-occurrences'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ])
      onOpenChange(false)
      toast.show(t('payments.paymentRecorded'), { message: t('payments.occurrenceUpdated'), preset: 'success', duration: 3500 })
    },
    onError: () => setErrorMessage(t('payments.paymentError')),
  })

  const submit = () => {
    setErrorMessage(null)
    const payload = validation.validate(paymentSchema, { amount: parseDecimalInput(amount), accountId, transactionDate, note: note || undefined })
    if (payload) mutation.mutate(payload)
  }
  const closeSheet = useCallback(() => { if (!mutation.isPending) onOpenChange(false) }, [mutation.isPending, onOpenChange])
  useSheetBackHandler(open, closeSheet)

  return (
    <Sheet modal open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)} snapPoints={[76]} moveOnKeyboardChange zIndex={100_000}>
      <Sheet.Overlay bg="rgba(4,18,28,0.64)" />
      <Sheet.Handle bg="$color5" />
      <Sheet.Frame bg="$popover" px="$4" pt="$4" pb={Math.max(insets.bottom, 16)} rounded={18}>
        <Sheet.ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <YStack gap="$5" pb="$4">
            <YStack gap="$1"><Paragraph color="$color12" fontFamily="$heading" fontSize="$7" fontWeight="700">{t('payments.registerPayment')}</Paragraph><Paragraph color="$color10">{occurrence ? `${occurrence.title} · ${formatMoney(occurrence.remainingAmount ?? 0, occurrence.currency)}` : ''}</Paragraph></YStack>
            <FintFormField label={t('forms.amount')} required error={validation.errors.amount}><FintInput width="100%" borderColor={validation.errors.amount ? '$red8' : undefined} placeholder="0.00" value={amount} onChangeText={(value) => { setAmount(value); validation.clearError('amount') }} keyboardType="decimal-pad" /></FintFormField>
            <FintFormField label={t('payments.paymentDate')} required error={validation.errors.transactionDate} showLabel={false}><FintDateField label={t('payments.paymentDate')} showLabel={false} placeholder={t('payments.selectDate')} value={transactionDate} onValueChange={(value) => { setTransactionDate(value); validation.clearError('transactionDate') }} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<CheckCircle2 size={21} color="$primary" />} invalid={Boolean(validation.errors.transactionDate)} label={t('payments.paymentDate')} required onPress={onPress} value={selectedLabel} />} /></FintFormField>
            <FintFormField label={t('payments.paymentAccount')} required error={validation.errors.accountId} invalidBorder>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>{eligibleAccounts.map((account) => <XStack key={account.id} width={180} minH={68} items="center" gap="$3" p="$3" rounded="$6" bg={account.id === accountId ? '$secondary' : '$muted'} borderColor={account.id === accountId ? '$primary' : '$input'} borderWidth={1} onPress={() => { setAccountId(account.id); validation.clearError('accountId') }} role="button" cursor="pointer"><Wallet size={20} color="$primary" /><YStack flex={1} minW={0}><Paragraph color="$color12" fontWeight="700" numberOfLines={1}>{account.name}</Paragraph><Paragraph color="$color10" fontSize="$1" numberOfLines={1}>{account.currency}</Paragraph></YStack></XStack>)}</ScrollView>
              {eligibleAccounts.length === 0 ? <Paragraph color="$red10">{t('payments.noAccountsForCurrency')}</Paragraph> : null}
            </FintFormField>
            <FintFormField label={t('payments.note')}><FintInput width="100%" placeholder={t('payments.noteOptionalPlaceholder')} value={note} onChangeText={setNote} /></FintFormField>
            {errorMessage ? <Paragraph color="$red10">{errorMessage}</Paragraph> : null}
            <FintButton disabled={mutation.isPending || eligibleAccounts.length === 0} icon={mutation.isPending ? <FintSpinner color="$primaryForeground" /> : <CheckCircle2 size={18} />} onPress={submit}>{mutation.isPending ? t('payments.registering') : t('payments.confirmPayment')}</FintButton>
          </YStack>
        </Sheet.ScrollView>
      </Sheet.Frame>
    </Sheet>
  )
}
