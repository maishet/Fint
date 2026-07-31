import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronRight, Mail, Plus, Trash2 } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { Link, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, RefreshControl } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Dialog, Paragraph, Spinner, XStack, YStack } from 'tamagui'
import { financeApi } from '../../src/api/finance'
import { formatMoney, normalizeTransaction } from '../../src/api/mappers'
import type { Transaction } from '../../src/api/types'
import { supabase } from '../../src/auth/supabase'
import { DataStateCard } from '../../src/components/DataStateCard'
import { SkeletonGroup, SkeletonHero, SkeletonList } from '../../src/components/Skeleton'
import { getCategoryLabel } from '../../src/finance/categoryLabels'
import { useThemeMode } from '../../src/theme/ThemeMode'
import { FintButton, FintCard, FintSheetSelect } from '../../src/ui'

const PAGE_SIZE = 30

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthRange(month: Date) {
  return { from: isoDate(new Date(month.getFullYear(), month.getMonth(), 1)), to: isoDate(new Date(month.getFullYear(), month.getMonth() + 1, 1)) }
}

export default function MovementsScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const toast = useToastController()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [summaryCurrency, setSummaryCurrency] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [reverseTarget, setReverseTarget] = useState<Transaction | null>(null)
  const range = monthRange(month)
  const movementsQuery = useInfiniteQuery({
    queryKey: ['transactions', 'pages', range.from, range.to],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => financeApi.getTransactionPage({ ...range, limit: PAGE_SIZE, cursor: pageParam }, signal),
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
    retry: false,
  })
  const pendingSummaryQuery = useQuery({ queryKey: ['pending-movements', 'summary'], queryFn: financeApi.getPendingMovementsSummary, retry: false })
  const movements = (movementsQuery.data?.pages.flatMap((page) => page.items) ?? []).map(normalizeTransaction)
  const summary = movementsQuery.data?.pages[0]?.summary
  const currencySummary = summary?.byCurrency.find((item) => item.currency === summaryCurrency) ?? summary?.byCurrency[0]
  const currency = currencySummary?.currency ?? 'PEN'
  const pendingCount = pendingSummaryQuery.data?.count ?? 0
  const monthOptions = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(new Date().getFullYear(), new Date().getMonth() - index, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(date)
    return { value, label: label.charAt(0).toLocaleUpperCase(i18n.language) + label.slice(1) }
  })
  const monthValue = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => {
    if (currencySummary && summaryCurrency !== currencySummary.currency) setSummaryCurrency(currencySummary.currency)
  }, [currencySummary, summaryCurrency])

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return
      channel = supabase.channel(`pending-movements-${data.user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'pending_movements', filter: `user_id=eq.${data.user.id}` }, (payload) => {
        void queryClient.invalidateQueries({ queryKey: ['pending-movements', 'summary'] })
        void queryClient.invalidateQueries({ queryKey: ['pending-movements'] })
        if ((payload.new as { status?: string } | null)?.status === 'confirmed') {
          void queryClient.invalidateQueries({ queryKey: ['transactions'] })
          void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
          void queryClient.invalidateQueries({ queryKey: ['summary'] })
          void queryClient.invalidateQueries({ queryKey: ['accounts'] })
          void queryClient.invalidateQueries({ queryKey: ['reports'] })
        }
      }).subscribe()
    })
    return () => { active = false; if (channel) supabase.removeChannel(channel) }
  }, [queryClient])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financeApi.deleteTransaction(id),
    onSuccess: async () => {
      setDeleteTarget(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ])
      toast.show(t('movementUx.deletedToast'), { message: t('movementUx.deletedMessage'), preset: 'success' })
    },
    onError: () => toast.show(t('movementUx.deleteError'), { preset: 'error' }),
  })

  const reversePaymentMutation = useMutation({
    mutationFn: (paymentId: string) => financeApi.reversePaymentOccurrencePayment(paymentId, { reason: 'Reverted from mobile history' }),
    onSuccess: async () => {
      setReverseTarget(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['payment-occurrences'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
        queryClient.invalidateQueries({ queryKey: ['pending-movements'] }),
      ])
      toast.show(t('movementUx.revertedToast'), { message: t('movementUx.revertedMessage'), preset: 'success' })
    },
    onError: () => toast.show(t('movementUx.reverseError'), { preset: 'error' }),
  })

  const header = (
    <YStack gap="$4" mb="$4">
      {movementsQuery.isLoading ? <SkeletonGroup label={t('states.loading')}><SkeletonHero /></SkeletonGroup> : <MovementHero currency={currency} expenses={currencySummary?.expenses ?? 0} income={currencySummary?.income ?? 0} />}
      {(summary?.byCurrency.length ?? 0) > 1 ? <FintSheetSelect label={t('forms.currency')} placeholder={t('forms.currency')} value={currency} options={(summary?.byCurrency ?? []).map((item) => ({ value: item.currency, label: item.currency }))} onValueChange={setSummaryCurrency} /> : null}
      <FintSheetSelect label={t('movementUx.period')} value={monthValue} placeholder={t('movementUx.selectMonth')} options={monthOptions} onValueChange={(value) => { const [year, selectedMonth] = value.split('-').map(Number); setMonth(new Date(year, selectedMonth - 1, 1)) }} />
      <FintCard p={0} overflow="hidden" borderColor={pendingCount ? '$yellow7' : '$borderColor'}>
        <XStack items="center" gap="$3" minH={56} p="$3" bg={pendingCount ? '$yellow2' : '$muted'} role="button" pressStyle={{ opacity: 0.8 }} onPress={() => router.push('/pending-movements')} aria-label={t('movementUx.pendingCount', { count: pendingCount })}>
          <YStack width={36} height={36} rounded="$10" bg={pendingCount ? '$yellow4' : '$color4'} items="center" justify="center"><Mail size={18} color={pendingCount ? '$yellow10' : '$color10'} /></YStack>
          <YStack flex={1} minW={0} gap="$1"><Paragraph color={pendingCount ? '$yellow11' : '$color11'} fontWeight="800">{pendingSummaryQuery.isLoading ? t('movementUx.pendingTitle') : t('movementUx.pendingCount', { count: pendingCount })}</Paragraph><Paragraph color="$color10" fontSize="$1">{t('movementUx.pendingReviewHint')}</Paragraph></YStack>
          <ChevronRight size={19} color="$color10" />
        </XStack>
      </FintCard>
      <XStack items="center" justify="space-between" gap="$3"><YStack gap="$1"><Paragraph color="$color12" fontFamily="$heading" fontSize="$6" fontWeight="700">{t('movementUx.movementCount', { count: summary?.totalCount ?? 0 })}</Paragraph><Paragraph color="$color10" fontSize="$2">{t('movements.historySubtitle')}</Paragraph></YStack><Link href="/transaction-form" asChild><FintButton circular bg="$primary" icon={<Plus size={21} color="$primaryForeground" />} aria-label={t('actions.newMovement')} /></Link></XStack>
      {movementsQuery.error ? <DataStateCard message={t('states.error')} onRetry={() => { void movementsQuery.refetch() }} /> : null}
    </YStack>
  )

  return (
    <YStack flex={1} bg="$background">
      <FlatList
        data={movements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 24), flexGrow: movements.length ? undefined : 1 }}
        ListHeaderComponent={header}
        ListEmptyComponent={!movementsQuery.isLoading && !movementsQuery.error ? <DataStateCard message={t('movements.emptyDescription')} /> : null}
        ListFooterComponent={movementsQuery.isFetchingNextPage ? <YStack py="$4"><Spinner color="$primary" /></YStack> : null}
        ItemSeparatorComponent={() => <YStack height={8} />}
        refreshControl={<RefreshControl refreshing={movementsQuery.isRefetching && !movementsQuery.isFetchingNextPage} onRefresh={() => { void movementsQuery.refetch() }} />}
        onEndReached={() => { if (movementsQuery.hasNextPage && !movementsQuery.isFetchingNextPage) void movementsQuery.fetchNextPage() }}
        onEndReachedThreshold={0.35}
        renderItem={({ item }) => <MovementCard movement={item} locale={i18n.language} onDelete={() => setDeleteTarget(item)} onEdit={() => router.push({ pathname: '/transaction-form', params: { id: item.id, type: item.type, amount: String(item.amount), category: item.category, account: item.account, note: item.note ?? '', date: item.date } })} onReverse={() => setReverseTarget(item)} />}
      />
      <DeleteMovementDialog movement={deleteTarget} isPending={deleteMutation.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} />
      <ReversePaymentDialog movement={reverseTarget} isPending={reversePaymentMutation.isPending} onCancel={() => setReverseTarget(null)} onConfirm={() => reverseTarget?.paymentOccurrencePaymentId && reversePaymentMutation.mutate(reverseTarget.paymentOccurrencePaymentId)} />
    </YStack>
  )
}

function MovementCard({ locale, movement, onDelete, onEdit, onReverse }: { locale: string; movement: Transaction; onDelete: () => void; onEdit: () => void; onReverse: () => void }) {
  const { t } = useTranslation()
  const isIncome = movement.type === 'income'
  const isPayment = Boolean(movement.paymentOccurrenceId)
  return <FintCard py="$3"><XStack items="center" gap="$3"><XStack flex={1} minW={0} items="center" gap="$3" role={isPayment ? undefined : 'button'} onPress={isPayment ? undefined : onEdit}><YStack width={42} height={42} rounded="$8" bg={isIncome ? '$green2' : '$red2'} items="center" justify="center">{isIncome ? <ArrowDownLeft size={20} color="$green10" /> : <ArrowUpRight size={20} color="$red10" />}</YStack><YStack flex={1} minW={0} gap="$1"><Paragraph color="$color12" fontSize="$3" fontWeight="800" numberOfLines={1}>{getCategoryLabel(movement.category, t)}</Paragraph><Paragraph color="$color10" fontSize="$1" numberOfLines={1}>{new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(new Date(`${movement.date}T00:00:00`))} · {movement.account}</Paragraph>{movement.note ? <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>{movement.note}</Paragraph> : null}</YStack></XStack><YStack items="flex-end" gap="$1"><Paragraph color={isIncome ? '$green10' : '$red10'} fontSize="$3" fontWeight="900">{isIncome ? '+' : '-'}{formatMoney(movement.amount, movement.currency)}</Paragraph>{isPayment && movement.paymentOccurrencePaymentId ? <Button chromeless size="$2" onPress={onReverse}>{t('movementUx.reversePayment')}</Button> : <Button chromeless circular size="$2" icon={<Trash2 size={15} color="$red10" />} onPress={onDelete} aria-label={t('movementUx.deleteTitle')} />}</YStack></XStack></FintCard>
}

function ReversePaymentDialog({ isPending, movement, onCancel, onConfirm }: { isPending: boolean; movement: Transaction | null; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useTranslation()
  return <Dialog modal open={Boolean(movement)} onOpenChange={(open) => !open && !isPending && onCancel()}><Dialog.Portal><Dialog.Overlay bg="rgba(4,18,28,0.68)" /><Dialog.Content bordered elevate bg="$popover" borderColor="$borderColor" rounded="$7" width="88%" maxW={420} p="$5" gap="$4"><Dialog.Title color="$color12" fontFamily="$heading" fontSize="$6" fontWeight="700">{t('movementUx.reversePayment')}</Dialog.Title><Dialog.Description color="$color10">{t('movementUx.reversePaymentDescription')}</Dialog.Description><XStack gap="$3"><Button flex={1} chromeless disabled={isPending} onPress={onCancel}>{t('actions.cancel')}</Button><Button flex={1} bg="$destructive" color="white" fontWeight="700" disabled={isPending} icon={isPending ? <Spinner color="white" /> : undefined} onPress={onConfirm}>{isPending ? t('movementUx.reversing') : t('movementUx.reversePayment')}</Button></XStack></Dialog.Content></Dialog.Portal></Dialog>
}

function DeleteMovementDialog({ isPending, movement, onCancel, onConfirm }: { isPending: boolean; movement: Transaction | null; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useTranslation()
  return <Dialog modal open={Boolean(movement)} onOpenChange={(open) => !open && !isPending && onCancel()}><Dialog.Portal><Dialog.Overlay bg="rgba(4,18,28,0.68)" /><Dialog.Content bordered elevate bg="$popover" borderColor="$borderColor" rounded="$7" width="88%" maxW={420} p="$5" gap="$4"><Dialog.Title color="$color12" fontFamily="$heading" fontSize="$6" fontWeight="700">{t('movementUx.deleteTitle')}</Dialog.Title><Dialog.Description color="$color10">{t('movementUx.deleteDescription', { name: movement ? getCategoryLabel(movement.category, t) : '' })}</Dialog.Description><XStack gap="$3"><Button flex={1} chromeless disabled={isPending} onPress={onCancel}>{t('actions.cancel')}</Button><Button flex={1} bg="$destructive" color="white" fontWeight="700" disabled={isPending} icon={isPending ? <Spinner color="white" /> : <Trash2 size={17} color="white" />} onPress={onConfirm}>{isPending ? t('movementUx.deleting') : t('movementUx.deleteConfirm')}</Button></XStack></Dialog.Content></Dialog.Portal></Dialog>
}

function MovementHero({ currency, expenses, income }: { currency: string; expenses: number; income: number }) {
  const { t } = useTranslation()
  const { themeMode } = useThemeMode()
  const isDark = themeMode === 'dark'
  return <FintCard bg={isDark ? '#0B3046' : '#0F5D73'} borderColor={isDark ? '#1B5067' : '#28788C'} gap="$4" p="$4"><XStack items="center" justify="space-between"><YStack gap="$1"><Paragraph color="#B9D7E1" fontFamily="$heading" fontSize="$2" fontWeight="700" textTransform="uppercase">{t('movementUx.monthFlow')}</Paragraph><Paragraph color="#F4FBFD" fontSize="$8" fontWeight="900">{formatMoney(income - expenses, currency)}</Paragraph></YStack><YStack width={48} height={48} rounded="$10" bg="rgba(93,214,229,0.14)" borderColor="rgba(93,214,229,0.24)" borderWidth={1} items="center" justify="center"><ArrowLeftRight size={24} color="#5DD6E5" /></YStack></XStack><XStack gap="$3"><HeroMetric label={t('dashboard.totalIncome')} value={formatMoney(income, currency)} color="#5DD6E5" /><HeroMetric label={t('dashboard.totalExpenses')} value={formatMoney(expenses, currency)} color="#F28B82" /></XStack></FintCard>
}

function HeroMetric({ color, label, value }: { color: string; label: string; value: string }) {
  return <YStack flex={1} gap="$1"><YStack height={4} rounded="$10" bg={color as never} /><Paragraph color="#B9D7E1" fontSize="$1">{label}</Paragraph><Paragraph color="#F4FBFD" fontSize="$3" fontWeight="800">{value}</Paragraph></YStack>
}
