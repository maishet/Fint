import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CreditCard, FileText, Repeat, Save, Shapes } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paragraph, ScrollView, Spinner, XStack, YStack } from 'tamagui'
import { z } from 'zod'
import { financeApi } from '../src/api/finance'
import type { PaymentRule } from '../src/api/types'
import { DataStateCard } from '../src/components/DataStateCard'
import { FormTextField, MovementAmountField, MovementPickerTrigger } from '../src/components/MovementFormControls'
import { Screen } from '../src/components/Screen'
import { SkeletonForm } from '../src/components/Skeleton'
import { todayDateString } from '../src/finance/dates'
import { getValidationMessage, parseDecimalInput, useSubmitValidation } from '../src/forms'
import { FintButton, FintCard, FintDateField, FintFormField } from '../src/ui'

type RuleKind = 'fixed_payment' | 'credit_card'
type Frequency = PaymentRule['frequency']

export default function DebtFormScreen() {
  const { i18n, t } = useTranslation()
  const router = useRouter()
  const toast = useToastController()
  const queryClient = useQueryClient()
  const categoriesQuery = useQuery({ queryKey: ['categories', 'expense'], queryFn: () => financeApi.listCategories('expense'), retry: false })
  const cardsQuery = useQuery({ queryKey: ['account-options', 'credit-card'], queryFn: () => financeApi.listAccountOptions({ accountType: 'credit_card' }), retry: false })
  const optionsQuery = useQuery({ queryKey: ['finance-options'], queryFn: financeApi.getFinanceOptions, retry: false })
  const categories = categoriesQuery.data ?? []
  const cards = cardsQuery.data ?? []
  const [kind, setKind] = useState<RuleKind>('fixed_payment')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [startDate, setStartDate] = useState(todayDateString)
  const [categoryId, setCategoryId] = useState('')
  const [cardAccountId, setCardAccountId] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const validation = useSubmitValidation<'title' | 'amount' | 'categoryId' | 'cardAccountId' | 'startDate'>()
  const currency = cards.find((card) => card.id === cardAccountId)?.currency ?? optionsQuery.data?.baseCurrency ?? 'PEN'
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima'
  const amountMessage = getValidationMessage(t, i18n.resolvedLanguage, 'amount')
  const schema = z.object({
    title: z.string().trim().min(2, getValidationMessage(t, i18n.resolvedLanguage, 'minTwo')),
    amount: kind === 'fixed_payment' ? z.number({ error: amountMessage }).positive(getValidationMessage(t, i18n.resolvedLanguage, 'positiveAmount')) : z.number().optional(),
    categoryId: kind === 'fixed_payment' ? z.string().uuid(getValidationMessage(t, i18n.resolvedLanguage, 'required')) : z.string().optional(),
    cardAccountId: kind === 'credit_card' ? z.string().uuid(getValidationMessage(t, i18n.resolvedLanguage, 'required')) : z.string().optional(),
    startDate: z.string().date(getValidationMessage(t, i18n.resolvedLanguage, 'date')),
  })

  const mutation = useMutation({
    mutationFn: async (payload: z.infer<typeof schema>) => {
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
      toast.show('Pago recurrente creado', { message: 'La primera ocurrencia ya está lista.', preset: 'success', duration: 3500 })
      router.back()
    },
    onError: () => setErrorMessage('No se pudo crear el pago recurrente.'),
  })

  const submit = () => {
    setErrorMessage(null)
    const payload = validation.validate(schema, { title, amount: parseDecimalInput(amount), categoryId, cardAccountId, startDate })
    if (payload) mutation.mutate(payload)
  }

  const isLoading = categoriesQuery.isLoading || cardsQuery.isLoading || optionsQuery.isLoading
  const error = categoriesQuery.error ?? cardsQuery.error ?? optionsQuery.error

  return (
    <>
      <Stack.Screen options={{ title: 'Nuevo pago recurrente' }} />
      <Screen>
        {isLoading ? <SkeletonForm label={t('states.loading')} fieldCount={4} /> : null}
        {error ? <DataStateCard message={error instanceof Error ? error.message : t('states.error')} /> : null}
        {!isLoading && !error ? (
          <YStack gap="$5" pb="$5">
            <FintCard gap="$3" p="$3">
              <Paragraph color="$color10" fontSize="$1" fontWeight="600">Tipo de pago</Paragraph>
              <XStack gap="$2">
                <KindButton icon={<Repeat size={18} color={kind === 'fixed_payment' ? '$primaryForeground' : '$primary'} />} label="Pago fijo" selected={kind === 'fixed_payment'} onPress={() => setKind('fixed_payment')} />
                <KindButton icon={<CreditCard size={18} color={kind === 'credit_card' ? '$primaryForeground' : '$primary'} />} label="Tarjeta" selected={kind === 'credit_card'} onPress={() => setKind('credit_card')} />
              </XStack>
            </FintCard>

            <FormTextField label={t('forms.name')} required error={validation.errors.title} icon={<FileText size={21} color="$primary" />} placeholder="Ej. Alquiler, Internet, BCP Visa" value={title} onChangeText={(value) => { setTitle(value); validation.clearError('title') }} />

            {kind === 'fixed_payment' ? <MovementAmountField currency={currency} error={validation.errors.amount} value={amount} onChangeText={(value) => { setAmount(value); validation.clearError('amount') }} /> : null}

            <FintFormField label="Frecuencia" showLabel={false}>
              <FintCard gap="$3" p="$3">
                <Paragraph color="$color10" fontSize="$1" fontWeight="600">Frecuencia</Paragraph>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {(['weekly', 'biweekly', 'monthly', 'yearly'] as const).map((item) => <OptionPill key={item} selected={frequency === item} title={frequencyLabel(item)} onPress={() => setFrequency(item)} />)}
                </ScrollView>
              </FintCard>
            </FintFormField>

            <FintFormField label="Primera fecha" required error={validation.errors.startDate} showLabel={false}><FintDateField label="Primera fecha" showLabel={false} placeholder="Selecciona fecha" value={startDate} onValueChange={(value) => { setStartDate(value); validation.clearError('startDate') }} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<CalendarDays size={21} color="$primary" />} invalid={Boolean(validation.errors.startDate)} label="Primera fecha" required onPress={onPress} value={selectedLabel} />} /></FintFormField>

            {kind === 'fixed_payment' ? <OptionRail title="Categoría" empty="Crea primero una categoría de gasto." error={validation.errors.categoryId}>{categories.map((category) => <SelectCard key={category.id} icon={<Shapes size={18} color="$primary" />} selected={categoryId === category.id} title={`${category.icon ?? ''} ${category.name}`.trim()} subtitle="Gasto" onPress={() => { setCategoryId(category.id); validation.clearError('categoryId') }} />)}</OptionRail> : null}
            {kind === 'credit_card' ? <OptionRail title="Tarjeta" empty="Crea primero una cuenta de tipo tarjeta." error={validation.errors.cardAccountId}>{cards.map((card) => <SelectCard key={card.id} icon={<CreditCard size={18} color="$primary" />} selected={cardAccountId === card.id} title={card.name} subtitle={card.currency} onPress={() => { setCardAccountId(card.id); validation.clearError('cardAccountId') }} />)}</OptionRail> : null}

            {errorMessage ? <XStack bg="$red2" borderColor="$red6" borderWidth={1} rounded="$5" p="$3"><Paragraph color="$red11" fontSize="$2">{errorMessage}</Paragraph></XStack> : null}
            <YStack gap="$2">
              <FintButton width="100%" minH={52} disabled={mutation.isPending} icon={mutation.isPending ? <Spinner color="$primaryForeground" /> : <Save size={18} />} onPress={submit}>{mutation.isPending ? 'Creando...' : 'Crear pago recurrente'}</FintButton>
              <FintButton width="100%" minH={48} variant="outlined" disabled={mutation.isPending} onPress={() => router.back()}>{t('actions.cancel')}</FintButton>
            </YStack>
          </YStack>
        ) : null}
      </Screen>
    </>
  )
}

