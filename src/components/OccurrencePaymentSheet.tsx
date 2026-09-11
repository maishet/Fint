import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Check, CheckCircle2, FilePenLine } from '@tamagui/lucide-icons-2'
import { useNotify } from '../ui/notify'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Input, Paragraph, Sheet, XStack, YStack } from 'tamagui'
import { z } from 'zod'
import { financeApi } from '../api/finance'
import { formatMoney } from '../api/mappers'
import type { AccountOption, PaymentOccurrence } from '../api/types'
import { getAccountIcon, getAccountTypeLabel } from '../finance/accountTypes'
import { useAccountDetails } from '../finance/useAccountDetails'
import { todayDateString } from '../finance/dates'
import { useSensitiveMoney } from '../privacy/useSensitiveMoney'
import { getValidationMessage, parseDecimalInput, useSubmitValidation } from '../forms'
import { useSheetBackHandler } from '../hooks/useSheetBackHandler'
import { getInstallationId } from '../notifications/pushNotifications'
import { FintButton, FintDateField, FintSpinner } from '../ui'
import { MovementAmountField } from './MovementFormControls'
import { FintListGroup, FintListRow } from './FintListGroup'

export function OccurrencePaymentSheet({ accounts, occurrence, onOpenChange, open }: { accounts: AccountOption[]; occurrence: PaymentOccurrence | null; onOpenChange: (open: boolean) => void; open: boolean }) {
  const { i18n, t } = useTranslation()
  const toast = useNotify()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const { formatSensitiveAmount } = useSensitiveMoney()
  const accountDetails = useAccountDetails()
  const eligibleAccounts = occurrence ? accounts.filter((account) => account.currency === occurrence.currency) : []
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [transactionDate, setTransactionDate] = useState(() => todayDateString())
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
    setAccountId('')
    setTransactionDate(todayDateString())
    setNote('')
    setErrorMessage(null)
    validation.resetErrors()
  }, [occurrence, open, validation.resetErrors])

  useEffect(() => {
    if (!open || accountId) return
    const first = eligibleAccounts[0]?.id
    if (first) setAccountId(first)
  }, [open, accountId, eligibleAccounts])

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
    <Sheet modal open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)} snapPoints={[76]} dismissOnSnapToBottom moveOnKeyboardChange zIndex={100_000}>
      <Sheet.Overlay bg="rgba(4,18,28,0.64)" />
      <Sheet.Handle bg="$color5" />
      <Sheet.Frame bg="$popover" px="$4" pt="$4" pb={Math.max(insets.bottom, 16)} rounded={18}>
        <Sheet.ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <YStack gap="$5" pb="$4">
            <YStack gap="$1"><Paragraph color="$color12" fontFamily="$heading" fontSize="$7" fontWeight="600">{t('payments.registerPayment')}</Paragraph><Paragraph color="$color10">{occurrence?.title ?? ''}</Paragraph></YStack>

            {/* El mismo campo que el formulario de movimiento: aquí era un input plano. */}
            <MovementAmountField
              currency={occurrence?.currency ?? 'PEN'}
              error={validation.errors.amount}
              helperText={occurrence ? t('payments.maxAmountHint', { amount: formatMoney(occurrence.remainingAmount ?? 0, occurrence.currency) }) : undefined}
              value={amount}
              onChangeText={(value) => { setAmount(value); validation.clearError('amount') }}
            />

            {/*
              Lista vertical con check en vez del carrusel horizontal: el
              carrusel escondía cuántas cuentas elegibles había.
            */}
            <YStack gap="$2">
              <Paragraph color="$color10" fontSize="$2" fontWeight="600" px="$1">{t('payments.paymentAccount')} *</Paragraph>
              <FintListGroup invalid={Boolean(validation.errors.accountId)}>
                {eligibleAccounts.map((account) => {
                  // Con qué cuenta pagar depende del saldo, así que se ve aquí
                  // mismo, con el glifo de su tipo — rojo si está en negativo.
                  const { accountType, balance } = accountDetails(account)
                  const Icon = getAccountIcon(accountType ?? '')
                  const isSelected = account.id === accountId
                  const isNegative = (balance ?? 0) < 0
                  return (
                    <XStack
                      key={account.id}
                      minH={64}
                      items="center"
                      gap="$3"
                      px={14}
                      py="$2"
                      bg="transparent"
                      cursor="pointer"
                      role="button"
                      aria-selected={isSelected}
                      transition="quick"
                      pressStyle={{ bg: '$secondary' }}
                      onPress={() => { setAccountId(account.id); validation.clearError('accountId') }}
                      aria-label={`${account.name} · ${account.currency}`}
                    >
                      <YStack
                        width={34}
                        height={34}
                        rounded="$10"
                        bg={isNegative ? '$red2' : '$secondary'}
                        items="center"
                        justify="center"
                        shrink={0}
                      >
                        <Icon size={17} color={isNegative ? '$red10' : '$primary'} />
                      </YStack>
                      <YStack flex={1} minW={0} gap={2}>
                        <Paragraph color="$color12" fontSize="$3" fontWeight="600" numberOfLines={1}>{account.name}</Paragraph>
                        <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>
                          {accountType ? `${getAccountTypeLabel(accountType, t)} · ${account.currency}` : account.currency}
                        </Paragraph>
                      </YStack>
                      {balance == null ? null : (
                        <Paragraph color={isNegative ? '$red11' : '$color10'} fontSize="$1" fontWeight="600" shrink={0}>
                          {formatSensitiveAmount(balance, account.currency)}
                        </Paragraph>
                      )}
                      {isSelected ? <Check size={20} color="$primary" /> : <YStack width={20} />}
                    </XStack>
                  )
                })}
              </FintListGroup>
              {validation.errors.accountId ? <Paragraph color="$red10" fontSize="$1" fontWeight="600" px="$1">{validation.errors.accountId}</Paragraph> : null}
              {eligibleAccounts.length === 0 ? <Paragraph color="$red10" fontSize="$1">{t('payments.noAccountsForCurrency')}</Paragraph> : null}
            </YStack>

            <YStack gap="$2">
              <FintListGroup invalid={Boolean(validation.errors.transactionDate)}>
                <FintDateField label={t('payments.paymentDate')} showLabel={false} placeholder={t('payments.selectDate')} value={transactionDate} maxDate={todayDateString()} onValueChange={(value) => { setTransactionDate(value); validation.clearError('transactionDate') }} renderTrigger={({ onPress, selectedLabel }) => <FintListRow icon={<CalendarDays size={22} color="$primary" />} label={t('payments.paymentDate')} required onPress={onPress} value={selectedLabel} />} />
                <FintListRow
                  icon={<FilePenLine size={22} color="$primary" />}
                  label={t('payments.note')}
                  valueSlot={
                    <Input
                      unstyled
                      width="100%"
                      height={22}
                      minH={22}
                      p={0}
                      m={0}
                      color="$color12"
                      fontFamily="$body"
                      fontSize="$3"
                      fontWeight="600"
                      placeholder={t('payments.noteOptionalPlaceholder')}
                      placeholderTextColor="$color10"
                      value={note}
                      onChangeText={setNote}
                      aria-label={t('payments.note')}
                    />
                  }
                />
              </FintListGroup>
              {validation.errors.transactionDate ? <Paragraph color="$red10" fontSize="$1" fontWeight="600" px="$1">{validation.errors.transactionDate}</Paragraph> : null}
            </YStack>

            {errorMessage ? <Paragraph color="$red10">{errorMessage}</Paragraph> : null}
            <FintButton minH={52} disabled={mutation.isPending || eligibleAccounts.length === 0} icon={mutation.isPending ? <FintSpinner color="$primaryForeground" /> : <CheckCircle2 size={18} />} onPress={submit}>{mutation.isPending ? t('payments.registering') : t('payments.confirmPayment')}</FintButton>
          </YStack>
        </Sheet.ScrollView>
      </Sheet.Frame>
    </Sheet>
  )
}
