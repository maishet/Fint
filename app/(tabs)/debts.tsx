import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CalendarClock, CheckCircle2, CreditCard, HandCoins, Plus, Trash2 } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, Paragraph, Spinner, XStack, YStack } from 'tamagui'
import { financeApi } from '../../src/api/finance'
import { formatMoney, normalizeDebt } from '../../src/api/mappers'
import type { Debt, PaymentOccurrence } from '../../src/api/types'
import { DebtPaymentSheet } from '../../src/components/DebtPaymentSheet'
import { DataStateCard } from '../../src/components/DataStateCard'
import { Screen } from '../../src/components/Screen'
import { SkeletonGroup, SkeletonHero, SkeletonList } from '../../src/components/Skeleton'
import { formatDateString, parseDateString } from '../../src/finance/dates'
import { useThemeMode } from '../../src/theme/ThemeMode'
import { usePressOnce } from '../../src/hooks/usePressOnce'
import { FintButton, FintCard } from '../../src/ui'
import { getAppLocale } from '../../src/i18n'

export default function DebtsScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { themeMode } = useThemeMode()
  const toast = useToastController()
  const queryClient = useQueryClient()
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null)
  const pressOnce = usePressOnce()
  const debtsQuery = useQuery({ queryKey: ['debts'], queryFn: financeApi.listDebts, retry: false })
  const occurrencesQuery = useQuery({ queryKey: ['payment-occurrences', 'open'], queryFn: ({ signal }) => financeApi.listPaymentOccurrences({ status: 'open' }, signal), retry: false })
  const accountsQuery = useQuery({ queryKey: ['account-options', 'debt-payment', paymentDebt?.currency], queryFn: () => financeApi.listAccountOptions({ currency: paymentDebt?.currency, excludeAccountType: 'credit_card' }), retry: false, enabled: Boolean(paymentDebt) })
  const debts = (debtsQuery.data ?? []).map(normalizeDebt)
  const occurrences = occurrencesQuery.data ?? []
  const usesOccurrences = Boolean(occurrencesQuery.data && !occurrencesQuery.error)
  const accounts = accountsQuery.data ?? []
  const displayCurrency = usesOccurrences ? occurrences[0]?.currency ?? 'PEN' : debts[0]?.currency ?? 'PEN'
  const totalOutstanding = usesOccurrences ? occurrences.filter((item) => item.currency === displayCurrency).reduce((sum, item) => sum + (item.remainingAmount ?? 0), 0) : debts.filter((debt) => debt.currency === displayCurrency).reduce((sum, debt) => sum + debt.outstanding, 0)
  const locale = getAppLocale(i18n.resolvedLanguage)
  const nextDueDebt = usesOccurrences ? [...occurrences].filter((item) => item.dueDate).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0] : [...debts].filter((debt) => debt.dueDate).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0]
  const isLoading = usesOccurrences ? occurrencesQuery.isLoading : debtsQuery.isLoading
  const isRefreshing = debtsQuery.isRefetching || occurrencesQuery.isRefetching
  const error = usesOccurrences ? occurrencesQuery.error : debtsQuery.error

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financeApi.deleteDebt(id),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['debts'] }), queryClient.invalidateQueries({ queryKey: ['summary'] }), queryClient.invalidateQueries({ queryKey: ['reports'] })])
      setDeleteTarget(null)
      toast.show(t('debts.deletedToast'), { message: t('debts.deletedMessage'), preset: 'success' })
    },
    onError: () => toast.show(t('debts.deleteError'), { preset: 'error' }),
  })

  const openCreate = () => pressOnce(() => router.push('/debt-form'))
  const openEdit = (debt: Debt) => pressOnce(() => router.push({ pathname: '/debt-form', params: { debtId: debt.id } }))

  return (
    <>
      <Screen isRefreshing={isRefreshing} onRefresh={() => { void debtsQuery.refetch(); void occurrencesQuery.refetch() }}>
        {isLoading ? <SkeletonGroup label={t('states.loading')}><SkeletonHero /></SkeletonGroup> : null}
        {!isLoading && !error ? (
          <DebtHero
            count={usesOccurrences ? occurrences.length : debts.length}
            currency={displayCurrency}
            isDark={themeMode === 'dark'}
            nextDueDate={nextDueDebt?.dueDate ?? null}
            total={totalOutstanding}
          />
        ) : null}

        <XStack items="center" justify="space-between" gap="$3">
          <YStack gap="$1" flex={1}>
            <Paragraph color="$color12" fontFamily="$heading" fontSize="$6" fontWeight="700">{t('payments.upcoming', { defaultValue: 'Próximos pagos' })}</Paragraph>
            {!isLoading ? <Paragraph color="$color10" fontSize="$2">{usesOccurrences ? t('payments.count', { count: occurrences.length, defaultValue: '{{count}} pagos' }) : t('debts.pendingCount', { count: debts.length })}</Paragraph> : null}
          </YStack>
          <Button circular bg="$primary" icon={<Plus size={22} color="$primaryForeground" />} onPress={openCreate} aria-label={t('debts.newTitle')} />
        </XStack>

        {isLoading ? <SkeletonGroup label={t('states.loading')}><SkeletonList rows={3} /></SkeletonGroup> : null}
        {error ? <DataStateCard message={error instanceof Error ? error.message : t('states.error')} onRetry={() => { void debtsQuery.refetch() }} /> : null}
        {!isLoading && !error && (usesOccurrences ? occurrences.length === 0 : debts.length === 0) ? (
          <FintCard items="center" gap="$3" py="$6">
            <YStack width={54} height={54} rounded="$10" bg="$secondary" items="center" justify="center"><HandCoins size={26} color="$primary" /></YStack>
            <Paragraph color="$color12" fontFamily="$heading" fontSize="$5" fontWeight="700">{t('debts.emptyTitle')}</Paragraph>
            <Paragraph color="$color10" text="center" maxW={280}>{t('debts.emptyDescription')}</Paragraph>
            <FintButton icon={<Plus size={16} />} onPress={openCreate}>{t('debts.newTitle')}</FintButton>
          </FintCard>
        ) : null}

        {!isLoading && !error && usesOccurrences ? occurrences.map((occurrence) => <OccurrenceCard key={occurrence.id} occurrence={occurrence} locale={locale} />) : null}

        {!isLoading && !error && !usesOccurrences ? debts.map((debt) => (
          <DebtCard
            key={debt.id}
            debt={debt}
            locale={locale}
            onDelete={() => setDeleteTarget(debt)}
            onEdit={() => openEdit(debt)}
            onPay={() => setPaymentDebt(debt)}
          />
        )) : null}
      </Screen>

      <DebtPaymentSheet accounts={accounts} debt={paymentDebt} open={Boolean(paymentDebt)} onOpenChange={(open) => !open && setPaymentDebt(null)} />
      <DeleteDebtDialog account={deleteTarget} isPending={deleteMutation.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} />
    </>
  )
}

