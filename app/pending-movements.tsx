import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Mail, Pencil, Trash2 } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, RefreshControl } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Dialog, Paragraph, Spinner, XStack, YStack } from 'tamagui'
import { financeApi } from '../src/api/finance'
import { formatMoney } from '../src/api/mappers'
import type { ConfirmPendingInput, PendingMovementCard } from '../src/api/types'
import { CategoryPickerSheet } from '../src/components/CategoryPickerSheet'
import { DataStateCard } from '../src/components/DataStateCard'
import { SkeletonGroup, SkeletonList } from '../src/components/Skeleton'
import { getValidationMessage } from '../src/forms'
import { FintButton, FintCard, FintFormField } from '../src/ui'

const PAGE_SIZE = 20

export default function PendingMovementsScreen() {
  return <PendingMovementsList />
}

export function PendingMovementsList({ onClose }: { onClose?: () => void }) {
  const { i18n, t } = useTranslation()
  const router = useRouter()
  const toast = useToastController()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [category, setCategory] = useState('')
  const [categoryError, setCategoryError] = useState<string | undefined>()
  const [discardTarget, setDiscardTarget] = useState<PendingMovementCard | null>(null)

  const pendingQuery = useInfiniteQuery({
    queryKey: ['pending-movements', 'pages'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => financeApi.listPendingMovements({ limit: PAGE_SIZE, cursor: pageParam }, signal),
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
    retry: false,
  })
  const items = pendingQuery.data?.pages.flatMap((page) => page.items) ?? []
  const expandedItem = items.find((item) => item.id === expandedId) ?? null
  const categoriesQuery = useQuery({
    queryKey: ['categories', expandedItem?.type],
    queryFn: () => financeApi.listCategories(expandedItem?.type),
    enabled: Boolean(expandedItem?.accountSuggestion),
    retry: false,
  })

  const confirmMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConfirmPendingInput }) => financeApi.confirmPendingMovement(id, input),
    onSuccess: async () => {
      setExpandedId(null)
      setCategory('')
      await invalidatePendingAndFinance(queryClient)
      toast.show(t('movements.createdToast'), { message: t('movements.createdMessage'), preset: 'success' })
    },
    onError: (error) => toast.show(t('movementUx.pendingConfirmError', { defaultValue: 'No pudimos confirmar el pendiente.' }), { message: error instanceof Error ? error.message : undefined, preset: 'error' }),
  })
  const discardMutation = useMutation({
    mutationFn: (id: string) => financeApi.discardPendingMovement(id),
    onSuccess: async () => {
      setExpandedId(null)
      setDiscardTarget(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pending-movements', 'pages'] }),
        queryClient.invalidateQueries({ queryKey: ['pending-movements', 'summary'] }),
      ])
      toast.show(t('movementUx.pendingDiscarded', { defaultValue: 'Pendiente descartado' }), { preset: 'success' })
    },
    onError: (error) => toast.show(t('movementUx.pendingDiscardError', { defaultValue: 'No pudimos descartar el pendiente.' }), { message: error instanceof Error ? error.message : undefined, preset: 'error' }),
  })

  const openItem = (item: PendingMovementCard) => {
    setExpandedId((current) => current === item.id ? null : item.id)
    setCategory('')
    setCategoryError(undefined)
  }

  const confirm = (item: PendingMovementCard) => {
    const selectedCategory = categoriesQuery.data?.find((candidate) => candidate.name === category)
    if (!selectedCategory) {
      setCategoryError(getValidationMessage(t, i18n.resolvedLanguage, 'required'))
      return
    }
    if (!item.accountSuggestion) {
      router.push({ pathname: '/pending-review', params: { id: item.id } })
      return
    }
    confirmMutation.mutate({
      id: item.id,
      input: {
        mode: 'transaction',
        title: item.title,
        type: item.type,
        amount: item.amount,
        currency: item.accountSuggestion.currency,
        transactionDate: item.detectedAt.slice(0, 10),
        accountId: item.accountSuggestion.id,
        categoryId: selectedCategory.id,
        note: item.title,
      },
    })
  }

  return (
    <YStack flex={1} bg="$background">
      {!onClose ? <Stack.Screen options={{ title: t('movementUx.pendingTitle', { defaultValue: 'Pendientes detectados' }) }} /> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16), flexGrow: items.length ? undefined : 1 }}
        ItemSeparatorComponent={() => <YStack height="$3" />}
        refreshControl={<RefreshControl refreshing={pendingQuery.isRefetching && !pendingQuery.isFetchingNextPage} onRefresh={() => { void pendingQuery.refetch() }} />}
        onEndReached={() => { if (pendingQuery.hasNextPage && !pendingQuery.isFetchingNextPage) void pendingQuery.fetchNextPage() }}
        onEndReachedThreshold={0.35}
        ListHeaderComponent={onClose ? <XStack items="center" gap="$3" mb="$4"><FintButton circular size="$3" variant="outlined" icon={<ArrowLeft size={18} />} onPress={onClose} aria-label={t('actions.back', { defaultValue: 'Volver' })} /><YStack flex={1} gap="$1"><Paragraph color="$color12" fontFamily="$heading" fontSize="$6" fontWeight="800">{t('movementUx.pendingTitle', { defaultValue: 'Pendientes detectados' })}</Paragraph><Paragraph color="$color10" fontSize="$2">{t('movementUx.pendingCount', { count: items.length })}</Paragraph></YStack></XStack> : null}
        ListEmptyComponent={pendingQuery.isLoading
          ? <SkeletonGroup label={t('states.loading')}><SkeletonList rows={4} /></SkeletonGroup>
          : pendingQuery.error
            ? <DataStateCard message={t('movementUx.pendingError')} onRetry={() => { void pendingQuery.refetch() }} />
            : <DataStateCard message={t('movementUx.noPending')} />}
        ListFooterComponent={pendingQuery.isFetchingNextPage ? <YStack py="$4"><Spinner color="$primary" /></YStack> : null}
        renderItem={({ item }) => (
          <PendingCard
            item={item}
            expanded={expandedId === item.id}
            category={expandedId === item.id ? category : ''}
            categoryError={expandedId === item.id ? categoryError : undefined}
            categories={expandedId === item.id ? categoriesQuery.data ?? [] : []}
            referencesLoading={expandedId === item.id && categoriesQuery.isLoading}
            isPending={(confirmMutation.isPending && confirmMutation.variables?.id === item.id) || (discardMutation.isPending && discardMutation.variables === item.id)}
            onToggle={() => openItem(item)}
            onCategoryChange={(value) => { setCategory(value); setCategoryError(undefined) }}
            onConfirm={() => confirm(item)}
            onDiscard={() => setDiscardTarget(item)}
            onEdit={() => router.push({ pathname: '/pending-review', params: { id: item.id } })}
          />
        )}
      />
      <DiscardPendingDialog item={discardTarget} isPending={discardMutation.isPending} onCancel={() => setDiscardTarget(null)} onConfirm={() => discardTarget && discardMutation.mutate(discardTarget.id)} />
    </YStack>
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