function KindButton({ icon, label, onPress, selected }: { icon: React.ReactNode; label: string; onPress: () => void; selected: boolean }) {
  return <XStack flex={1} items="center" justify="center" gap="$2" minH={50} rounded="$6" bg={selected ? '$primary' : '$muted'} borderColor={selected ? '$primary' : '$input'} borderWidth={1} onPress={onPress} role="button" cursor="pointer">{icon}<Paragraph color={selected ? '$primaryForeground' : '$color12'} fontWeight="800">{label}</Paragraph></XStack>
}

function OptionPill({ onPress, selected, title }: { onPress: () => void; selected: boolean; title: string }) {
  return <XStack minH={44} px="$4" items="center" rounded="$10" bg={selected ? '$secondary' : '$muted'} borderColor={selected ? '$primary' : '$input'} borderWidth={1} onPress={onPress} role="button" cursor="pointer"><Paragraph color={selected ? '$primary' : '$color12'} fontWeight="800">{title}</Paragraph></XStack>
}

function OptionRail({ children, empty, error, title }: { children: React.ReactNode; empty: string; error?: string; title: string }) {
  return <FintFormField label={title} required error={error}><FintCard gap="$3" p="$3"><Paragraph color="$color10" fontSize="$1" fontWeight="600">{title}</Paragraph><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>{children}</ScrollView>{!children ? <Paragraph color="$color10" fontSize="$1">{empty}</Paragraph> : null}</FintCard></FintFormField>
}

function SelectCard({ icon, onPress, selected, subtitle, title }: { icon: React.ReactNode; onPress: () => void; selected: boolean; subtitle: string; title: string }) {
  return <XStack width={190} minH={68} items="center" gap="$3" p="$3" rounded="$6" bg={selected ? '$secondary' : '$muted'} borderColor={selected ? '$primary' : '$input'} borderWidth={1} onPress={onPress} role="button" cursor="pointer">{icon}<YStack flex={1} minW={0}><Paragraph color="$color12" fontWeight="700" numberOfLines={1}>{title}</Paragraph><Paragraph color="$color10" fontSize="$1" numberOfLines={1}>{subtitle}</Paragraph></YStack></XStack>
}

function frequencyLabel(value: Frequency) {
  if (value === 'weekly') return 'Semanal'
  if (value === 'biweekly') return 'Quincenal'
  if (value === 'yearly') return 'Anual'
  return 'Mensual'
}
