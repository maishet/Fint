import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CreditCard, FileText, Repeat, Save, Shapes } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paragraph, Spinner, XStack, YStack } from 'tamagui'
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
import { requestAndRegisterPushInstallation } from '../src/notifications/pushNotifications'
import { useCapabilities } from '../src/api/capabilities'
import { FintButton, FintCard, FintDateField, FintFormField, FintSheetSelect } from '../src/ui'

type RuleKind = 'fixed_payment' | 'credit_card'
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
  const cardsQuery = useQuery({ queryKey: ['account-options', 'credit-card'], queryFn: () => financeApi.listAccountOptions({ accountType: 'credit_card' }), retry: false })
  const rulesQuery = useQuery({ queryKey: ['payment-rules'], queryFn: financeApi.listPaymentRules, retry: false })
  const optionsQuery = useQuery({ queryKey: ['finance-options'], queryFn: financeApi.getFinanceOptions, retry: false })
  const categories = categoriesQuery.data ?? []
  const rules = rulesQuery.data ?? []
  const currentRule = rules.find((rule) => rule.id === ruleId)
  const usedCardIds = new Set(rules.filter((rule) => rule.kind === 'credit_card' && rule.status !== 'ended' && rule.id !== ruleId && rule.cardAccountId).map((rule) => rule.cardAccountId!))
  const cards = (cardsQuery.data ?? []).filter((card) => !usedCardIds.has(card.id))
  const [kind, setKind] = useState<RuleKind>('fixed_payment')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState('PEN')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [startDate, setStartDate] = useState(todayDateString)
  const [categoryId, setCategoryId] = useState('')
  const [cardAccountId, setCardAccountId] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const validation = useSubmitValidation<'title' | 'amount' | 'categoryId' | 'cardAccountId' | 'startDate'>()
  const selectedCategory = categories.find((category) => category.id === categoryId)
  const selectedCard = cards.find((card) => card.id === cardAccountId) ?? (cardsQuery.data ?? []).find((card) => card.id === cardAccountId)
  const currency = kind === 'credit_card' ? selectedCard?.currency ?? currentRule?.currency ?? optionsQuery.data?.baseCurrency ?? 'PEN' : selectedCurrency
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima'
  const amountMessage = getValidationMessage(t, i18n.resolvedLanguage, 'amount')
  const schema = z.object({
    title: z.string().trim().min(2, getValidationMessage(t, i18n.resolvedLanguage, 'minTwo')),
    amount: kind === 'fixed_payment' ? z.number({ error: amountMessage }).positive(getValidationMessage(t, i18n.resolvedLanguage, 'positiveAmount')) : z.number().optional(),
    categoryId: kind === 'fixed_payment' ? z.string().uuid(getValidationMessage(t, i18n.resolvedLanguage, 'required')) : z.string().optional(),
    cardAccountId: kind === 'credit_card' ? z.string().uuid(getValidationMessage(t, i18n.resolvedLanguage, 'required')) : z.string().optional(),
    startDate: z.string().date(getValidationMessage(t, i18n.resolvedLanguage, 'date')),
  })

  useEffect(() => {
    if (!currentRule) return
    setKind(currentRule.kind)
    setTitle(currentRule.title)
    setFrequency(currentRule.frequency)
    setStartDate(currentRule.startDate)
    setAmount(currentRule.fixedAmount ? String(currentRule.fixedAmount) : '')
    setSelectedCurrency(currentRule.currency)
    setCategoryId(currentRule.categoryId ?? '')
    setCardAccountId(currentRule.cardAccountId ?? '')
  }, [currentRule])

  useEffect(() => {
    if (currentRule || !optionsQuery.data?.baseCurrency) return
    setSelectedCurrency(optionsQuery.data.baseCurrency)
  }, [currentRule, optionsQuery.data?.baseCurrency])

  const mutation = useMutation({
    mutationFn: async (payload: z.infer<typeof schema>) => {
      if (ruleId) {
        const input = kind === 'fixed_payment'
          ? { title: payload.title, frequency, fixedAmount: payload.amount!, categoryId: payload.categoryId!, startDate: payload.startDate }
          : { title: payload.title, frequency, startDate: payload.startDate }
        return financeApi.updatePaymentRule(ruleId, input)
      }
      if (kind === 'fixed_payment') return financeApi.createPaymentRule({ kind, title: payload.title, frequency, currency, fixedAmount: payload.amount!, categoryId: payload.categoryId!, timezone, startDate: payload.startDate })
      return financeApi.createPaymentRule({ kind, title: payload.title, frequency, currency, cardAccountId: payload.cardAccountId!, timezone, startDate: payload.startDate })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payment-rules'] }),
        queryClient.invalidateQueries({ queryKey: ['payment-occurrences'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ])
      if (!isEditing && capabilities.features.pushPaymentReminders) requestAndRegisterPushInstallation().catch(() => undefined)
      toast.show(isEditing ? 'Pago actualizado' : 'Pago recurrente creado', { message: isEditing ? 'Los cambios se guardaron.' : 'La primera ocurrencia ya está lista.', preset: 'success', duration: 3500 })
      router.back()
    },
    onError: () => setErrorMessage(isEditing ? 'No se pudo actualizar el pago recurrente.' : 'No se pudo crear el pago recurrente.'),
  })

  const submit = () => {
    setErrorMessage(null)
    if (!capabilities.features.recurringPayments) {
      setErrorMessage('Los pagos recurrentes están desactivados temporalmente.')
      return
    }
    const payload = validation.validate(schema, { title, amount: parseDecimalInput(amount), categoryId, cardAccountId, startDate })
    if (payload) mutation.mutate(payload)
  }

  const isLoading = categoriesQuery.isLoading || cardsQuery.isLoading || rulesQuery.isLoading || optionsQuery.isLoading
  const error = categoriesQuery.error ?? cardsQuery.error ?? rulesQuery.error ?? optionsQuery.error

  return (
    <>
      <Stack.Screen options={{ title: isEditing ? 'Editar pago recurrente' : 'Nuevo pago recurrente' }} />
      <Screen>
        {isLoading ? <SkeletonForm label={t('states.loading')} fieldCount={4} /> : null}
        {error ? <DataStateCard message={error instanceof Error ? error.message : t('states.error')} /> : null}
        {!isLoading && !error && isEditing && !currentRule ? <DataStateCard message="No encontramos este pago recurrente. Vuelve a la lista e inténtalo nuevamente." /> : null}
        {!isLoading && !error && (!isEditing || currentRule) ? (
          <YStack gap="$5" pb="$5">
            <PaymentKindSelector disabled={isEditing} value={kind} onValueChange={(value) => { setKind(value); setErrorMessage(null); validation.clearError('categoryId'); validation.clearError('cardAccountId') }} />

            <FormTextField label={t('forms.name')} required error={validation.errors.title} icon={<FileText size={21} color="$primary" />} placeholder="Ej. Alquiler, Internet, BCP Visa" value={title} onChangeText={(value) => { setTitle(value); validation.clearError('title') }} />

            {kind === 'fixed_payment' ? (
              isEditing ? (
                <MovementAmountField currency={currency} error={validation.errors.amount} helperText="La moneda no se puede cambiar al editar un pago recurrente para mantener consistentes sus ocurrencias y pagos." value={amount} onChangeText={(value) => { setAmount(value); validation.clearError('amount') }} />
              ) : (
                <FintSheetSelect label={t('forms.currency')} showLabel={false} placeholder={t('forms.select')} searchable searchPlaceholder={t('accounts.searchCurrency')} value={selectedCurrency} onValueChange={setSelectedCurrency} options={currencyOptions} renderTrigger={({ onPress }) => <MovementAmountField currency={currency} error={validation.errors.amount} helperText="Toca la moneda del monto para cambiarla." value={amount} onChangeText={(value) => { setAmount(value); validation.clearError('amount') }} onCurrencyPress={onPress} />} />
              )
            ) : null}

            <FintFormField label="Frecuencia" showLabel={false}>
              <FintSheetSelect label="Frecuencia" showLabel={false} placeholder="Selecciona frecuencia" value={frequency} onValueChange={(value) => setFrequency(value as Frequency)} options={(['weekly', 'biweekly', 'monthly', 'yearly'] as const).map((item) => ({ value: item, label: frequencyLabel(item) }))} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<Repeat size={21} color="$primary" />} label="Frecuencia" required onPress={onPress} value={selectedLabel} />} />
            </FintFormField>

            <FintFormField label="Primera fecha" required error={validation.errors.startDate} showLabel={false}><FintDateField label="Primera fecha" showLabel={false} placeholder="Selecciona fecha" value={startDate} onValueChange={(value) => { setStartDate(value); validation.clearError('startDate') }} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<CalendarDays size={21} color="$primary" />} invalid={Boolean(validation.errors.startDate)} label="Primera fecha" required onPress={onPress} value={selectedLabel} />} /></FintFormField>

            {kind === 'fixed_payment' ? (
              <FintFormField label="Categoría" required error={validation.errors.categoryId} showLabel={false}>
                <CategoryPickerSheet categories={categories} showLabel={false} type="expense" value={selectedCategory?.name ?? ''} onValueChange={(name) => { setCategoryId(categories.find((category) => category.name === name)?.id ?? ''); validation.clearError('categoryId') }} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<Shapes size={21} color="$primary" />} invalid={Boolean(validation.errors.categoryId)} label="Categoría" required onPress={onPress} value={selectedLabel} />} />
                {categories.length === 0 ? <ReferenceHint message="Crea primero una categoría de gasto." action="Crear categoría" onPress={() => router.push('/categories')} /> : null}
              </FintFormField>
            ) : null}

            {kind === 'credit_card' ? (
              <FintFormField label="Tarjeta" required error={validation.errors.cardAccountId} showLabel={false}>
                {isEditing ? <MovementPickerTrigger icon={<CreditCard size={21} color="$primary" />} invalid={Boolean(validation.errors.cardAccountId)} label="Tarjeta" required onPress={() => undefined} value={selectedCard ? `${selectedCard.name} · ${selectedCard.currency}` : 'Tarjeta no disponible'} /> : <FintSheetSelect label="Tarjeta" showLabel={false} placeholder="Selecciona tarjeta" searchable value={cardAccountId} onValueChange={(value) => { setCardAccountId(value); validation.clearError('cardAccountId') }} options={cards.map((card) => ({ value: card.id, label: `${card.name} · ${card.currency}` }))} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<CreditCard size={21} color="$primary" />} invalid={Boolean(validation.errors.cardAccountId)} label="Tarjeta" required onPress={onPress} value={selectedLabel} />} />}
                {cards.length === 0 && !isEditing ? <ReferenceHint message="Crea una tarjeta o elimina la regla existente de esa tarjeta." action="Crear cuenta" onPress={() => router.push('/account-form')} /> : null}
              </FintFormField>
            ) : null}

            {errorMessage ? <XStack bg="$red2" borderColor="$red6" borderWidth={1} rounded="$5" p="$3"><Paragraph color="$red11" fontSize="$2">{errorMessage}</Paragraph></XStack> : null}
            <YStack gap="$2">
              <FintButton width="100%" minH={52} disabled={mutation.isPending} icon={mutation.isPending ? <Spinner color="$primaryForeground" /> : <Save size={18} />} onPress={submit}>{mutation.isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear pago recurrente'}</FintButton>
              <FintButton width="100%" minH={48} variant="outlined" disabled={mutation.isPending} onPress={() => router.back()}>{t('actions.cancel')}</FintButton>
            </YStack>
          </YStack>
        ) : null}
      </Screen>
    </>
  )
}