function PendingCard({ categories, category, categoryError, expanded, isPending, item, onCategoryChange, onConfirm, onDiscard, onEdit, onToggle, referencesLoading }: { categories: Awaited<ReturnType<typeof financeApi.listCategories>>; category: string; categoryError?: string; expanded: boolean; isPending: boolean; item: PendingMovementCard; onCategoryChange: (value: string) => void; onConfirm: () => void; onDiscard: () => void; onEdit: () => void; onToggle: () => void; referencesLoading: boolean }) {
  const { t, i18n } = useTranslation()
  const detectedDate = new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: 'short' }).format(new Date(item.detectedAt))
  return (
    <FintCard p="$3" gap="$3" opacity={isPending ? 0.65 : 1}>
      <XStack items="center" gap="$3" role="button" onPress={isPending ? undefined : onToggle}>
        <Mail size={18} color="$primary" />
        <YStack flex={1} minW={0} gap="$1">
          <Paragraph color="$color12" fontWeight="800" numberOfLines={2}>{item.title}</Paragraph>
          <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>{t(`forms.${item.type}`)} · {detectedDate}{item.accountSuggestion ? ` · ${item.accountSuggestion.name}` : ''}</Paragraph>
        </YStack>
        <Paragraph color={item.type === 'income' ? '$green10' : '$red10'} fontWeight="900">{item.type === 'income' ? '+' : '-'}{formatMoney(item.amount, item.currency)}</Paragraph>
      </XStack>
      {expanded ? (
        <YStack gap="$3">
          {item.accountSuggestion ? (
            <>
              {referencesLoading ? <SkeletonGroup label={t('states.loading')}><SkeletonList rows={1} /></SkeletonGroup> : null}
              {!referencesLoading ? <FintFormField label={t('forms.category')} required error={categoryError} invalidBorder><CategoryPickerSheet categories={categories} type={item.type} value={category} showLabel={false} onValueChange={onCategoryChange} /></FintFormField> : null}
              <FintButton disabled={isPending || referencesLoading} icon={<Check size={17} />} onPress={onConfirm}>{t('movementUx.confirmPending')}</FintButton>
            </>
          ) : (
            <YStack bg="$muted" rounded="$5" p="$3" gap="$2">
              <Paragraph color="$color12" fontWeight="700">{t('movementUx.accountRequired', { defaultValue: 'Cuenta requerida' })}</Paragraph>
              <Paragraph color="$color10" fontSize="$2">{t('movementUx.pendingNeedsEdit', { defaultValue: 'Revisa el pendiente para seleccionar la cuenta correcta.' })}</Paragraph>
            </YStack>
          )}
          <XStack gap="$2">
            <FintButton flex={1} size="$3" variant="outlined" color="$red10" borderColor="$red6" disabled={isPending} icon={<Trash2 size={15} />} onPress={onDiscard}>{t('movementUx.discardShort', { defaultValue: 'Descartar' })}</FintButton>
            <FintButton flex={1} size="$3" variant="outlined" disabled={isPending} icon={<Pencil size={15} />} onPress={onEdit}>{t('actions.edit', { defaultValue: 'Editar' })}</FintButton>
          </XStack>
        </YStack>
      ) : null}
    </FintCard>
  )
}

