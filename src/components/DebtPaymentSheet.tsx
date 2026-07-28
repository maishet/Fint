import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Wallet } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Paragraph, ScrollView, Sheet, Spinner, XStack, YStack } from 'tamagui'
import { z } from 'zod'
import { financeApi } from '../api/finance'
import { formatMoney } from '../api/mappers'
import type { AccountOption, Debt } from '../api/types'
import { getValidationMessage, parseDecimalInput, useSubmitValidation } from '../forms'
import { FintButton, FintFormField, FintInput } from '../ui'
import { useSheetBackHandler } from '../hooks/useSheetBackHandler'

interface DebtPaymentSheetProps {
  accounts: AccountOption[]
  debt: Debt | null
  onOpenChange: (open: boolean) => void
  open: boolean
}

export function DebtPaymentSheet({ accounts, debt, onOpenChange, open }: DebtPaymentSheetProps) {
  const { i18n, t } = useTranslation()
  const toast = useToastController()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const eligibleAccounts = debt ? accounts.filter((account) => account.currency === debt.currency) : []
  const [amount, setAmount] = useState('')
  const [accountName, setAccountName] = useState('')
  const [note, setNote] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const validation = useSubmitValidation<'account' | 'amount'>()
  const amountMessage = getValidationMessage(t, i18n.resolvedLanguage, 'amount')
  const paymentSchema = z.object({
    amount: z.number({ error: amountMessage })
      .positive(getValidationMessage(t, i18n.resolvedLanguage, 'positiveAmount'))
      .max(debt?.outstanding ?? 0, getValidationMessage(t, i18n.resolvedLanguage, 'maxAmount')),
    account: z.string().min(1, getValidationMessage(t, i18n.resolvedLanguage, 'required')),
    note: z.string().trim().optional(),
  })

  useEffect(() => {
    if (!open || !debt) return
    setAmount(String(debt.outstanding))
    setAccountName(eligibleAccounts[0]?.name ?? '')
    setNote('')
    setErrorMessage(null)
    validation.resetErrors()
  }, [debt, open, validation.resetErrors])

  const mutation = useMutation({
    mutationFn: async (payload: z.infer<typeof paymentSchema>) => {
      if (!debt) throw new Error('Missing debt')
      return financeApi.payDebt(debt.id, { ...payload, currency: debt.currency })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['debts'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ])
      onOpenChange(false)
      toast.show(t('debts.paymentCreated'), { message: t('debts.paymentCreatedMessage'), preset: 'success', duration: 3500 })
    },
    onError: () => setErrorMessage(t('debts.paymentError')),
  })

  const submit = () => {
    setErrorMessage(null)
    const payload = validation.validate(paymentSchema, { amount: parseDecimalInput(amount), account: accountName, note: note || undefined })
    if (payload) mutation.mutate(payload)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && mutation.isPending) return
    onOpenChange(nextOpen)
  }
  const closeSheet = useCallback(() => {
    if (!mutation.isPending) onOpenChange(false)
  }, [mutation.isPending, onOpenChange])
  useSheetBackHandler(open, closeSheet)

  return (
    <Sheet modal open={open} onOpenChange={handleOpenChange} snapPoints={[68]} moveOnKeyboardChange zIndex={100_000}>
      <Sheet.Overlay bg="rgba(4,18,28,0.64)" />
      <Sheet.Handle bg="$color5" />
      <Sheet.Frame bg="$popover" px="$4" pt="$4" pb={Math.max(insets.bottom, 16)} rounded={18}>
        <Sheet.ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <YStack gap="$5" pb="$4">
            <YStack gap="$1">
              <Paragraph color="$color12" fontFamily="$heading" fontSize="$7" fontWeight="700">{t('debts.registerPayment')}</Paragraph>
              <Paragraph color="$color10">{debt ? `${debt.description} · ${formatMoney(debt.outstanding, debt.currency)}` : ''}</Paragraph>
            </YStack>

            <FintFormField label={t('forms.amount')} required error={validation.errors.amount}>
              <FintInput width="100%" borderColor={validation.errors.amount ? '$red8' : undefined} placeholder="0.00" value={amount} onChangeText={(value) => { setAmount(value); validation.clearError('amount') }} keyboardType="decimal-pad" />
            </FintFormField>

            <FintFormField label={t('debts.paymentAccount')} required error={validation.errors.account} invalidBorder>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {eligibleAccounts.map((account) => {
                  const selected = account.name === accountName
                  return (
                    <XStack key={account.id} width={180} minH={68} items="center" gap="$3" p="$3" rounded="$6" bg={selected ? '$secondary' : '$muted'} borderColor={selected ? '$primary' : '$input'} borderWidth={1} onPress={() => { setAccountName(account.name); validation.clearError('account') }} role="button" cursor="pointer">
                      <Wallet size={20} color="$primary" />
                      <YStack flex={1} minW={0}>
                        <Paragraph color="$color12" fontWeight="700" numberOfLines={1}>{account.name}</Paragraph>
                        <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>{account.currency}</Paragraph>
                      </YStack>
                    </XStack>
                  )
                })}
              </ScrollView>
              {eligibleAccounts.length === 0 ? <Paragraph color="$red10">{t('debts.noPaymentAccounts')}</Paragraph> : null}
            </FintFormField>

            <FintFormField label={t('debts.paymentNote')}><FintInput width="100%" placeholder={t('debts.paymentNote')} value={note} onChangeText={setNote} /></FintFormField>
            {errorMessage ? <Paragraph color="$red10">{errorMessage}</Paragraph> : null}
            <FintButton disabled={mutation.isPending || eligibleAccounts.length === 0} icon={mutation.isPending ? <Spinner color="$primaryForeground" /> : <CheckCircle2 size={18} />} onPress={submit}>
              {mutation.isPending ? t('debts.paying') : t('debts.confirmPayment')}
            </FintButton>
          </YStack>
        </Sheet.ScrollView>
      </Sheet.Frame>
    </Sheet>
  )
}
