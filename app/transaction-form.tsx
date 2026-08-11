import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, Save, Shapes, WalletCards } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paragraph, XStack, YStack } from 'tamagui'
import { z } from 'zod'
import { financeApi } from '../src/api/finance'
import { Screen } from '../src/components/Screen'
import { SkeletonForm } from '../src/components/Skeleton'
import { CategoryPickerSheet } from '../src/components/CategoryPickerSheet'
import { MovementAmountField, MovementNoteField, MovementPickerTrigger } from '../src/components/MovementFormControls'
import { todayDateString } from '../src/finance/dates'
import { getValidationMessage, parseDecimalInput, useSubmitValidation } from '../src/forms'
import { FintButton, FintCard, FintDateField, FintFormField, FintSheetSelect, FintSpinner } from '../src/ui'

type MovementKind = 'income' | 'expense' | 'transfer'

export default function TransactionFormScreen() {
  const router = useRouter()
  const { i18n, t } = useTranslation()
  const params = useLocalSearchParams<{ id?: string; type?: 'income' | 'expense' | 'transfer'; amount?: string; category?: string; account?: string; note?: string; date?: string }>()
  const toast = useToastController()
  const queryClient = useQueryClient()
  const isEditing = Boolean(params.id)
  const [kind, setKind] = useState<MovementKind>(!isEditing && params.type === 'transfer' ? 'transfer' : params.type === 'income' ? 'income' : 'expense')
  const [amount, setAmount] = useState(params.amount ?? '')
  const [category, setCategory] = useState(params.category ?? '')
  const [account, setAccount] = useState(params.account ?? '')
  const [originAccountId, setOriginAccountId] = useState('')
  const [destinationAccountId, setDestinationAccountId] = useState('')
  const [note, setNote] = useState(params.note ?? '')
  const [transactionDate, setTransactionDate] = useState(params.date ?? todayDateString)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const validation = useSubmitValidation<'account' | 'amount' | 'category' | 'transactionDate' | 'originAccountId' | 'destinationAccountId'>()
  const accountsQuery = useQuery({ queryKey: ['account-options'], queryFn: () => financeApi.listAccountOptions(), retry: false })
  const categoriesQuery = useQuery({ queryKey: ['categories', kind === 'transfer' ? 'expense' : kind], queryFn: () => financeApi.listCategories(kind === 'transfer' ? 'expense' : kind), enabled: kind !== 'transfer', retry: false })
  const accounts = accountsQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const selectedAccount = accounts.find((item) => item.name === account)
  const selectedOriginAccount = accounts.find((item) => item.id === originAccountId)
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
  const transferSchema = z.object({
    originAccountId: z.string().uuid(requiredMessage),
    destinationAccountId: z.string().uuid(requiredMessage),
    amount: z.number({ error: amountMessage }).positive(getValidationMessage(t, i18n.resolvedLanguage, 'positiveAmount')),
    note: z.string().optional(),
    transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, getValidationMessage(t, i18n.resolvedLanguage, 'date')),
  }).refine((value) => value.originAccountId !== value.destinationAccountId, { message: requiredMessage, path: ['destinationAccountId'] })

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

  const transferMutation = useMutation({
    mutationFn: async (validated: z.infer<typeof transferSchema>) => {
      const originCurrency = accounts.find((item) => item.id === validated.originAccountId)?.currency
      if (!originCurrency) throw new Error(t('movements.referencesError'))
      return financeApi.createTransfer({
        originAccountId: validated.originAccountId,
        destinationAccountId: validated.destinationAccountId,
        amount: validated.amount,
        currency: originCurrency,
        transactionDate: validated.transactionDate,
        note: validated.note?.trim() || null,
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ])
      toast.show(t('movements.createdToast'), { message: t('movements.createdMessage'), preset: 'success' })
      router.back()
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : t('states.error')),
  })

  const submit = () => {
    setErrorMessage(null)
    if (kind === 'transfer') {
      const payload = validation.validate(transferSchema, {
        originAccountId,
        destinationAccountId,
        amount: parseDecimalInput(amount),
        note: note.trim() || undefined,
        transactionDate,
      })
      if (payload) transferMutation.mutate(payload)
      return
    }
    const payload = validation.validate(transactionSchema, {
      type: kind,
      amount: parseDecimalInput(amount),
      category,
      account,
      note: note.trim() || undefined,
      transactionDate,
    })
    if (payload) mutation.mutate(payload)
  }

  const isReferenceLoading = accountsQuery.isLoading || (kind !== 'transfer' && categoriesQuery.isLoading)
  const isPending = mutation.isPending || transferMutation.isPending
  const screenTitle = isEditing
    ? 'movementUx.editTitle'
    : kind === 'income'
      ? 'movementUx.newIncomeTitle'
      : kind === 'transfer'
        ? 'movementUx.newTransferTitle'
        : 'movementUx.newExpenseTitle'

  return (
    <>
    <Stack.Screen options={{ title: t(screenTitle) }} />
    <Screen>
      {isReferenceLoading ? <SkeletonForm label={t('movements.loadingReferences')} showSegment segmentCount={isEditing ? 2 : 3} fieldCount={3} /> : <YStack gap="$5" pb="$5">
        <MovementKindSelector value={kind} onValueChange={(value) => { setKind(value); setErrorMessage(null); validation.clearError('category', 'account', 'originAccountId', 'destinationAccountId') }} allowTransfer={!isEditing} />

        <MovementAmountField currency={kind === 'transfer' ? (selectedOriginAccount?.currency ?? 'PEN') : (selectedAccount?.currency ?? 'PEN')} error={validation.errors.amount} value={amount} onChangeText={(value) => { setAmount(value); validation.clearError('amount') }} />

        {kind === 'transfer' ? (
          <>
            <FintFormField label={t('movementUx.transferPickOrigin')} required error={validation.errors.originAccountId} showLabel={false}>
              <FintSheetSelect label={t('movementUx.transferPickOrigin')} showLabel={false} placeholder={t('movements.selectAccount')} value={originAccountId} onValueChange={(value) => { setOriginAccountId(value); validation.clearError('originAccountId') }} options={accounts.filter((item) => item.id !== destinationAccountId).map((item) => ({ value: item.id, label: `${item.name} · ${item.currency}` }))} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<WalletCards size={21} color="$primary" />} invalid={Boolean(validation.errors.originAccountId)} label={t('movementUx.transferPickOrigin')} required onPress={onPress} value={selectedLabel} />} />
            </FintFormField>
            <FintFormField label={t('movementUx.transferPickDestination')} required error={validation.errors.destinationAccountId} showLabel={false}>
              <FintSheetSelect label={t('movementUx.transferPickDestination')} showLabel={false} placeholder={t('movements.selectAccount')} value={destinationAccountId} onValueChange={(value) => { setDestinationAccountId(value); validation.clearError('destinationAccountId') }} options={accounts.filter((item) => item.id !== originAccountId).map((item) => ({ value: item.id, label: `${item.name} · ${item.currency}` }))} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<WalletCards size={21} color="$primary" />} invalid={Boolean(validation.errors.destinationAccountId)} label={t('movementUx.transferPickDestination')} required onPress={onPress} value={selectedLabel} />} />
            </FintFormField>
          </>
        ) : (
          <>
            <FintFormField label={t('forms.account')} required error={validation.errors.account} showLabel={false}>
              <FintSheetSelect label={t('forms.account')} showLabel={false} placeholder={t('movements.selectAccount')} value={account} onValueChange={(value) => { setAccount(value); validation.clearError('account') }} options={accounts.map((item) => ({ value: item.name, label: `${item.name} · ${item.currency}` }))} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<WalletCards size={21} color="$primary" />} invalid={Boolean(validation.errors.account)} label={t('forms.account')} required onPress={onPress} value={selectedLabel} />} />
            </FintFormField>

            <FintFormField label={t('forms.category')} required error={validation.errors.category} showLabel={false}>
              <CategoryPickerSheet categories={categories} showLabel={false} type={kind} value={category} onValueChange={(value) => { setCategory(value); validation.clearError('category') }} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<Shapes size={21} color="$primary" />} invalid={Boolean(validation.errors.category)} label={t('forms.category')} required onPress={onPress} value={selectedLabel} />} />
            </FintFormField>
          </>
        )}

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
        {kind !== 'transfer' && !categoriesQuery.isLoading && categories.length === 0 ? (
          <YStack bg="$secondary" gap="$2" p="$3" rounded="$5">
            <Paragraph color="$color12" fontWeight="700">{t('movements.noCategories')}</Paragraph>
            <FintButton size="$3" variant="outlined" onPress={() => router.push('/categories')}>{t('categories.newAction')}</FintButton>
          </YStack>
        ) : null}
        {accountsQuery.error || categoriesQuery.error ? <Paragraph color="$red10">{t('movements.referencesError')}</Paragraph> : null}
        {errorMessage ? <Paragraph color="$red10">{errorMessage}</Paragraph> : null}

        <YStack gap="$2">
          <FintButton width="100%" minH={52} disabled={isPending || isReferenceLoading} icon={isPending ? <FintSpinner color="$primaryForeground" /> : <Save size={18} />} onPress={submit}>
            {isPending ? t(isEditing ? 'movementUx.updating' : 'movements.creating') : isEditing ? t('actions.save') : t(kind === 'income' ? 'movementUx.registerIncome' : kind === 'transfer' ? 'movementUx.registerTransfer' : 'movementUx.registerExpense')}
          </FintButton>
          <FintButton width="100%" minH={48} variant="outlined" disabled={isPending} onPress={() => router.back()}>{t('actions.cancel')}</FintButton>
        </YStack>
      </YStack>}
    </Screen>
    </>
  )
}

