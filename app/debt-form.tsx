import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CreditCard, FileText, Landmark, Save } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paragraph, ScrollView, Spinner, XStack, YStack } from 'tamagui'
import { z } from 'zod'
import { financeApi } from '../src/api/finance'
import { DataStateCard } from '../src/components/DataStateCard'
import { FormTextField, MovementAmountField, MovementNoteField, MovementPickerTrigger } from '../src/components/MovementFormControls'
import { Screen } from '../src/components/Screen'
import { SkeletonForm } from '../src/components/Skeleton'
import { todayDateString } from '../src/finance/dates'
import { getValidationMessage, parseDecimalInput, useSubmitValidation } from '../src/forms'
import { FintButton, FintCard, FintDateField, FintFormField } from '../src/ui'

export default function DebtFormScreen() {
  const { debtId } = useLocalSearchParams<{ debtId?: string }>()
  const isEditing = Boolean(debtId)
  const { i18n, t } = useTranslation()
  const router = useRouter()
  const toast = useToastController()
  const queryClient = useQueryClient()
  const accountsQuery = useQuery({ queryKey: ['account-options', 'credit-card'], queryFn: () => financeApi.listAccountOptions({ accountType: 'credit_card' }), retry: false })
  const optionsQuery = useQuery({ queryKey: ['finance-options'], queryFn: financeApi.getFinanceOptions, retry: false })
  const debtQuery = useQuery({ queryKey: ['debts', 'detail', debtId], queryFn: ({ signal }) => financeApi.getDebt(debtId!, signal), retry: false, enabled: isEditing })
  const creditCards = accountsQuery.data ?? []
  const debt = debtQuery.data
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(todayDateString)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [initializedDebtId, setInitializedDebtId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const validation = useSubmitValidation<'amount' | 'description' | 'dueDate'>()
  const amountMessage = getValidationMessage(t, i18n.resolvedLanguage, 'amount')
  const debtSchema = z.object({
    description: z.string().trim().min(2, getValidationMessage(t, i18n.resolvedLanguage, 'minTwo')),
    amount: z.number({ error: amountMessage }).positive(getValidationMessage(t, i18n.resolvedLanguage, 'positiveAmount')),
    dueDate: z.string().date(getValidationMessage(t, i18n.resolvedLanguage, 'date')),
    accountId: z.string().nullable(),
    note: z.string().trim().optional(),
  })
  const selectedCard = creditCards.find((account) => account.id === accountId)
  const currency = selectedCard?.currency ?? debt?.currency ?? optionsQuery.data?.baseCurrency ?? 'PEN'

  useEffect(() => {
    if (!debt || initializedDebtId === debt.id) return
    setDescription(debt.description)
    setAmount(String(debt.originalAmount))
    setDueDate(debt.dueDate ?? todayDateString())
    setAccountId(debt.accountId && creditCards.some((card) => card.id === debt.accountId) ? debt.accountId : null)
    setNote(debt.note ?? '')
    setInitializedDebtId(debt.id)
  }, [creditCards, debt, initializedDebtId])

  const mutation = useMutation({
    mutationFn: async (payload: z.infer<typeof debtSchema>) => {
      if (debtId) return financeApi.updateDebt(debtId, { description: payload.description, amount: payload.amount, dueDate: payload.dueDate, accountId: payload.accountId, note: payload.note ?? null })
      return financeApi.createDebt({ ...payload, currency })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['debts'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ])
      toast.show(t(isEditing ? 'debts.updatedToast' : 'debts.createdToast'), {
        message: t(isEditing ? 'debts.updatedMessage' : 'debts.createdMessage'),
        preset: 'success',
        duration: 3500,
      })
      router.back()
    },
    onError: () => setErrorMessage(t('debts.saveError')),
  })

  const submit = () => {
    setErrorMessage(null)
    const payload = validation.validate(debtSchema, { description, amount: parseDecimalInput(amount), dueDate, accountId, note: note || undefined })
    if (payload) mutation.mutate(payload)
  }

  const isLoading = accountsQuery.isLoading || optionsQuery.isLoading || (isEditing && debtQuery.isLoading)
  const error = accountsQuery.error ?? optionsQuery.error ?? debtQuery.error
  const notFound = isEditing && !debtQuery.isLoading && !debtQuery.error && !debt

  return (
    <>
      <Stack.Screen options={{ title: t(isEditing ? 'debts.editTitle' : 'debts.newTitle') }} />
      <Screen>
        {isLoading ? <SkeletonForm label={t('states.loading')} fieldCount={2} /> : null}
        {error ? <DataStateCard message={error instanceof Error ? error.message : t('states.error')} /> : null}
        {notFound ? <DataStateCard message={t('states.debtNotFound')} /> : null}

        {!isLoading && !error && !notFound ? (
          <YStack gap="$5" pb="$5">
            <FormTextField label={t('forms.name')} required error={validation.errors.description} icon={<FileText size={21} color="$primary" />} placeholder={t('debts.namePlaceholder')} value={description} onChangeText={(value) => { setDescription(value); validation.clearError('description') }} />

            <MovementAmountField currency={currency} error={validation.errors.amount} value={amount} onChangeText={(value) => { setAmount(value); validation.clearError('amount') }} />

            <FintFormField label={t('debts.dueDate')} required error={validation.errors.dueDate} showLabel={false}><FintDateField label={t('debts.dueDate')} showLabel={false} placeholder={t('debts.selectDueDate')} value={dueDate} onValueChange={(value) => { setDueDate(value); validation.clearError('dueDate') }} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<CalendarDays size={21} color="$primary" />} invalid={Boolean(validation.errors.dueDate)} label={t('debts.dueDate')} required onPress={onPress} value={selectedLabel} />} /></FintFormField>

            <FintFormField label={t('debts.creditCardOptional')} showLabel={false}>
              <FintCard gap="$3" p="$3">
                <Paragraph color="$color10" fontSize="$1" fontWeight="600">{t('debts.creditCardOptional')}</Paragraph>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  <CreditCardOption selected={accountId === null} title={t('debts.noCard')} subtitle={optionsQuery.data?.baseCurrency ?? 'PEN'} onPress={() => setAccountId(null)} />
                  {creditCards.map((card) => (
                    <CreditCardOption key={card.id} selected={accountId === card.id} title={card.name} subtitle={card.currency} onPress={() => setAccountId(card.id)} />
                  ))}
                </ScrollView>
                {creditCards.length === 0 ? <Paragraph color="$color10" fontSize="$1">{t('debts.noCreditCards')}</Paragraph> : null}
              </FintCard>
            </FintFormField>

            <MovementNoteField label={t('debts.noteOptional')} placeholder={t('debts.notePlaceholder')} value={note} onChangeText={setNote} />

            {errorMessage ? <XStack bg="$red2" borderColor="$red6" borderWidth={1} rounded="$5" p="$3"><Paragraph color="$red11" fontSize="$2">{errorMessage}</Paragraph></XStack> : null}
            <YStack gap="$2">
              <FintButton width="100%" minH={52} disabled={mutation.isPending} icon={mutation.isPending ? <Spinner color="$primaryForeground" /> : isEditing ? <Save size={18} /> : <Landmark size={18} />} onPress={submit}>
                {mutation.isPending ? t(isEditing ? 'debts.updating' : 'debts.creating') : t(isEditing ? 'debts.update' : 'debts.create')}
              </FintButton>
              <FintButton width="100%" minH={48} variant="outlined" disabled={mutation.isPending} onPress={() => router.back()}>{t('actions.cancel')}</FintButton>
            </YStack>
          </YStack>
        ) : null}
      </Screen>
    </>
  )
}

function CreditCardOption({ onPress, selected, subtitle, title }: { onPress: () => void; selected: boolean; subtitle: string; title: string }) {
  return (
    <XStack
      width={184}
      minH={74}
      items="center"
      gap="$3"
      p="$3"
      rounded="$6"
      bg={selected ? '$secondary' : '$muted'}
      borderColor={selected ? '$primary' : '$input'}
      borderWidth={1}
      pressStyle={{ opacity: 0.82 }}
      role="button"
      cursor="pointer"
      onPress={onPress}
    >
      <YStack width={34} height={34} rounded="$8" bg={selected ? '$primary' : '$card'} items="center" justify="center">
        <CreditCard size={18} color={selected ? '$primaryForeground' : '$primary'} />
      </YStack>
      <YStack flex={1} minW={0} gap="$1">
        <Paragraph color="$color12" fontWeight="700" numberOfLines={1}>{title}</Paragraph>
        <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>{subtitle}</Paragraph>
      </YStack>
    </XStack>
  )
}
