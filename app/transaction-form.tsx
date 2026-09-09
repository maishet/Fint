import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowLeftRight, ArrowUp, CalendarDays, Save, Shapes, WalletCards } from '@tamagui/lucide-icons-2'
import { useNotify } from '../src/ui/notify'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paragraph, YStack } from 'tamagui'
import { z } from 'zod'
import { financeApi } from '../src/api/finance'
import { useAccountPickerOptions } from '../src/finance/useAccountPickerOptions'
import { Screen } from '../src/components/Screen'
import { SkeletonForm } from '../src/components/Skeleton'
import { CategoryPickerSheet } from '../src/components/CategoryPickerSheet'
import { MovementAmountField, MovementNoteField } from '../src/components/MovementFormControls'
import { FintListGroup, FintListRow } from '../src/components/FintListGroup'
import { FintOptionGroup } from '../src/components/FintOptionGroup'
import { todayDateString } from '../src/finance/dates'
import { getValidationMessage, parseDecimalInput, useSubmitValidation } from '../src/forms'
import { useUnsavedChangesGuard } from '../src/hooks/useUnsavedChangesGuard'
import { UnsavedChangesDialog } from '../src/components/UnsavedChangesDialog'
import { FintButton, FintDateField, FintSheetSelect, FintSpinner } from '../src/ui'

type MovementKind = 'income' | 'expense' | 'transfer'

