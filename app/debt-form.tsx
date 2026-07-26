import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Landmark, Save } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paragraph, ScrollView, Spinner, XStack, YStack } from 'tamagui'
import { z } from 'zod'
import { financeApi } from '../src/api/finance'
import { formatMoney, normalizeAccount, normalizeDebt, normalizeSummary } from '../src/api/mappers'
import { DataStateCard } from '../src/components/DataStateCard'
import { Screen } from '../src/components/Screen'
import { todayDateString } from '../src/finance/dates'
import { FintButton, FintDateField, FintInput } from '../src/ui'

const debtSchema = z.object({
  description: z.string().trim().min(2),
  amount: z.number().positive(),
  dueDate: z.string().date(),
  accountId: z.string().nullable(),
  note: z.string().trim().optional(),
})

export default function DebtFormScreen() {
  const { debtId } = useLocalSearchParams<{ debtId?: string }>()
  const isEditing = Boolean(debtId)
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToastController()
  const queryClient = useQueryClient()
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: financeApi.listAccounts, retry: false })
  const summaryQuery = useQuery({ queryKey: ['summary'], queryFn: financeApi.getSummary, retry: false })
  const debtsQuery = useQuery({ queryKey: ['debts'], queryFn: financeApi.listDebts, retry: false, enabled: isEditing })
  const accounts = (accountsQuery.data ?? []).map(normalizeAccount)
  const creditCards = accounts.filter((account) => account.accountType === 'credit_card')
  const summary = normalizeSummary(summaryQuery.data)
  const debt = (debtsQuery.data ?? []).map(normalizeDebt).find((item) => item.id === debtId)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(todayDateString)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [initializedDebtId, setInitializedDebtId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const selectedCard = creditCards.find((account) => account.id === accountId)
  const currency = selectedCard?.currency ?? debt?.currency ?? summary.currency

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
    mutationFn: async () => {
      setErrorMessage(null)
      const payload = debtSchema.parse({ description, amount: Number(amount), dueDate, accountId, note: note || undefined })
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

  const isLoading = accountsQuery.isLoading || summaryQuery.isLoading || (isEditing && debtsQuery.isLoading)
  const error = accountsQuery.error ?? summaryQuery.error ?? debtsQuery.error
  const notFound = isEditing && !debtsQuery.isLoading && !debtsQuery.error && !debt

  return (
    <>
      <Stack.Screen options={{ title: t(isEditing ? 'debts.editTitle' : 'debts.newTitle') }} />
      <Screen>
        {isLoading ? <DataStateCard message={t('states.loading')} /> : null}
        {error ? <DataStateCard message={error instanceof Error ? error.message : t('states.error')} /> : null}
        {notFound ? <DataStateCard message={t('states.debtNotFound')} /> : null}

        {!isLoading && !error && !notFound ? (
          <YStack gap="$5" pb="$5">
            <FormField label={t('forms.name')}>
              <FintInput width="100%" placeholder={t('debts.namePlaceholder')} value={description} onChangeText={setDescription} autoCapitalize="sentences" />
            </FormField>

            <FormField label={t('forms.amount')}>
              <FintInput width="100%" placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            </FormField>

            <FormField label={t('debts.dueDate')}><FintDateField label={t('debts.dueDate')} showLabel={false} placeholder={t('debts.selectDueDate')} value={dueDate} onValueChange={setDueDate} /></FormField>

            <FormField label={t('debts.creditCardOptional')}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                <CreditCardOption selected={accountId === null} title={t('debts.noCard')} subtitle={summary.currency} onPress={() => setAccountId(null)} />
                {creditCards.map((card) => (
                  <CreditCardOption
                    key={card.id}
                    selected={accountId === card.id}
                    title={card.name}
                    subtitle={`${card.currency} · ${formatMoney(card.balance, card.currency)}`}
                    onPress={() => setAccountId(card.id)}
                  />
                ))}
              </ScrollView>
              {creditCards.length === 0 ? <Paragraph color="$color10" fontSize="$1">{t('debts.noCreditCards')}</Paragraph> : null}
            </FormField>

            <FormField label={t('debts.noteOptional')}>
              <FintInput width="100%" placeholder={t('debts.notePlaceholder')} value={note} onChangeText={setNote} multiline minH={88} textAlignVertical="top" />
            </FormField>

            {errorMessage ? <XStack bg="$red2" borderColor="$red6" borderWidth={1} rounded="$5" p="$3"><Paragraph color="$red11" fontSize="$2">{errorMessage}</Paragraph></XStack> : null}
            <FintButton
              width="100%"
              height={50}
              disabled={mutation.isPending}
              icon={mutation.isPending ? <Spinner color="$primaryForeground" /> : isEditing ? <Save size={18} /> : <Landmark size={18} />}
              onPress={() => mutation.mutate()}
            >
              {mutation.isPending ? t(isEditing ? 'debts.updating' : 'debts.creating') : t(isEditing ? 'debts.update' : 'debts.create')}
            </FintButton>
          </YStack>
        ) : null}
      </Screen>
    </>
  )
}

function FormField({ children, label }: { children: React.ReactNode; label: string }) {
  return <YStack width="100%" gap="$2"><Paragraph color="$color10" fontSize="$2" fontWeight="600">{label}</Paragraph>{children}</YStack>
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
