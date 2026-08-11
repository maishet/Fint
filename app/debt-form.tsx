import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, FileText, Repeat, Save, Shapes } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paragraph, XStack, YStack } from 'tamagui'
import { z } from 'zod'
import { financeApi } from '../src/api/finance'
import type { PaymentRule } from '../src/api/types'
import { CategoryPickerSheet } from '../src/components/CategoryPickerSheet'
import { DataStateCard } from '../src/components/DataStateCard'
import { FormTextField, MovementAmountField, MovementPickerTrigger } from '../src/components/MovementFormControls'
import { Screen } from '../src/components/Screen'
import { SkeletonForm } from '../src/components/Skeleton'
import { currencyOptions } from '../src/finance/currencies'
import { todayDateString } from '../src/finance/dates'
import { getValidationMessage, parseDecimalInput, useSubmitValidation } from '../src/forms'
import { registerPushInstallation } from '../src/notifications/pushNotifications'
import { useCapabilities } from '../src/api/capabilities'
import { FintButton, FintDateField, FintFormField, FintSheetSelect, FintSpinner } from '../src/ui'

// NOTE: the payments/debts module only supports 'fixed_payment' rules (single-step flow:
// create rule -> mark occurrence as paid). credit_card rules were removed; see
// database/migrations/025_drop_credit_card_payment_support.sql on the API side.
// TODO: reconsiderar tipos de pago no fijos en el futuro.
type Frequency = PaymentRule['frequency']