function OccurrenceCard({ locale, occurrence }: { locale: string; occurrence: PaymentOccurrence }) {
  const { t } = useTranslation()
  const due = getDueState(occurrence.dueDate, locale, t)
  const total = occurrence.totalAmount ?? 0
  const remaining = occurrence.remainingAmount ?? total
  const progress = total > 0 ? Math.min(100, Math.round((occurrence.paidAmount / total) * 100)) : 0
  const needsAmount = occurrence.amountStatus === 'required'
  const kindLabel = occurrence.kind === 'credit_card' ? t('payments.creditCard', { defaultValue: 'Tarjeta' }) : occurrence.kind === 'fixed_payment' ? t('payments.fixed', { defaultValue: 'Pago fijo' }) : t('payments.legacy', { defaultValue: 'Legacy' })
  return (
    <FintCard p="$3" gap="$3">
      <XStack items="flex-start" gap="$3">
        <YStack width={42} height={42} rounded="$9" bg={due.overdue ? '$red2' : '$secondary'} items="center" justify="center"><CalendarClock size={21} color={due.overdue ? '$red10' : '$primary'} /></YStack>
        <YStack flex={1} minW={0} gap="$1">
          <Paragraph color="$color12" fontFamily="$heading" fontSize="$4" fontWeight="700" numberOfLines={1}>{occurrence.title}</Paragraph>
          <Paragraph color="$color10" fontSize="$1">{kindLabel}{occurrence.cardAccount ? ` · ${occurrence.cardAccount}` : ''}</Paragraph>
          <Paragraph color={due.overdue ? '$red10' : '$color10'} fontSize="$1" fontWeight={due.overdue ? '700' : '500'}>{due.label}</Paragraph>
        </YStack>
        <YStack items="flex-end" gap="$1">
          <Paragraph color={needsAmount ? '$yellow10' : '$color12'} fontSize="$4" fontWeight="800" shrink={0}>{needsAmount ? t('payments.configureAmount', { defaultValue: 'Configura monto' }) : formatMoney(remaining, occurrence.currency)}</Paragraph>
          <Paragraph color="$color10" fontSize="$1">{statusLabel(occurrence.paymentStatus)}</Paragraph>
        </YStack>
      </XStack>
      <YStack gap="$1">
        <XStack justify="space-between"><Paragraph color="$color10" fontSize="$1">{t('debts.paidProgress', { progress })}</Paragraph><Paragraph color="$color10" fontSize="$1">{formatMoney(occurrence.paidAmount, occurrence.currency)} / {needsAmount ? '-' : formatMoney(total, occurrence.currency)}</Paragraph></XStack>
        <YStack height={5} rounded="$10" bg="$muted" overflow="hidden"><YStack width={`${progress}%`} height="100%" bg="$primary" rounded="$10" /></YStack>
      </YStack>
    </FintCard>
  )
}