function PaymentKindSelector({ disabled = false, onValueChange, value }: { disabled?: boolean; onValueChange: (value: RuleKind) => void; value: RuleKind }) {
  return (
    <FintCard p="$1" bg="$muted" rounded="$7">
      <XStack gap="$1">
        {(['fixed_payment', 'credit_card'] as const).map((option) => {
          const selected = value === option
          const card = option === 'credit_card'
          const label = card ? 'Tarjeta' : 'Pago fijo'
          const Icon = card ? CreditCard : Repeat
          return (
            <FintButton
              key={option}
              flex={1}
              minH={56}
              variant="solid"
              disabled={disabled}
              bg={selected ? '$secondary' : 'transparent'}
              color={selected ? '$primary' : '$color10'}
              borderColor={selected ? '$primary' : 'transparent'}
              borderWidth={1}
              icon={<YStack width={30} height={30} rounded="$10" bg={selected ? '$primary' : '$color4'} items="center" justify="center"><Icon size={16} color={selected ? '$primaryForeground' : '$color10'} /></YStack>}
              onPress={() => onValueChange(option)}
            >
              {label}
            </FintButton>
          )
        })}
      </XStack>
    </FintCard>
  )
}

function ReferenceHint({ action, message, onPress }: { action: string; message: string; onPress: () => void }) {
  return <YStack bg="$secondary" gap="$2" mt="$2" p="$3" rounded="$5"><Paragraph color="$color12" fontWeight="700">{message}</Paragraph><FintButton size="$3" variant="outlined" onPress={onPress}>{action}</FintButton></YStack>
}

function frequencyLabel(value: Frequency) {
  if (value === 'weekly') return 'Semanal'
  if (value === 'biweekly') return 'Quincenal'
  if (value === 'yearly') return 'Anual'
  return 'Mensual'
}