function DiscardPendingDialog({ isPending, item, onCancel, onConfirm }: { isPending: boolean; item: PendingMovementCard | null; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useTranslation()
  return <Dialog modal open={Boolean(item)} onOpenChange={(open) => !open && !isPending && onCancel()}><Dialog.Portal><Dialog.Overlay bg="rgba(4,18,28,0.68)" /><Dialog.Content bordered elevate bg="$popover" borderColor="$borderColor" rounded="$7" width="88%" maxW={420} p="$5" gap="$4"><Dialog.Title color="$color12" fontFamily="$heading" fontSize="$6" fontWeight="700">{t('movementUx.discardPendingTitle', { defaultValue: '¿Descartar este pendiente?' })}</Dialog.Title><Dialog.Description color="$color10">{t('movementUx.discardPendingDescription', { defaultValue: 'El pendiente se ocultará y no creará ningún movimiento.' })}</Dialog.Description><XStack gap="$3"><Button flex={1} chromeless disabled={isPending} onPress={onCancel}>{t('actions.cancel')}</Button><Button flex={1} bg="$destructive" color="white" fontWeight="700" disabled={isPending} icon={isPending ? <Spinner color="white" /> : <Trash2 size={17} color="white" />} onPress={onConfirm}>{t('movementUx.discardPending')}</Button></XStack></Dialog.Content></Dialog.Portal></Dialog>
}