function statusLabel(status: PaymentOccurrence['paymentStatus']) {
  if (status === 'paid') return 'Pagado'
  if (status === 'minimum_met') return 'Mínimo cubierto'
  if (status === 'partial') return 'Parcial'
  return 'Pendiente'
}

function DebtHero({ count, currency, isDark, nextDueDate, total }: { count: number; currency: string; isDark: boolean; nextDueDate: string | null; total: number }) {
  const { t, i18n } = useTranslation()
  const locale = getAppLocale(i18n.resolvedLanguage)
  return (
    <FintCard bg={isDark ? '#0B3046' : '#0F5D73'} borderColor={isDark ? '#1B5067' : '#28788C'} gap="$4" p="$4">
      <XStack items="center" justify="space-between" gap="$3">
        <YStack flex={1} minW={0} gap="$1">
          <Paragraph color="#B9D7E1" fontFamily="$heading" fontSize="$2" fontWeight="700" textTransform="uppercase">{t('debts.totalPending')}</Paragraph>
          <Paragraph color="#F4FBFD" fontFamily="$body" fontSize="$9" fontWeight="800" lineHeight="$9" numberOfLines={1} adjustsFontSizeToFit>{formatMoney(total, currency)}</Paragraph>
        </YStack>
        <YStack width={48} height={48} rounded="$10" bg="rgba(93,214,229,0.14)" borderColor="rgba(93,214,229,0.24)" borderWidth={1} items="center" justify="center"><HandCoins size={24} color="#5DD6E5" /></YStack>
      </XStack>
      <XStack gap="$4">
        <HeroMetric accent="#5DD6E5" label={t('debts.activeDebts')} value={String(count)} />
        <HeroMetric accent="#F28B82" label={t('debts.nextDue')} value={nextDueDate ? formatDateString(nextDueDate, locale) : t('debts.noDueDate')} />
      </XStack>
    </FintCard>
  )
}

function HeroMetric({ accent, label, value }: { accent: string; label: string; value: string }) {
  return <YStack flex={1} minW={0} gap="$1"><YStack height={4} rounded="$10" bg={accent as never} /><Paragraph color="#B9D7E1" fontSize="$1">{label}</Paragraph><Paragraph color="#F4FBFD" fontSize="$3" fontWeight="800" numberOfLines={1}>{value}</Paragraph></YStack>
}

