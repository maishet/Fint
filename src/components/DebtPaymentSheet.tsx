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
import type { Account, Debt } from '../api/types'
import { FintButton, FintInput } from '../ui'
import { useSheetBackHandler } from '../hooks/useSheetBackHandler'

interface DebtPaymentSheetProps {
  accounts: Account[]
  debt: Debt | null
  onOpenChange: (open: boolean) => void
  open: boolean
}

export function DebtPaymentSheet({ accounts, debt, onOpenChange, open }: DebtPaymentSheetProps) {
  const { t } = useTranslation()
  const toast = useToastController()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const eligibleAccounts = debt ? accounts.filter((account) => account.accountType !== 'credit_card' && account.currency === debt.currency) : []
  const [amount, setAmount] = useState('')
  const [accountName, setAccountName] = useState('')
  const [note, setNote] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !debt) return
    setAmount(String(debt.outstanding))
    setAccountName(eligibleAccounts[0]?.name ?? '')
    setNote('')
    setErrorMessage(null)
  }, [debt, open])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!debt) throw new Error('Missing debt')
      const payload = z.object({ amount: z.number().positive().max(debt.outstanding), account: z.string().min(1), note: z.string().optional() }).parse({ amount: Number(amount), account: accountName, note: note || undefined })
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

            <YStack gap="$2">
              <Paragraph color="$color10" fontWeight="600">{t('forms.amount')}</Paragraph>
              <FintInput width="100%" placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            </YStack>

            <YStack gap="$2">
              <Paragraph color="$color10" fontWeight="600">{t('debts.paymentAccount')}</Paragraph>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {eligibleAccounts.map((account) => {
                  const selected = account.name === accountName
                  return (
                    <XStack key={account.id} width={180} minH={68} items="center" gap="$3" p="$3" rounded="$6" bg={selected ? '$secondary' : '$muted'} borderColor={selected ? '$primary' : '$input'} borderWidth={1} onPress={() => setAccountName(account.name)} role="button" cursor="pointer">
                      <Wallet size={20} color="$primary" />
                      <YStack flex={1} minW={0}>
                        <Paragraph color="$color12" fontWeight="700" numberOfLines={1}>{account.name}</Paragraph>
                        <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>{formatMoney(account.balance, account.currency)}</Paragraph>
                      </YStack>
                    </XStack>
                  )
                })}
              </ScrollView>
              {eligibleAccounts.length === 0 ? <Paragraph color="$red10">{t('debts.noPaymentAccounts')}</Paragraph> : null}
            </YStack>

            <FintInput width="100%" placeholder={t('debts.paymentNote')} value={note} onChangeText={setNote} />
            {errorMessage ? <Paragraph color="$red10">{errorMessage}</Paragraph> : null}
            <FintButton disabled={mutation.isPending || eligibleAccounts.length === 0} icon={mutation.isPending ? <Spinner color="$primaryForeground" /> : <CheckCircle2 size={18} />} onPress={() => mutation.mutate()}>
              {mutation.isPending ? t('debts.paying') : t('debts.confirmPayment')}
            </FintButton>
          </YStack>
        </Sheet.ScrollView>
      </Sheet.Frame>
    </Sheet>
  )
}