export default function TransactionFormScreen() {
  const router = useRouter()
  const { i18n, t } = useTranslation()
  const params = useLocalSearchParams<{ id?: string; type?: 'income' | 'expense' | 'transfer'; amount?: string; category?: string; account?: string; note?: string; date?: string }>()
  const toast = useNotify()
  const queryClient = useQueryClient()
  const isEditing = Boolean(params.id)
  const [saved, setSaved] = useState(false)
  const [kind, setKind] = useState<MovementKind>(!isEditing && params.type === 'transfer' ? 'transfer' : params.type === 'income' ? 'income' : 'expense')
  const [amount, setAmount] = useState(params.amount ?? '')
  const [category, setCategory] = useState(params.category ?? '')
  const [account, setAccount] = useState(params.account ?? '')
  const [originAccountId, setOriginAccountId] = useState('')
  const [destinationAccountId, setDestinationAccountId] = useState('')
  const [note, setNote] = useState(params.note ?? '')
  const [transactionDate, setTransactionDate] = useState(() => params.date ?? todayDateString())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isDirty = !saved && (
    amount !== (params.amount ?? '') ||
    note !== (params.note ?? '') ||
    category !== (params.category ?? '') ||
    originAccountId !== '' ||
    destinationAccountId !== ''
  )
  const guard = useUnsavedChangesGuard(isDirty)
  const validation = useSubmitValidation<'account' | 'amount' | 'category' | 'transactionDate' | 'originAccountId' | 'destinationAccountId'>()
  const accountsQuery = useQuery({ queryKey: ['account-options'], queryFn: () => financeApi.listAccountOptions() })
  const categoriesQuery = useQuery({ queryKey: ['categories', kind === 'transfer' ? 'expense' : kind], queryFn: () => financeApi.listCategories(kind === 'transfer' ? 'expense' : kind), enabled: kind !== 'transfer' })
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
      setSaved(true)
      guard.bypass(() => router.back())
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
      setSaved(true)
      guard.bypass(() => router.back())
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

  const toAccountOption = useAccountPickerOptions()

  const isReferenceLoading = accountsQuery.isLoading || (kind !== 'transfer' && categoriesQuery.isLoading)
  const isPending = mutation.isPending || transferMutation.isPending
  // Los campos comparten un grupo: el borde se tiñe una vez y los mensajes van debajo.
  const fieldErrors = (kind === 'transfer'
    ? [validation.errors.originAccountId, validation.errors.destinationAccountId, validation.errors.transactionDate]
    : [validation.errors.account, validation.errors.category, validation.errors.transactionDate]
  ).filter((message): message is string => Boolean(message))
  const screenTitle = isEditing
    ? 'movementUx.editTitle'
    : kind === 'income'
      ? 'movementUx.newIncomeTitle'
      : kind === 'transfer'
        ? 'movementUx.newTransferTitle'
        : 'movementUx.newExpenseTitle'

  return (
    <>
    <UnsavedChangesDialog open={guard.open} onCancel={guard.onCancel} onConfirm={guard.onConfirm} />
    <Stack.Screen options={{ title: t(screenTitle) }} />
    {/*
      Una sola acción, fija abajo. "Cancelar" sale: el atrás de la cabecera ya
      está y `useUnsavedChangesGuard` sigue protegiendo la salida.
    */}
    <Screen
      footer={
        <FintButton width="100%" minH={52} disabled={isPending || isReferenceLoading} icon={isPending ? <FintSpinner color="$primaryForeground" /> : <Save size={18} />} onPress={submit}>
          {isPending ? t(isEditing ? 'movementUx.updating' : 'movements.creating') : isEditing ? t('actions.save') : t(kind === 'income' ? 'movementUx.registerIncome' : kind === 'transfer' ? 'movementUx.registerTransfer' : 'movementUx.registerExpense')}
        </FintButton>
      }
    >
      {isReferenceLoading ? <SkeletonForm label={t('movements.loadingReferences')} showSegment segmentCount={isEditing ? 2 : 3} fieldCount={3} /> : <YStack gap="$5" pb="$5">
        <MovementKindSelector value={kind} onValueChange={(value) => { setKind(value); setErrorMessage(null); validation.clearError('category', 'account', 'originAccountId', 'destinationAccountId') }} allowTransfer={!isEditing} />

        <MovementAmountField currency={kind === 'transfer' ? (selectedOriginAccount?.currency ?? 'PEN') : (selectedAccount?.currency ?? 'PEN')} error={validation.errors.amount} value={amount} onChangeText={(value) => { setAmount(value); validation.clearError('amount') }} onBlur={() => { if (amount.trim()) validation.validateField('amount', transactionSchema.shape.amount, parseDecimalInput(amount)) }} />

        {/*
          Cuenta, categoría y fecha comparten un solo grupo con filete: eran
          tres tarjetas de 68 px con la misma jerarquía que el monto.
        */}
        <YStack gap="$2">
          <FintListGroup invalid={fieldErrors.length > 0}>
            {kind === 'transfer' ? (
              <FintSheetSelect label={t('movementUx.transferPickOrigin')} showLabel={false} placeholder={t('movements.selectAccount')} value={originAccountId} onValueChange={(value) => { setOriginAccountId(value); validation.clearError('originAccountId') }} options={accounts.filter((item) => item.id !== destinationAccountId).map((item) => toAccountOption(item, true))} renderTrigger={({ onPress, selectedLabel }) => <FintListRow icon={<WalletCards size={22} color="$primary" />} label={t('movementUx.transferPickOrigin')} required onPress={onPress} value={selectedLabel} />} />
            ) : (
              <FintSheetSelect label={t('forms.account')} showLabel={false} placeholder={t('movements.selectAccount')} value={account} onValueChange={(value) => { setAccount(value); validation.clearError('account') }} options={accounts.map((item) => toAccountOption(item, false))} renderTrigger={({ onPress, selectedLabel }) => <FintListRow icon={<WalletCards size={22} color="$primary" />} label={t('forms.account')} required onPress={onPress} value={selectedLabel} />} />
            )}

            {kind === 'transfer' ? (
              <FintSheetSelect label={t('movementUx.transferPickDestination')} showLabel={false} placeholder={t('movements.selectAccount')} value={destinationAccountId} onValueChange={(value) => { setDestinationAccountId(value); validation.clearError('destinationAccountId') }} options={accounts.filter((item) => item.id !== originAccountId).map((item) => toAccountOption(item, true))} renderTrigger={({ onPress, selectedLabel }) => <FintListRow icon={<WalletCards size={22} color="$primary" />} label={t('movementUx.transferPickDestination')} required onPress={onPress} value={selectedLabel} />} />
            ) : (
              <CategoryPickerSheet categories={categories} showLabel={false} type={kind} value={category} onValueChange={(value) => { setCategory(value); validation.clearError('category') }} renderTrigger={({ onPress, selectedLabel }) => <FintListRow icon={<Shapes size={22} color="$primary" />} label={t('forms.category')} required onPress={onPress} value={selectedLabel} />} />
            )}

            <FintDateField label={t('movements.date')} showLabel={false} placeholder={t('movements.selectDate')} value={transactionDate} maxDate={todayDateString()} onValueChange={(value) => { setTransactionDate(value); validation.clearError('transactionDate') }} renderTrigger={({ onPress, selectedLabel }) => <FintListRow icon={<CalendarDays size={22} color="$primary" />} label={t('movements.date')} required onPress={onPress} value={selectedLabel} />} />
          </FintListGroup>
          {fieldErrors.map((message) => (
            <Paragraph key={message} color="$red10" fontSize="$1" fontWeight="600" px="$1">{message}</Paragraph>
          ))}
        </YStack>

        <MovementNoteField label={t('movementUx.noteOptional')} placeholder={t('movementUx.notePlaceholder')} value={note} onChangeText={setNote} />

        {!accountsQuery.isLoading && accounts.length === 0 ? (
          <YStack bg="$secondary" gap="$2" p="$3" rounded="$5">
            <Paragraph color="$color12" fontWeight="600">{t('movements.noAccounts')}</Paragraph>
            <FintButton size="$3" variant="outlined" onPress={() => router.push('/account-form')}>{t('actions.newAccount')}</FintButton>
          </YStack>
        ) : null}
        {kind !== 'transfer' && !categoriesQuery.isLoading && categories.length === 0 ? (
          <YStack bg="$secondary" gap="$2" p="$3" rounded="$5">
            <Paragraph color="$color12" fontWeight="600">{t('movements.noCategories')}</Paragraph>
            <FintButton size="$3" variant="outlined" onPress={() => router.push('/categories')}>{t('categories.newAction')}</FintButton>
          </YStack>
        ) : null}
        {accountsQuery.error || categoriesQuery.error ? <Paragraph color="$red10">{t('movements.referencesError')}</Paragraph> : null}
        {errorMessage ? <Paragraph color="$red10">{errorMessage}</Paragraph> : null}
      </YStack>}
    </Screen>
    </>
  )
}

function MovementKindSelector({ allowTransfer, onValueChange, value }: { allowTransfer: boolean; onValueChange: (value: MovementKind) => void; value: MovementKind }) {
  const { t } = useTranslation()
  const options = [
    { value: 'expense' as const, label: t('forms.expense'), icon: ArrowDown, tone: 'negative' as const },
    { value: 'income' as const, label: t('forms.income'), icon: ArrowUp, tone: 'positive' as const },
    ...(allowTransfer ? [{ value: 'transfer' as const, label: t('forms.transfer'), icon: ArrowLeftRight, tone: 'accent' as const }] : []),
  ]
  return <FintOptionGroup value={value} onValueChange={onValueChange} options={options} layout="row" />
}