function DebtCard({ debt, locale, onDelete, onEdit, onPay }: { debt: Debt; locale: string; onDelete: () => void; onEdit: () => void; onPay: () => void }) {
  const { t } = useTranslation()
  const due = getDueState(debt.dueDate, locale, t)
  const paid = Math.max(0, debt.originalAmount - debt.outstanding)
  const progress = debt.originalAmount > 0 ? Math.min(100, Math.round((paid / debt.originalAmount) * 100)) : 0

  return (
    <FintCard p="$3" gap="$3">
      <XStack items="flex-start" gap="$3">
        <XStack flex={1} minW={0} gap="$3" cursor="pointer" role="button" pressStyle={{ opacity: 0.76 }} onPress={onEdit} aria-label={t('debts.editAccessibility', { name: debt.description })}>
          <YStack width={42} height={42} rounded="$9" bg={due.overdue ? '$red2' : '$secondary'} items="center" justify="center"><AlertCircle size={21} color={due.overdue ? '$red10' : '$primary'} /></YStack>
          <YStack flex={1} minW={0} gap="$1">
            <Paragraph color="$color12" fontFamily="$heading" fontSize="$4" fontWeight="700" numberOfLines={1}>{debt.description}</Paragraph>
            {debt.account ? <XStack items="center" gap="$1"><CreditCard size={13} color="$color10" /><Paragraph color="$color10" fontSize="$1" numberOfLines={1}>{debt.account}</Paragraph></XStack> : null}
            <Paragraph color={due.overdue ? '$red10' : '$color10'} fontSize="$1" fontWeight={due.overdue ? '700' : '500'}>{due.label}</Paragraph>
            {debt.note ? <Paragraph color="$color10" fontSize="$1" numberOfLines={2}>{debt.note}</Paragraph> : null}
          </YStack>
          <Paragraph color="$color12" fontSize="$4" fontWeight="800" shrink={0}>{formatMoney(debt.outstanding, debt.currency)}</Paragraph>
        </XStack>
        <YStack gap="$1">
          <Button circular chromeless size="$3" icon={<CheckCircle2 size={19} color="$primary" />} onPress={onPay} aria-label={t('debts.payAccessibility', { name: debt.description })} />
          <Button circular chromeless size="$3" icon={<Trash2 size={18} color="$red10" />} onPress={onDelete} aria-label={t('debts.deleteAccessibility', { name: debt.description })} />
        </YStack>
      </XStack>
      <YStack gap="$1">
        <XStack justify="space-between"><Paragraph color="$color10" fontSize="$1">{t('debts.paidProgress', { progress })}</Paragraph><Paragraph color="$color10" fontSize="$1">{formatMoney(paid, debt.currency)} / {formatMoney(debt.originalAmount, debt.currency)}</Paragraph></XStack>
        <YStack height={5} rounded="$10" bg="$muted" overflow="hidden"><YStack width={`${progress}%`} height="100%" bg="$primary" rounded="$10" /></YStack>
      </YStack>
    </FintCard>
  )
}

function DeleteDebtDialog({ account, isPending, onCancel, onConfirm }: { account: Debt | null; isPending: boolean; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useTranslation()
  return (
    <Dialog modal open={Boolean(account)} onOpenChange={(open) => !open && !isPending && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay bg="rgba(4,18,28,0.68)" />
        <Dialog.Content bordered elevate bg="$popover" borderColor="$borderColor" rounded="$7" width="88%" maxW={420} p="$5" gap="$4">
          <Dialog.Title color="$color12" fontFamily="$heading" fontSize="$6" fontWeight="700">{t('debts.deleteTitle')}</Dialog.Title>
          <Dialog.Description color="$color10">{t('debts.deleteDescription', { name: account?.description ?? '' })}</Dialog.Description>
          <XStack gap="$3"><Button flex={1} chromeless disabled={isPending} onPress={onCancel}>{t('actions.cancel')}</Button><Button flex={1} bg="$destructive" color="white" fontWeight="700" disabled={isPending} icon={isPending ? <Spinner color="white" /> : <Trash2 size={17} color="white" />} onPress={onConfirm}>{isPending ? t('debts.deleting') : t('debts.deleteConfirm')}</Button></XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}

function getDueState(value: string | null | undefined, locale: string, t: (key: string, options?: Record<string, unknown>) => string) {
  const date = parseDateString(value)
  if (!date) return { overdue: false, label: t('debts.noDueDate') }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(date); due.setHours(0, 0, 0, 0)
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  const formatted = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
  if (days < 0) return { overdue: true, label: t('debts.overdueDays', { days: Math.abs(days), date: formatted }) }
  if (days === 0) return { overdue: false, label: t('debts.dueToday') }
  return { overdue: false, label: t('debts.dueInDays', { days, date: formatted }) }
}