function MovementKindSelector({ allowTransfer, onValueChange, value }: { allowTransfer: boolean; onValueChange: (value: MovementKind) => void; value: MovementKind }) {
  const { t } = useTranslation()
  const options = (allowTransfer ? ['expense', 'income', 'transfer'] : ['expense', 'income']) as MovementKind[]
  const stacked = options.length > 2
  return (
    <FintCard p="$1" bg="$muted" rounded="$7">
      <XStack gap="$1">
        {options.map((option) => {
          const selected = value === option
          const accent = option === 'income' ? '$green9' : option === 'transfer' ? '$blue9' : '$red9'
          const selectedBg = option === 'income' ? '$green2' : option === 'transfer' ? '$blue2' : '$red2'
          const selectedColor = option === 'income' ? '$green11' : option === 'transfer' ? '$blue11' : '$red11'
          const iconColor = selected ? 'white' : '$color10'
          const iconNode = option === 'income' ? <ArrowDownLeft size={stacked ? 14 : 16} color={iconColor} /> : option === 'transfer' ? <ArrowLeftRight size={stacked ? 14 : 16} color={iconColor} /> : <ArrowUpRight size={stacked ? 14 : 16} color={iconColor} />
          const badge = <YStack width={stacked ? 24 : 30} height={stacked ? 24 : 30} rounded="$10" bg={selected ? accent : '$color4'} items="center" justify="center">{iconNode}</YStack>
          const label = <Paragraph color={selected ? selectedColor : '$color10'} fontSize={stacked ? 12 : 14} fontWeight="700" numberOfLines={2} text="center" lineHeight={stacked ? 14 : undefined}>{t(`forms.${option}`)}</Paragraph>
          return (
            <FintButton
              key={option}
              flex={1}
              minH={stacked ? 64 : 56}
              variant="solid"
              bg={selected ? selectedBg : 'transparent'}
              borderColor={selected ? accent : 'transparent'}
              borderWidth={1}
              onPress={() => onValueChange(option)}
            >
              {stacked ? (
                <YStack items="center" justify="center" gap="$1" px="$1">
                  {badge}
                  {label}
                </YStack>
              ) : (
                <XStack items="center" gap="$2">
                  {badge}
                  {label}
                </XStack>
              )}
            </FintButton>
          )
        })}
      </XStack>
    </FintCard>
  )
}

