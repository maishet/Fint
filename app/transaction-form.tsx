import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Save } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paragraph, Spinner, XStack, YStack } from 'tamagui'
import { z } from 'zod'
import { financeApi } from '../src/api/finance'
import { Screen } from '../src/components/Screen'
import { CategoryPickerSheet } from '../src/components/CategoryPickerSheet'
import { todayDateString } from '../src/finance/dates'
import { getValidationMessage, parseDecimalInput, useSubmitValidation } from '../src/forms'
import { FintButton, FintDateField, FintFormField, FintInput, FintSheetSelect } from '../src/ui'

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
      <YStack gap="$5" pb="$5">
        <XStack gap="$2" bg="$muted" borderColor="$borderColor" borderWidth={1} rounded={14} p="$1">
          {(['expense', 'income'] as const).map((option) => (
            <FintButton
              key={option}
              flex={1}
              variant="solid"
              bg={type === option ? option === 'income' ? '$green9' : '$red9' : '$card'}
              color={type === option ? 'white' : '$color11'}
              borderColor={type === option ? option === 'income' ? '$green9' : '$red9' : '$borderColor'}
              borderWidth={1}
              icon={option === 'income' ? <ArrowUp size={16} color={type === option ? 'white' : '$color10'} /> : <ArrowDown size={16} color={type === option ? 'white' : '$color10'} />}
              onPress={() => {
                setType(option)
                setErrorMessage(null)
                validation.clearError('category')
              }}
            >
              {t(`forms.${option}`)}
            </FintButton>
          ))}
        </XStack>

        <FintFormField label={t('forms.amount')} required error={validation.errors.amount}>
          <FintInput minH={64} borderColor={validation.errors.amount ? '$red8' : undefined} fontSize="$7" fontWeight="800" placeholder="0.00" value={amount} onChangeText={(value) => { setAmount(value); validation.clearError('amount') }} keyboardType="decimal-pad" />
        </FintFormField>

        <FintFormField label={t('forms.account')} required error={validation.errors.account} invalidBorder><FintSheetSelect label={t('forms.account')} showLabel={false} placeholder={t('movements.selectAccount')} value={account} onValueChange={(value) => { setAccount(value); validation.clearError('account') }} options={accounts.map((item) => ({ value: item.name, label: `${item.name} · ${item.currency}` }))} /></FintFormField>

        <FintFormField label={t('forms.category')} required error={validation.errors.category} invalidBorder><CategoryPickerSheet categories={categories} showLabel={false} type={type} value={category} onValueChange={(value) => { setCategory(value); validation.clearError('category') }} /></FintFormField>

        <FintFormField label={t('movements.date')} required error={validation.errors.transactionDate}><FintDateField borderColor={validation.errors.transactionDate ? '$red8' : undefined} label={t('movements.date')} showLabel={false} placeholder={t('movements.selectDate')} value={transactionDate} onValueChange={(value) => { setTransactionDate(value); validation.clearError('transactionDate') }} /></FintFormField>
        <FintFormField label={t('movementUx.noteOptional')}><FintInput placeholder={t('movementUx.notePlaceholder')} value={note} onChangeText={setNote} multiline minH={88} textAlignVertical="top" /></FintFormField>

        {isReferenceLoading ? <Paragraph color="$color10">{t('movements.loadingReferences')}</Paragraph> : null}
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

        <FintButton
          disabled={mutation.isPending || isReferenceLoading}
          icon={mutation.isPending ? <Spinner color="$primaryForeground" /> : <Save size={18} />}
          onPress={submit}
          bg={type === 'income' ? '$green9' : '$red9'}
        >
          {mutation.isPending ? t(isEditing ? 'movementUx.updating' : 'movements.creating') : isEditing ? t('actions.save') : t(type === 'income' ? 'movementUx.registerIncome' : 'movementUx.registerExpense')}
        </FintButton>
      </YStack>
    </Screen>
    </>
  )
}
