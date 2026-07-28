import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Save, Trash2 } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, Paragraph, Spinner, XStack, YStack } from 'tamagui'
import { z } from 'zod'
import { financeApi } from '../src/api/finance'
import type { TransactionType } from '../src/api/types'
import { CategoryPickerSheet } from '../src/components/CategoryPickerSheet'
import { DataStateCard } from '../src/components/DataStateCard'
import { Screen } from '../src/components/Screen'
import { SkeletonGroup, SkeletonList } from '../src/components/Skeleton'
import { todayDateString } from '../src/finance/dates'
import { getValidationMessage, parseDecimalInput, useSubmitValidation } from '../src/forms'
import { FintButton, FintDateField, FintFormField, FintInput, FintSheetSelect } from '../src/ui'

type PendingField = 'accountId' | 'amount' | 'categoryId' | 'transactionDate'

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
  const [note, setNote] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const validation = useSubmitValidation<PendingField>()

  const detailQuery = useQuery({ queryKey: ['pending-movements', 'detail', pendingId], queryFn: ({ signal }) => financeApi.getPendingMovement(pendingId, signal), enabled: Boolean(pendingId), retry: false })
  const accountsQuery = useQuery({ queryKey: ['account-options'], queryFn: () => financeApi.listAccountOptions(), enabled: Boolean(detailQuery.data), retry: false })
  const categoriesQuery = useQuery({ queryKey: ['categories', type], queryFn: () => financeApi.listCategories(type), enabled: Boolean(detailQuery.data), retry: false })
  const accounts = accountsQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const selectedAccount = accounts.find((item) => item.id === accountId)
  const selectedCategory = categories.find((item) => item.name === category)
  const isReferenceLoading = accountsQuery.isLoading || categoriesQuery.isLoading

  const requiredMessage = getValidationMessage(t, i18n.resolvedLanguage, 'required')
  const schema = z.object({
    amount: z.number({ error: getValidationMessage(t, i18n.resolvedLanguage, 'amount') }).positive(getValidationMessage(t, i18n.resolvedLanguage, 'positiveAmount')),
    transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, getValidationMessage(t, i18n.resolvedLanguage, 'date')),
    accountId: z.string().uuid(requiredMessage),
    categoryId: z.string().uuid(requiredMessage),
  })

  useEffect(() => {
    const detail = detailQuery.data
    if (!detail || hydratedId.current === detail.id) return
    hydratedId.current = detail.id
    setType(detail.type)
    setAmount(String(detail.amount))
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
    mutationFn: (payload: z.infer<typeof schema> & { currency: string }) => {
      const detail = detailQuery.data
      if (!detail) throw new Error(t('states.error'))
      return financeApi.confirmPendingMovement(pendingId, {
        mode: 'transaction',
        title: detail.title,
        type,
        ...payload,
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
      categoryId: selectedCategory?.id ?? '',
    })
    if (payload && selectedAccount) confirmMutation.mutate({ ...payload, currency: selectedAccount.currency })
  }
  const isPending = confirmMutation.isPending || discardMutation.isPending

  return (
    <>
      <Stack.Screen options={{ title: t('movementUx.reviewPendingTitle', { defaultValue: 'Revisar pendiente' }) }} />
      <Screen>
        {detailQuery.isLoading ? <SkeletonGroup label={t('states.loading')}><SkeletonList rows={6} /></SkeletonGroup> : null}
        {detailQuery.error ? <DataStateCard message={detailQuery.error instanceof Error ? detailQuery.error.message : t('states.error')} onRetry={() => { void detailQuery.refetch() }} /> : null}
        {detailQuery.data ? (
          <YStack gap="$5" pb="$5">
            <XStack gap="$2" bg="$muted" borderColor="$borderColor" borderWidth={1} rounded={14} p="$1">
              {(['expense', 'income'] as const).map((option) => (
                <FintButton key={option} flex={1} variant="solid" bg={type === option ? option === 'income' ? '$green9' : '$red9' : '$card'} color={type === option ? 'white' : '$color11'} borderColor={type === option ? option === 'income' ? '$green9' : '$red9' : '$borderColor'} borderWidth={1} icon={option === 'income' ? <ArrowUp size={16} color={type === option ? 'white' : '$color10'} /> : <ArrowDown size={16} color={type === option ? 'white' : '$color10'} />} onPress={() => { setType(option); setCategory(''); validation.clearError('categoryId'); setErrorMessage(null) }}>{t(`forms.${option}`)}</FintButton>
              ))}
            </XStack>

            <YStack gap="$2">
              <Paragraph color="$color10" fontSize="$2" fontWeight="600">{t('forms.title', { defaultValue: 'Título' })}</Paragraph>
              <Paragraph color="$color12" fontFamily="$heading" fontSize="$5" fontWeight="800" lineHeight="$6">{detailQuery.data.title}</Paragraph>
            </YStack>

            <FintFormField label={t('forms.amount')} required error={validation.errors.amount}>
              <YStack bg="$accent1" borderColor={validation.errors.amount ? '$red8' : '$accent5'} borderWidth={1} rounded="$7" p="$4" gap="$2">
                <Paragraph color="$accent11" fontSize="$1" fontWeight="800" textTransform="uppercase">{t('movementUx.detectedAmount', { defaultValue: 'Monto detectado' })}</Paragraph>
                <XStack items="center" gap="$3">
                  <Paragraph color="$primary" fontFamily="$heading" fontSize="$6" fontWeight="900">{selectedAccount?.currency ?? detailQuery.data.currency}</Paragraph>
                  <FintInput flex={1} minH={64} bg="$card" borderColor={validation.errors.amount ? '$red8' : '$accent5'} fontSize="$8" fontWeight="900" value={amount} onChangeText={(value) => { setAmount(value); validation.clearError('amount') }} keyboardType="decimal-pad" placeholder="0.00" />
                </XStack>
                <Paragraph color="$color10" fontSize="$1">{t('movementUx.accountCurrencyHint', { defaultValue: 'La moneda se define automáticamente según la cuenta.' })}</Paragraph>
              </YStack>
            </FintFormField>

            {isReferenceLoading ? <SkeletonGroup label={t('states.loading')}><SkeletonList rows={2} /></SkeletonGroup> : null}
            {!isReferenceLoading ? (
              <YStack gap="$4">
                <FintFormField label={t('forms.account')} required error={validation.errors.accountId} invalidBorder>
                  <FintSheetSelect label={t('forms.account')} showLabel={false} placeholder={accounts.length ? t('movements.selectAccount') : t('debts.noPaymentAccounts')} value={accountId} onValueChange={(value) => { setAccountId(value); validation.clearError('accountId') }} options={accounts.map((item) => ({ value: item.id, label: `${item.name} · ${item.currency}` }))} />
                </FintFormField>
                <FintFormField label={t('forms.category')} required error={validation.errors.categoryId} invalidBorder>
                  <CategoryPickerSheet categories={categories} showLabel={false} type={type} value={category} onValueChange={(value) => { setCategory(value); validation.clearError('categoryId') }} />
                </FintFormField>
              </YStack>
            ) : null}

            <FintFormField label={t('movements.date')} required error={validation.errors.transactionDate}>
              <FintDateField borderColor={validation.errors.transactionDate ? '$red8' : undefined} label={t('movements.date')} showLabel={false} placeholder={t('movements.selectDate')} value={transactionDate} onValueChange={(value) => { setTransactionDate(value); validation.clearError('transactionDate') }} />
            </FintFormField>
            <FintFormField label={t('movementUx.noteOptional')}><FintInput value={note} onChangeText={setNote} placeholder={t('movementUx.notePlaceholder')} multiline minH={88} textAlignVertical="top" /></FintFormField>

            {accountsQuery.error || categoriesQuery.error ? <Paragraph color="$red10">{t('movements.referencesError')}</Paragraph> : null}
            {errorMessage ? <Paragraph color="$red10">{errorMessage}</Paragraph> : null}
            <XStack gap="$2">
              <FintButton flex={1} variant="outlined" color="$red10" borderColor="$red6" disabled={isPending || !pendingId} icon={<Trash2 size={16} />} onPress={() => setDiscardOpen(true)}>{t('movementUx.discardPending')}</FintButton>
              <FintButton flex={1} disabled={isPending || isReferenceLoading} icon={confirmMutation.isPending ? <Spinner color="$primaryForeground" /> : <Save size={18} />} onPress={submit}>{confirmMutation.isPending ? t('movements.creating') : t('movementUx.confirmPending')}</FintButton>
            </XStack>
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
    queryClient.invalidateQueries({ queryKey: ['summary'] }),
    queryClient.invalidateQueries({ queryKey: ['accounts'] }),
    queryClient.invalidateQueries({ queryKey: ['reports'] }),
  ])
}

function DiscardPendingDialog({ isPending, onCancel, onConfirm, open }: { isPending: boolean; onCancel: () => void; onConfirm: () => void; open: boolean }) {
  const { t } = useTranslation()
  return <Dialog modal open={open} onOpenChange={(nextOpen) => !nextOpen && !isPending && onCancel()}><Dialog.Portal><Dialog.Overlay bg="rgba(4,18,28,0.68)" /><Dialog.Content bordered elevate bg="$popover" borderColor="$borderColor" rounded="$7" width="88%" maxW={420} p="$5" gap="$4"><Dialog.Title color="$color12" fontFamily="$heading" fontSize="$6" fontWeight="700">{t('movementUx.discardPendingTitle', { defaultValue: '¿Descartar este pendiente?' })}</Dialog.Title><Dialog.Description color="$color10">{t('movementUx.discardPendingDescription', { defaultValue: 'El pendiente se ocultará y no creará ningún movimiento.' })}</Dialog.Description><XStack gap="$3"><Button flex={1} chromeless disabled={isPending} onPress={onCancel}>{t('actions.cancel')}</Button><Button flex={1} bg="$destructive" color="white" fontWeight="700" disabled={isPending} icon={isPending ? <Spinner color="white" /> : <Trash2 size={17} color="white" />} onPress={onConfirm}>{t('movementUx.discardPending')}</Button></XStack></Dialog.Content></Dialog.Portal></Dialog>
}
