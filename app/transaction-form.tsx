import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Save, Shapes, WalletCards } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paragraph, Spinner, YStack } from 'tamagui'
import { z } from 'zod'
import { financeApi } from '../src/api/finance'
import { Screen } from '../src/components/Screen'
import { SkeletonForm } from '../src/components/Skeleton'
import { CategoryPickerSheet } from '../src/components/CategoryPickerSheet'
import { MovementAmountField, MovementNoteField, MovementPickerTrigger, MovementTypeSelector } from '../src/components/MovementFormControls'
import { todayDateString } from '../src/finance/dates'
import { getValidationMessage, parseDecimalInput, useSubmitValidation } from '../src/forms'
import { FintButton, FintDateField, FintFormField, FintSheetSelect } from '../src/ui'

export default function TransactionFormScreen() {
  const router = useRouter()
  const { i18n, t } = useTranslation()
  const params = useLocalSearchParams<{ id?: string; type?: 'income' | 'expense'; amount?: string; category?: string; account?: string; note?: string; date?: string }>()
  const toast = useToastController()
  const queryClient = useQueryClient()
  const isEditing = Boolean(params.id)
  const [type, setType] = useState<'income' | 'expense'>(params.type === 'income' ? 'income' : 'expense')
  const [amount, setAmount] = useState(params.amount ?? '')
  const [category, setCategory] = useState(params.category ?? '')
  const [account, setAccount] = useState(params.account ?? '')
  const [note, setNote] = useState(params.note ?? '')
  const [transactionDate, setTransactionDate] = useState(params.date ?? todayDateString)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const validation = useSubmitValidation<'account' | 'amount' | 'category' | 'transactionDate'>()
  const accountsQuery = useQuery({ queryKey: ['account-options'], queryFn: () => financeApi.listAccountOptions(), retry: false })
  const categoriesQuery = useQuery({ queryKey: ['categories', type], queryFn: () => financeApi.listCategories(type), retry: false })
  const accounts = accountsQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const selectedAccount = accounts.find((item) => item.name === account)
  const requiredMessage = getValidationMessage(t, i18n.resolvedLanguage, 'required')
  const amountMessage = getValidationMessage(t, i18n.resolvedLanguage, 'amount')
  const transactionSchema = z.object({
    type: z.union([z.literal('income'), z.literal('expense')]),
    amount: z.number({ error: amountMessage }).positive(getValidationMessage(t, i18n.resolvedLanguage, 'positiveAmount')),
    category: z.string().min(1, requiredMessage).refine((value) => categories.some((item) => item.name === value), requiredMessage),
    account: z.string().min(1, requiredMessage).refine((value) => accounts.some((item) => item.name === value), requiredMessage),
    note: z.string().optional(),
    transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, getValidationMessage(t, i18n.resolvedLanguage, 'date')),
  })

  useEffect(() => {
    if (!account && accounts[0]) setAccount(accounts[0].name)
  }, [account, accounts])

  useEffect(() => {
    if (category && !categories.some((item) => item.name === category)) setCategory('')
  }, [categories, category])

  const mutation = useMutation({
    mutationFn: async (validated: z.infer<typeof transactionSchema>) => {
      const accountCurrency = accounts.find((item) => item.name === validated.account)?.currency
      if (!accountCurrency) throw new Error(t('movements.referencesError'))
      const payload = { ...validated, currency: accountCurrency }
      if (params.id) return financeApi.updateTransaction(params.id, { ...payload, transactionDate })
      return financeApi.createTransaction(payload)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ])
      toast.show(t(isEditing ? 'movementUx.updatedToast' : 'movements.createdToast'), { message: t(isEditing ? 'movementUx.updatedMessage' : 'movements.createdMessage'), preset: 'success' })
      router.back()
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : t('states.error')),
  })

  const submit = () => {
    setErrorMessage(null)
    const payload = validation.validate(transactionSchema, {
      type,
      amount: parseDecimalInput(amount),
      category,
      account,
      note: note.trim() || undefined,
      transactionDate,
    })
    if (payload) mutation.mutate(payload)
  }

  const isReferenceLoading = accountsQuery.isLoading || categoriesQuery.isLoading

  return (
    <>
    <Stack.Screen options={{ title: t(isEditing ? 'movementUx.editTitle' : type === 'income' ? 'movementUx.newIncomeTitle' : 'movementUx.newExpenseTitle') }} />
    <Screen>
      {isReferenceLoading ? <SkeletonForm label={t('movements.loadingReferences')} showSegment fieldCount={3} /> : <YStack gap="$5" pb="$5">
        <MovementTypeSelector value={type} onValueChange={(value) => { setType(value); setErrorMessage(null); validation.clearError('category') }} />

        <MovementAmountField currency={selectedAccount?.currency ?? 'PEN'} error={validation.errors.amount} value={amount} onChangeText={(value) => { setAmount(value); validation.clearError('amount') }} />

        <FintFormField label={t('forms.account')} required error={validation.errors.account} showLabel={false}>
          <FintSheetSelect label={t('forms.account')} showLabel={false} placeholder={t('movements.selectAccount')} value={account} onValueChange={(value) => { setAccount(value); validation.clearError('account') }} options={accounts.map((item) => ({ value: item.name, label: `${item.name} · ${item.currency}` }))} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<WalletCards size={21} color="$primary" />} invalid={Boolean(validation.errors.account)} label={t('forms.account')} required onPress={onPress} value={selectedLabel} />} />
        </FintFormField>

        <FintFormField label={t('forms.category')} required error={validation.errors.category} showLabel={false}>
          <CategoryPickerSheet categories={categories} showLabel={false} type={type} value={category} onValueChange={(value) => { setCategory(value); validation.clearError('category') }} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<Shapes size={21} color="$primary" />} invalid={Boolean(validation.errors.category)} label={t('forms.category')} required onPress={onPress} value={selectedLabel} />} />
        </FintFormField>

        <FintFormField label={t('movements.date')} required error={validation.errors.transactionDate} showLabel={false}>
          <FintDateField label={t('movements.date')} showLabel={false} placeholder={t('movements.selectDate')} value={transactionDate} onValueChange={(value) => { setTransactionDate(value); validation.clearError('transactionDate') }} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<CalendarDays size={21} color="$primary" />} invalid={Boolean(validation.errors.transactionDate)} label={t('movements.date')} required onPress={onPress} value={selectedLabel} />} />
        </FintFormField>
        <MovementNoteField label={t('movementUx.noteOptional')} placeholder={t('movementUx.notePlaceholder')} value={note} onChangeText={setNote} />

        {!accountsQuery.isLoading && accounts.length === 0 ? (
          <YStack bg="$secondary" gap="$2" p="$3" rounded="$5">
            <Paragraph color="$color12" fontWeight="700">{t('movements.noAccounts')}</Paragraph>
            <FintButton size="$3" variant="outlined" onPress={() => router.push('/account-form')}>{t('actions.newAccount')}</FintButton>
          </YStack>
        ) : null}
        {!categoriesQuery.isLoading && categories.length === 0 ? (
          <YStack bg="$secondary" gap="$2" p="$3" rounded="$5">
            <Paragraph color="$color12" fontWeight="700">{t('movements.noCategories')}</Paragraph>
            <FintButton size="$3" variant="outlined" onPress={() => router.push('/categories')}>{t('categories.newAction')}</FintButton>
          </YStack>
        ) : null}
        {accountsQuery.error || categoriesQuery.error ? <Paragraph color="$red10">{t('movements.referencesError')}</Paragraph> : null}
        {errorMessage ? <Paragraph color="$red10">{errorMessage}</Paragraph> : null}

        <YStack gap="$2">
          <FintButton width="100%" minH={52} disabled={mutation.isPending || isReferenceLoading} icon={mutation.isPending ? <Spinner color="$primaryForeground" /> : <Save size={18} />} onPress={submit}>
            {mutation.isPending ? t(isEditing ? 'movementUx.updating' : 'movements.creating') : isEditing ? t('actions.save') : t(type === 'income' ? 'movementUx.registerIncome' : 'movementUx.registerExpense')}
          </FintButton>
          <FintButton width="100%" minH={48} variant="outlined" disabled={mutation.isPending} onPress={() => router.back()}>{t('actions.cancel')}</FintButton>
        </YStack>
      </YStack>}
    </Screen>
    </>
  )
}
