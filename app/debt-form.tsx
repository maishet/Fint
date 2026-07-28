import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Landmark, Save } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paragraph, ScrollView, Spinner, XStack, YStack } from 'tamagui'
import { z } from 'zod'
import { financeApi } from '../src/api/finance'
import { DataStateCard } from '../src/components/DataStateCard'
import { Screen } from '../src/components/Screen'
import { todayDateString } from '../src/finance/dates'
import { getValidationMessage, parseDecimalInput, useSubmitValidation } from '../src/forms'
import { FintButton, FintDateField, FintFormField, FintInput } from '../src/ui'

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
        {isLoading ? <DataStateCard message={t('states.loading')} /> : null}
        {error ? <DataStateCard message={error instanceof Error ? error.message : t('states.error')} /> : null}
        {notFound ? <DataStateCard message={t('states.debtNotFound')} /> : null}

        {!isLoading && !error && !notFound ? (
          <YStack gap="$5" pb="$5">
            <FintFormField label={t('forms.name')} required error={validation.errors.description}>
              <FintInput width="100%" borderColor={validation.errors.description ? '$red8' : undefined} placeholder={t('debts.namePlaceholder')} value={description} onChangeText={(value) => { setDescription(value); validation.clearError('description') }} autoCapitalize="sentences" />
            </FintFormField>

            <FintFormField label={t('forms.amount')} required error={validation.errors.amount}>
              <FintInput width="100%" borderColor={validation.errors.amount ? '$red8' : undefined} placeholder="0.00" value={amount} onChangeText={(value) => { setAmount(value); validation.clearError('amount') }} keyboardType="decimal-pad" />
            </FintFormField>

            <FintFormField label={t('debts.dueDate')} required error={validation.errors.dueDate}><FintDateField borderColor={validation.errors.dueDate ? '$red8' : undefined} label={t('debts.dueDate')} showLabel={false} placeholder={t('debts.selectDueDate')} value={dueDate} onValueChange={(value) => { setDueDate(value); validation.clearError('dueDate') }} /></FintFormField>

            <FintFormField label={t('debts.creditCardOptional')}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                <CreditCardOption selected={accountId === null} title={t('debts.noCard')} subtitle={optionsQuery.data?.baseCurrency ?? 'PEN'} onPress={() => setAccountId(null)} />
                {creditCards.map((card) => (
                  <CreditCardOption
                    key={card.id}
                    selected={accountId === card.id}
                    title={card.name}
                    subtitle={card.currency}
                    onPress={() => setAccountId(card.id)}
                  />
                ))}
              </ScrollView>
              {creditCards.length === 0 ? <Paragraph color="$color10" fontSize="$1">{t('debts.noCreditCards')}</Paragraph> : null}
            </FintFormField>

            <FintFormField label={t('debts.noteOptional')}>
              <FintInput width="100%" placeholder={t('debts.notePlaceholder')} value={note} onChangeText={setNote} multiline minH={88} textAlignVertical="top" />
            </FintFormField>

            {errorMessage ? <XStack bg="$red2" borderColor="$red6" borderWidth={1} rounded="$5" p="$3"><Paragraph color="$red11" fontSize="$2">{errorMessage}</Paragraph></XStack> : null}
            <FintButton
              width="100%"
              height={50}
              disabled={mutation.isPending}
              icon={mutation.isPending ? <Spinner color="$primaryForeground" /> : isEditing ? <Save size={18} /> : <Landmark size={18} />}
              onPress={submit}
            >
              {mutation.isPending ? t(isEditing ? 'debts.updating' : 'debts.creating') : t(isEditing ? 'debts.update' : 'debts.create')}
            </FintButton>
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
