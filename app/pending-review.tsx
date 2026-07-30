import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CalendarDays, Save, Shapes, Trash2, WalletCards } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, Paragraph, Spinner, XStack, YStack } from 'tamagui'
import { z } from 'zod'
import { financeApi } from '../src/api/finance'
import { formatMoney } from '../src/api/mappers'
import type { PendingMovementDetail, PaymentOccurrence, TransactionType } from '../src/api/types'
import { CategoryPickerSheet } from '../src/components/CategoryPickerSheet'
import { DataStateCard } from '../src/components/DataStateCard'
import { MovementAmountField, MovementNoteField, MovementPickerTrigger, MovementTypeSelector } from '../src/components/MovementFormControls'
import { Screen } from '../src/components/Screen'
import { SkeletonForm } from '../src/components/Skeleton'
import { todayDateString } from '../src/finance/dates'
import { getValidationMessage, parseDecimalInput, useSubmitValidation } from '../src/forms'
import { FintButton, FintDateField, FintFormField, FintSheetSelect } from '../src/ui'
import { getInstallationId } from '../src/notifications/pushNotifications'

type PendingField = 'accountId' | 'amount' | 'categoryId' | 'transactionDate'
const NORMAL_MOVEMENT = '__transaction__'

export default function PendingReviewScreen() {
  const router = useRouter()
  const { i18n, t } = useTranslation()
  const toast = useToastController()
  const queryClient = useQueryClient()
  const params = useLocalSearchParams<{ id?: string }>()
  const pendingId = params.id ?? ''
  const hydratedId = useRef<string | null>(null)
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [transactionDate, setTransactionDate] = useState(todayDateString)
  const [accountId, setAccountId] = useState('')
  const [category, setCategory] = useState('')
  const [paymentOccurrenceId, setPaymentOccurrenceId] = useState(NORMAL_MOVEMENT)
  const [note, setNote] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const validation = useSubmitValidation<PendingField>()

  const detailQuery = useQuery({ queryKey: ['pending-movements', 'detail', pendingId], queryFn: ({ signal }) => financeApi.getPendingMovement(pendingId, signal), enabled: Boolean(pendingId), retry: false })
  const accountsQuery = useQuery({ queryKey: ['account-options'], queryFn: () => financeApi.listAccountOptions(), enabled: Boolean(detailQuery.data), retry: false })
  const categoriesQuery = useQuery({ queryKey: ['categories', type], queryFn: () => financeApi.listCategories(type), enabled: Boolean(detailQuery.data), retry: false })
  const occurrencesQuery = useQuery({ queryKey: ['payment-occurrences', 'open'], queryFn: ({ signal }) => financeApi.listPaymentOccurrences({ status: 'open' }, signal), enabled: Boolean(detailQuery.data), retry: false })
  const accounts = accountsQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const selectedAccount = accounts.find((item) => item.id === accountId)
  const selectedCategory = categories.find((item) => item.name === category)
  const selectedOccurrence = occurrencesQuery.data?.find((occurrence) => occurrence.id === paymentOccurrenceId)
  const paymentOccurrences = compatibleOccurrences(occurrencesQuery.data ?? [], detailQuery.data)
  const isReferenceLoading = accountsQuery.isLoading || categoriesQuery.isLoading
  const isFormLoading = detailQuery.isLoading || (Boolean(detailQuery.data) && isReferenceLoading)

  const requiredMessage = getValidationMessage(t, i18n.resolvedLanguage, 'required')
  const schema = z.object({
    amount: z.number({ error: getValidationMessage(t, i18n.resolvedLanguage, 'amount') }).positive(getValidationMessage(t, i18n.resolvedLanguage, 'positiveAmount')),
    transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, getValidationMessage(t, i18n.resolvedLanguage, 'date')),
    accountId: z.string().uuid(requiredMessage),
    categoryId: paymentOccurrenceId === NORMAL_MOVEMENT ? z.string().uuid(requiredMessage) : z.string().optional(),
  })

  useEffect(() => {
    const detail = detailQuery.data
    if (!detail || hydratedId.current === detail.id) return
    hydratedId.current = detail.id
    setType(detail.type ?? 'expense')
    setAmount(detail.amount === null ? '' : String(detail.amount))
    setTransactionDate(detail.transactionDate)
    setAccountId(detail.accountSuggestion?.id ?? '')
  }, [detailQuery.data])

  useEffect(() => {
    if (accountId && !accounts.some((account) => account.id === accountId)) setAccountId('')
  }, [accountId, accounts])

  useEffect(() => {
    if (category && !categories.some((item) => item.name === category)) setCategory('')
  }, [categories, category])

  const confirmMutation = useMutation({
    mutationFn: async (payload: z.infer<typeof schema> & { currency: string; categoryId?: string | null }) => {
      const detail = detailQuery.data
      if (!detail) throw new Error(t('states.error'))
      const originInstallationId = await getInstallationId()
      if (selectedOccurrence) return financeApi.confirmPendingMovement(pendingId, {
        mode: 'payment',
        paymentOccurrenceId: selectedOccurrence.id,
        title: detail.title,
        type: 'expense',
        amount: payload.amount,
        currency: selectedOccurrence.currency,
        transactionDate: payload.transactionDate,
        accountId: payload.accountId,
        categoryId: null,
        note: note.trim() || null,
        originInstallationId,
      })
      return financeApi.confirmPendingMovement(pendingId, {
        mode: 'transaction',
        title: detail.title,
        type,
        ...payload,
        categoryId: payload.categoryId!,
        note: note.trim() || null,
      })
    },
    onSuccess: async () => {
      await invalidatePendingAndFinance(queryClient)
      toast.show(t('movements.createdToast'), { message: t('movements.createdMessage'), preset: 'success' })
      router.back()
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : t('states.error')),
  })

  const discardMutation = useMutation({
    mutationFn: () => financeApi.discardPendingMovement(pendingId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pending-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['pending-movements', 'summary'] }),
      ])
      toast.show(t('movementUx.pendingDiscarded', { defaultValue: 'Pendiente descartado' }), { preset: 'success' })
      router.back()
    },
    onError: (error) => setErrorMessage(error instanceof Error ? error.message : t('states.error')),
  })

  const submit = () => {
    setErrorMessage(null)
    const payload = validation.validate(schema, {
      amount: parseDecimalInput(amount),
      transactionDate,
      accountId,
      categoryId: paymentOccurrenceId === NORMAL_MOVEMENT ? selectedCategory?.id ?? '' : undefined,
    })
    if (payload && selectedAccount) confirmMutation.mutate({ ...payload, currency: selectedOccurrence?.currency ?? selectedAccount.currency })
  }
  const isPending = confirmMutation.isPending || discardMutation.isPending

  return (
    <>
      <Stack.Screen options={{ title: t('movementUx.reviewPendingTitle', { defaultValue: 'Revisar pendiente' }) }} />
      <Screen>
        {isFormLoading ? <SkeletonForm label={t('states.loading')} showSegment fieldCount={3} /> : null}
        {detailQuery.error ? <DataStateCard message={detailQuery.error instanceof Error ? detailQuery.error.message : t('states.error')} onRetry={() => { void detailQuery.refetch() }} /> : null}
        {detailQuery.data && !isReferenceLoading ? (
          <YStack gap="$5" pb="$5">
            <MovementTypeSelector value={type} onValueChange={(value) => { setType(value); setCategory(''); setPaymentOccurrenceId(NORMAL_MOVEMENT); validation.clearError('categoryId'); setErrorMessage(null) }} />

            <YStack gap="$1" px="$1">
              <Paragraph color="$color10" fontSize="$1" fontWeight="600">{t('forms.title', { defaultValue: 'Título del correo' })}</Paragraph>
              <Paragraph color="$color12" fontFamily="$heading" fontSize="$5" fontWeight="800" lineHeight="$6">{detailQuery.data.title}</Paragraph>
            </YStack>

            <MovementAmountField currency={selectedAccount?.currency ?? detailQuery.data.currency ?? 'PEN'} error={validation.errors.amount} value={amount} onChangeText={(value) => { setAmount(value); validation.clearError('amount') }} />

            <YStack gap="$4">
                <FintFormField label={t('forms.account')} required error={validation.errors.accountId} showLabel={false}>
                  <FintSheetSelect label={t('forms.account')} showLabel={false} placeholder={accounts.length ? t('movements.selectAccount') : t('debts.noPaymentAccounts')} value={accountId} onValueChange={(value) => { setAccountId(value); validation.clearError('accountId') }} options={accounts.map((item) => ({ value: item.id, label: `${item.name} · ${item.currency}` }))} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<WalletCards size={21} color="$primary" />} invalid={Boolean(validation.errors.accountId)} label={t('forms.account')} required onPress={onPress} value={selectedLabel} />} />
                </FintFormField>
                {type === 'expense' && paymentOccurrences.length ? <FintFormField label="Aplicar a pago" showLabel={false}><FintSheetSelect label="Aplicar a pago" showLabel={false} placeholder="Movimiento normal" value={paymentOccurrenceId} onValueChange={(value) => { setPaymentOccurrenceId(value); validation.clearError('categoryId') }} options={[{ value: NORMAL_MOVEMENT, label: 'Movimiento normal' }, ...paymentOccurrences.map((occurrence) => ({ value: occurrence.id, label: `${occurrence.title} · ${formatMoney(occurrence.remainingAmount ?? 0, occurrence.currency)}` }))]} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<CalendarClock size={21} color="$primary" />} label="Aplicar a pago" onPress={onPress} value={selectedLabel} />} /></FintFormField> : null}
                {paymentOccurrenceId === NORMAL_MOVEMENT ? <FintFormField label={t('forms.category')} required error={validation.errors.categoryId} showLabel={false}>
                  <CategoryPickerSheet categories={categories} showLabel={false} type={type} value={category} onValueChange={(value) => { setCategory(value); validation.clearError('categoryId') }} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<Shapes size={21} color="$primary" />} invalid={Boolean(validation.errors.categoryId)} label={t('forms.category')} required onPress={onPress} value={selectedLabel} />} />
                </FintFormField> : <Paragraph color="$color10" fontSize="$1">Se registrará como pago de la ocurrencia y usará la categoría configurada en ese pago recurrente.</Paragraph>}
            </YStack>

            <FintFormField label={t('movements.date')} required error={validation.errors.transactionDate} showLabel={false}>
              <FintDateField label={t('movements.date')} showLabel={false} placeholder={t('movements.selectDate')} value={transactionDate} onValueChange={(value) => { setTransactionDate(value); validation.clearError('transactionDate') }} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<CalendarDays size={21} color="$primary" />} invalid={Boolean(validation.errors.transactionDate)} label={t('movements.date')} required onPress={onPress} value={selectedLabel} />} />
            </FintFormField>
            <MovementNoteField label={t('movementUx.noteOptional')} placeholder={t('movementUx.notePlaceholder')} value={note} onChangeText={setNote} />

            {accountsQuery.error || categoriesQuery.error ? <Paragraph color="$red10">{t('movements.referencesError')}</Paragraph> : null}
            {errorMessage ? <Paragraph color="$red10">{errorMessage}</Paragraph> : null}
            <YStack gap="$2">
              <FintButton width="100%" minH={52} disabled={isPending || isReferenceLoading} icon={confirmMutation.isPending ? <Spinner color="$primaryForeground" /> : <Save size={18} />} onPress={submit}>{confirmMutation.isPending ? t('movements.creating') : t('movementUx.confirmPending')}</FintButton>
              <FintButton width="100%" minH={48} variant="outlined" color="$red10" borderColor="$red6" disabled={isPending || !pendingId} icon={<Trash2 size={16} />} onPress={() => setDiscardOpen(true)}>{t('movementUx.discardPending')}</FintButton>
            </YStack>
          </YStack>
        ) : null}
      </Screen>
      <DiscardPendingDialog isPending={discardMutation.isPending} open={discardOpen} onCancel={() => setDiscardOpen(false)} onConfirm={() => discardMutation.mutate()} />
    </>
  )
}