export default function DebtFormScreen() {
  const params = useLocalSearchParams<{ ruleId?: string | string[] }>()
  const ruleId = Array.isArray(params.ruleId) ? params.ruleId[0] : params.ruleId
  const isEditing = Boolean(ruleId)
  const { i18n, t } = useTranslation()
  const router = useRouter()
  const toast = useToastController()
  const queryClient = useQueryClient()
  const { capabilities } = useCapabilities()
  const categoriesQuery = useQuery({ queryKey: ['categories', 'expense'], queryFn: () => financeApi.listCategories('expense'), retry: false })
  const rulesQuery = useQuery({ queryKey: ['payment-rules'], queryFn: financeApi.listPaymentRules, retry: false })
  const optionsQuery = useQuery({ queryKey: ['finance-options'], queryFn: financeApi.getFinanceOptions, retry: false })
  const categories = categoriesQuery.data ?? []
  const rules = rulesQuery.data ?? []
  const currentRule = rules.find((rule) => rule.id === ruleId)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState('PEN')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [startDate, setStartDate] = useState(todayDateString)
  const [categoryId, setCategoryId] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const validation = useSubmitValidation<'title' | 'amount' | 'categoryId' | 'startDate'>()
  const selectedCategory = categories.find((category) => category.id === categoryId)
  const currency = selectedCurrency
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima'
  const amountMessage = getValidationMessage(t, i18n.resolvedLanguage, 'amount')
  const schema = z.object({
    title: z.string().trim().min(2, getValidationMessage(t, i18n.resolvedLanguage, 'minTwo')),
    amount: z.number({ error: amountMessage }).positive(getValidationMessage(t, i18n.resolvedLanguage, 'positiveAmount')),
    categoryId: z.string().uuid(getValidationMessage(t, i18n.resolvedLanguage, 'required')),
    startDate: z.string().date(getValidationMessage(t, i18n.resolvedLanguage, 'date')),
  })

  useEffect(() => {
    if (!currentRule) return
    setTitle(currentRule.title)
    setFrequency(currentRule.frequency)
    setStartDate(currentRule.startDate)
    setAmount(currentRule.fixedAmount ? String(currentRule.fixedAmount) : '')
    setSelectedCurrency(currentRule.currency)
    setCategoryId(currentRule.categoryId ?? '')
  }, [currentRule])

  useEffect(() => {
    if (currentRule || !optionsQuery.data?.baseCurrency) return
    setSelectedCurrency(optionsQuery.data.baseCurrency)
  }, [currentRule, optionsQuery.data?.baseCurrency])

  const mutation = useMutation({
    mutationFn: async (payload: z.infer<typeof schema>) => {
      if (ruleId) {
        return financeApi.updatePaymentRule(ruleId, { title: payload.title, frequency, fixedAmount: payload.amount, categoryId: payload.categoryId, startDate: payload.startDate })
      }
      return financeApi.createPaymentRule({ kind: 'fixed_payment', title: payload.title, frequency, currency, fixedAmount: payload.amount, categoryId: payload.categoryId, timezone, startDate: payload.startDate })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payment-rules'] }),
        queryClient.invalidateQueries({ queryKey: ['payment-occurrences'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ])
      if (!isEditing && capabilities.features.pushPaymentReminders) registerPushInstallation().catch(() => undefined)
      toast.show(t(isEditing ? 'payments.recurringUpdated' : 'payments.recurringCreated'), { message: t(isEditing ? 'payments.changesSaved' : 'payments.firstOccurrenceReady'), preset: 'success', duration: 3500 })
      router.back()
    },
    onError: () => setErrorMessage(t(isEditing ? 'payments.updateError' : 'payments.createError')),
  })

  const submit = () => {
    setErrorMessage(null)
    if (!capabilities.features.recurringPayments) {
      setErrorMessage(t('payments.disabledTemporary'))
      return
    }
    const payload = validation.validate(schema, { title, amount: parseDecimalInput(amount), categoryId, startDate })
    if (payload) mutation.mutate(payload)
  }

  const isLoading = categoriesQuery.isLoading || rulesQuery.isLoading || optionsQuery.isLoading
  const error = categoriesQuery.error ?? rulesQuery.error ?? optionsQuery.error

  return (
    <>
      <Stack.Screen options={{ title: t(isEditing ? 'payments.editRecurring' : 'payments.newRecurring') }} />
      <Screen>
        {isLoading ? <SkeletonForm label={t('states.loading')} fieldCount={4} /> : null}
        {error ? <DataStateCard message={error instanceof Error ? error.message : t('states.error')} /> : null}
        {!isLoading && !error && isEditing && !currentRule ? <DataStateCard message={t('payments.notFound')} /> : null}
        {!isLoading && !error && (!isEditing || currentRule) ? (
          <YStack gap="$5" pb="$5">
            <FormTextField label={t('forms.name')} required error={validation.errors.title} icon={<FileText size={21} color="$primary" />} placeholder={t('payments.titlePlaceholder')} value={title} onChangeText={(value) => { setTitle(value); validation.clearError('title') }} />

            {isEditing ? (
              <MovementAmountField currency={currency} error={validation.errors.amount} helperText={t('payments.amountEditLocked')} value={amount} onChangeText={(value) => { setAmount(value); validation.clearError('amount') }} />
            ) : (
              <FintSheetSelect label={t('forms.currency')} showLabel={false} placeholder={t('forms.select')} searchable searchPlaceholder={t('accounts.searchCurrency')} value={selectedCurrency} onValueChange={setSelectedCurrency} options={currencyOptions} renderTrigger={({ onPress }) => <MovementAmountField currency={currency} error={validation.errors.amount} helperText={t('payments.currencyChangeHint')} value={amount} onChangeText={(value) => { setAmount(value); validation.clearError('amount') }} onCurrencyPress={onPress} />} />
            )}

            <FintFormField label={t('payments.frequency')} showLabel={false}>
              <FintSheetSelect label={t('payments.frequency')} showLabel={false} placeholder={t('payments.selectFrequency')} value={frequency} onValueChange={(value) => setFrequency(value as Frequency)} options={(['weekly', 'biweekly', 'monthly', 'yearly'] as const).map((item) => ({ value: item, label: frequencyLabel(item, t) }))} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<Repeat size={21} color="$primary" />} label={t('payments.frequency')} required onPress={onPress} value={selectedLabel} />} />
            </FintFormField>

            <FintFormField label={t('payments.firstDate')} required error={validation.errors.startDate} showLabel={false}><FintDateField label={t('payments.firstDate')} showLabel={false} placeholder={t('payments.selectDate')} value={startDate} onValueChange={(value) => { setStartDate(value); validation.clearError('startDate') }} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<CalendarDays size={21} color="$primary" />} invalid={Boolean(validation.errors.startDate)} label={t('payments.firstDate')} required onPress={onPress} value={selectedLabel} />} /></FintFormField>

            <FintFormField label={t('forms.category')} required error={validation.errors.categoryId} showLabel={false}>
              <CategoryPickerSheet categories={categories} showLabel={false} type="expense" value={selectedCategory?.name ?? ''} onValueChange={(name) => { setCategoryId(categories.find((category) => category.name === name)?.id ?? ''); validation.clearError('categoryId') }} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<Shapes size={21} color="$primary" />} invalid={Boolean(validation.errors.categoryId)} label={t('forms.category')} required onPress={onPress} value={selectedLabel} />} />
              {categories.length === 0 ? <ReferenceHint message={t('payments.categoryRequiredHint')} action={t('payments.createCategory')} onPress={() => router.push('/categories')} /> : null}
            </FintFormField>

            {errorMessage ? <XStack bg="$red2" borderColor="$red6" borderWidth={1} rounded="$5" p="$3"><Paragraph color="$red11" fontSize="$2">{errorMessage}</Paragraph></XStack> : null}
            <YStack gap="$2">
              <FintButton width="100%" minH={52} disabled={mutation.isPending} icon={mutation.isPending ? <FintSpinner color="$primaryForeground" /> : <Save size={18} />} onPress={submit}>{mutation.isPending ? t('payments.saving') : isEditing ? t('accounts.update') : t('payments.createRecurring')}</FintButton>
              <FintButton width="100%" minH={48} variant="outlined" disabled={mutation.isPending} onPress={() => router.back()}>{t('actions.cancel')}</FintButton>
            </YStack>
          </YStack>
        ) : null}
      </Screen>
    </>
  )
}

function ReferenceHint({ action, message, onPress }: { action: string; message: string; onPress: () => void }) {
  return <YStack bg="$secondary" gap="$2" mt="$2" p="$3" rounded="$5"><Paragraph color="$color12" fontWeight="700">{message}</Paragraph><FintButton size="$3" variant="outlined" onPress={onPress}>{action}</FintButton></YStack>
}

function frequencyLabel(value: Frequency, t: (key: string) => string) {
  if (value === 'weekly') return t('payments.weekly')
  if (value === 'biweekly') return t('payments.biweekly')
  if (value === 'yearly') return t('payments.yearly')
  return t('payments.monthly')
}
