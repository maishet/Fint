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
import { FintButton, FintDateField, FintInput, FintSheetSelect } from '../src/ui'
import { todayDateString } from '../src/finance/dates'

const transactionSchema = z.object({
  type: z.union([z.literal('income'), z.literal('expense')]),
  amount: z.number().positive(),
  currency: z.string().length(3),
  category: z.string().min(2),
  account: z.string().min(2),
  note: z.string().optional(),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export default function TransactionFormScreen() {
  const router = useRouter()
  const { t } = useTranslation()
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
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: financeApi.listAccounts, retry: false })
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => financeApi.listCategories(), retry: false })
  const accounts = accountsQuery.data ?? []
  const categories = (categoriesQuery.data ?? []).filter((item) => item.type === type)
  const selectedAccount = accounts.find((item) => item.name === account)

  useEffect(() => {
    if (!account && accounts[0]) setAccount(accounts[0].name)
  }, [account, accounts])

  useEffect(() => {
    if (category && !categories.some((item) => item.name === category)) setCategory('')
  }, [categories, category])

  const mutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null)
      const payload = transactionSchema.parse({
        type,
        amount: Number(amount),
        currency: selectedAccount?.currency,
        category,
        account,
        note: note.trim() || undefined,
        transactionDate,
      })
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
    onError: (error) => setErrorMessage(error instanceof z.ZodError ? t('movements.invalidForm') : error.message),
  })

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
              }}
            >
              {t(`forms.${option}`)}
            </FintButton>
          ))}
        </XStack>

        <FormField label={t('forms.amount')}>
          <FintInput minH={64} fontSize="$7" fontWeight="800" placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        </FormField>

        {accounts.length > 0 ? (
          <FormField label={t('forms.account')}><FintSheetSelect label={t('forms.account')} showLabel={false} placeholder={t('movements.selectAccount')} value={account} onValueChange={setAccount} options={accounts.map((item) => ({ value: item.name, label: `${item.name} · ${item.currency}` }))} /></FormField>
        ) : null}

        <FormField label={t('forms.category')}><CategoryPickerSheet categories={categories} showLabel={false} type={type} value={category} onValueChange={setCategory} /></FormField>

        <FormField label={t('movements.date')}><FintDateField label={t('movements.date')} showLabel={false} placeholder={t('movements.selectDate')} value={transactionDate} onValueChange={setTransactionDate} /></FormField>
        <FormField label={t('movementUx.noteOptional')}><FintInput placeholder={t('movementUx.notePlaceholder')} value={note} onChangeText={setNote} multiline minH={88} textAlignVertical="top" /></FormField>

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
          disabled={mutation.isPending || isReferenceLoading || !selectedAccount || !category}
          icon={mutation.isPending ? <Spinner color="$primaryForeground" /> : <Save size={18} />}
          onPress={() => mutation.mutate()}
          bg={type === 'income' ? '$green9' : '$red9'}
        >
          {mutation.isPending ? t(isEditing ? 'movementUx.updating' : 'movements.creating') : isEditing ? t('actions.save') : t(type === 'income' ? 'movementUx.registerIncome' : 'movementUx.registerExpense')}
        </FintButton>
      </YStack>
    </Screen>
    </>
  )
}

function FormField({ children, label }: { children: React.ReactNode; label: string }) {
  return <YStack gap="$2"><Paragraph color="$color10" fontSize="$2" fontWeight="600">{label}</Paragraph>{children}</YStack>
}