async function invalidatePendingAndFinance(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['pending-movements'] }),
    queryClient.invalidateQueries({ queryKey: ['transactions'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['summary'] }),
    queryClient.invalidateQueries({ queryKey: ['accounts'] }),
    queryClient.invalidateQueries({ queryKey: ['reports'] }),
  ])
}

function compatibleOccurrences(occurrences: PaymentOccurrence[], detail: PendingMovementDetail | undefined) {
  if (!detail || detail.type !== 'expense' || detail.amount === null || !detail.currency) return []
  return occurrences.filter((occurrence) => occurrence.currency === detail.currency && occurrence.amountStatus === 'confirmed' && (occurrence.remainingAmount ?? 0) >= detail.amount!)
}

function DiscardPendingDialog({ isPending, onCancel, onConfirm, open }: { isPending: boolean; onCancel: () => void; onConfirm: () => void; open: boolean }) {
  const { t } = useTranslation()
  return <Dialog modal open={open} onOpenChange={(nextOpen) => !nextOpen && !isPending && onCancel()}><Dialog.Portal><Dialog.Overlay bg="rgba(4,18,28,0.68)" /><Dialog.Content bordered elevate bg="$popover" borderColor="$borderColor" rounded="$7" width="88%" maxW={420} p="$5" gap="$4"><Dialog.Title color="$color12" fontFamily="$heading" fontSize="$6" fontWeight="700">{t('movementUx.discardPendingTitle', { defaultValue: '¿Descartar este pendiente?' })}</Dialog.Title><Dialog.Description color="$color10">{t('movementUx.discardPendingDescription', { defaultValue: 'El pendiente se ocultará y no creará ningún movimiento.' })}</Dialog.Description><XStack gap="$3"><Button flex={1} chromeless disabled={isPending} onPress={onCancel}>{t('actions.cancel')}</Button><Button flex={1} bg="$destructive" color="white" fontWeight="700" disabled={isPending} icon={isPending ? <Spinner color="white" /> : <Trash2 size={17} color="white" />} onPress={onConfirm}>{t('movementUx.discardPending')}</Button></XStack></Dialog.Content></Dialog.Portal></Dialog>
}
