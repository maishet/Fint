import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, CreditCard, PiggyBank, Plus, Trash2, Wallet } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, Paragraph, Spinner, XStack, YStack } from 'tamagui'
import { financeApi } from '../../src/api/finance'
import { formatMoney, normalizeAccount, normalizeSummary } from '../../src/api/mappers'
import type { Account } from '../../src/api/types'
import { DataStateCard } from '../../src/components/DataStateCard'
import { Screen } from '../../src/components/Screen'
import { SkeletonGroup, SkeletonHero, SkeletonList } from '../../src/components/Skeleton'
import { useThemeMode } from '../../src/theme/ThemeMode'
import { usePressOnce } from '../../src/hooks/usePressOnce'
import { FintButton, FintCard } from '../../src/ui'

export default function AccountsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { themeMode } = useThemeMode()
  const toast = useToastController()
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
  const pressOnce = usePressOnce()
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: financeApi.listAccounts, retry: false })
  const summaryQuery = useQuery({ queryKey: ['summary'], queryFn: financeApi.getSummary, retry: false })
  const accounts = (accountsQuery.data ?? []).map(normalizeAccount)
  const summary = normalizeSummary(summaryQuery.data)
  const isLoading = accountsQuery.isLoading || summaryQuery.isLoading
  const isRefreshing = accountsQuery.isRefetching || summaryQuery.isRefetching
  const error = accountsQuery.error ?? summaryQuery.error
  const deleteMutation = useMutation({
    mutationFn: (accountId: string) => financeApi.deleteAccount(accountId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ])
      setDeleteTarget(null)
      toast.show(t('accounts.deletedToast'), { message: t('accounts.deletedMessage'), preset: 'success', duration: 3500 })
    },
    onError: (mutationError) => toast.show(t('accounts.deleteError'), { message: mutationError instanceof Error ? mutationError.message : t('states.error'), preset: 'error', duration: 4500 }),
  })

  const openCreate = () => pressOnce(() => router.push('/account-form'))
  const openEdit = (account: Account) => pressOnce(() => router.push({ pathname: '/account-form', params: { accountId: account.id } }))

  return (
    <>
      <Screen
        isRefreshing={isRefreshing}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['accounts'] })
          queryClient.invalidateQueries({ queryKey: ['summary'] })
        }}
      >
        {isLoading ? <SkeletonGroup label={t('states.loading')}><SkeletonHero /></SkeletonGroup> : null}
        {!isLoading && !error ? <AccountsSummary isDark={themeMode === 'dark'} summary={summary} /> : null}

        <XStack items="center" justify="space-between" gap="$3">
          <YStack gap="$1" flex={1}>
            <Paragraph color="$color12" fontFamily="$heading" fontSize="$6" fontWeight="700">{t('accounts.myAccounts')}</Paragraph>
            {!isLoading ? <Paragraph color="$color10" fontSize="$2">{t('accounts.accountCount', { count: accounts.length })}</Paragraph> : null}
          </YStack>
          <YStack
            width={42}
            height={42}
            rounded="$10"
            bg="$primary"
            items="center"
            justify="center"
            pressStyle={{ bg: '$accent10', scale: 0.96 }}
            cursor="pointer"
            role="button"
            onPress={openCreate}
            aria-label={t('actions.newAccount')}
          >
            <Plus size={22} color="$primaryForeground" />
          </YStack>
        </XStack>

        {isLoading ? <SkeletonGroup label={t('states.loading')}><SkeletonList rows={3} /></SkeletonGroup> : null}
        {error ? <DataStateCard message={error instanceof Error ? error.message : t('states.error')} onRetry={() => { void accountsQuery.refetch(); void summaryQuery.refetch() }} /> : null}
        {!isLoading && !error && accounts.length === 0 ? (
          <FintCard bg="$accent1" borderColor="$accent4" items="center" gap="$3" py="$6">
            <YStack width={48} height={48} rounded="$10" bg="$accent3" items="center" justify="center">
              <Wallet size={23} color="$primary" />
            </YStack>
            <YStack items="center" gap="$1">
              <Paragraph color="$color12" fontFamily="$heading" fontSize="$5" fontWeight="700">{t('accounts.emptyTitle')}</Paragraph>
              <Paragraph color="$color10" fontSize="$2" text="center" maxW={260}>{t('accounts.emptyDescription')}</Paragraph>
            </YStack>
            <FintButton icon={<Plus size={16} />} onPress={openCreate}>{t('actions.newAccount')}</FintButton>
          </FintCard>
        ) : null}
        {!isLoading && !error ? accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            isDeleting={deleteMutation.isPending && deleteTarget?.id === account.id}
            onDelete={() => setDeleteTarget(account)}
            onPress={() => openEdit(account)}
          />
        )) : null}
      </Screen>

      <DeleteAccountDialog
        account={deleteTarget}
        isPending={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </>
  )
}

function AccountsSummary({ isDark, summary }: { isDark: boolean; summary: ReturnType<typeof normalizeSummary> }) {
  const { t } = useTranslation()
  const backgroundColor = isDark ? '#0B3046' : '#0F5D73'
  const borderColor = isDark ? '#1B5067' : '#28788C'

  return (
    <FintCard bg={backgroundColor} borderColor={borderColor} gap="$4" p="$4">
      <XStack items="center" justify="space-between" gap="$3">
        <YStack gap="$1" flex={1} minW={0}>
          <Paragraph color="#B9D7E1" fontFamily="$heading" fontSize="$2" fontWeight="700" textTransform="uppercase">{t('accounts.consolidatedBalance')}</Paragraph>
          <Paragraph color="#F4FBFD" fontFamily="$body" fontSize="$9" fontWeight="800" lineHeight="$9" numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(summary.netWorth, summary.currency)}
          </Paragraph>
        </YStack>
        <YStack width={48} height={48} rounded="$10" bg="rgba(93,214,229,0.14)" borderColor="rgba(93,214,229,0.24)" borderWidth={1} items="center" justify="center">
          <Wallet size={24} color="#5DD6E5" />
        </YStack>
      </XStack>
      <XStack gap="$4">
        <SummaryMetric accent="#5DD6E5" label={t('accounts.assets')} value={formatMoney(summary.totalAssets, summary.currency)} />
        <SummaryMetric accent="#F28B82" label={t('accounts.liabilities')} value={formatMoney(summary.totalLiabilities, summary.currency)} />
      </XStack>
    </FintCard>
  )
}

function SummaryMetric({ accent, label, value }: { accent: string; label: string; value: string }) {
  return (
    <YStack flex={1} minW={0} gap="$1">
      <YStack height={4} rounded="$10" bg={accent as never} />
      <Paragraph color="#B9D7E1" fontFamily="$body" fontSize="$1">{label}</Paragraph>
      <Paragraph color="#F4FBFD" fontFamily="$body" fontSize="$3" fontWeight="800" numberOfLines={1}>{value}</Paragraph>
    </YStack>
  )
}

function AccountCard({ account, isDeleting, onDelete, onPress }: { account: Account; isDeleting: boolean; onDelete: () => void; onPress: () => void }) {
  const { t } = useTranslation()
  const isNegative = account.balance < 0
  const Icon = getAccountIcon(account.accountType)

  return (
    <FintCard p="$2">
      <XStack items="center" gap="$1">
        <XStack flex={1} minW={0} items="center" gap="$3" p="$1" rounded="$5" cursor="pointer" role="button" pressStyle={{ bg: '$secondary' }} onPress={onPress} aria-label={t('accounts.editAccessibility', { name: account.name })}>
          <YStack
            width={44}
            height={44}
            rounded="$9"
            bg={isNegative ? '$red2' : '$accent2'}
            borderColor={isNegative ? '$red5' : '$accent4'}
            borderWidth={1}
            items="center"
            justify="center"
          >
            <Icon size={21} color={isNegative ? '$red10' : '$primary'} />
          </YStack>
          <YStack flex={1} minW={0} gap="$1">
            <Paragraph color="$color12" fontFamily="$heading" fontSize="$4" fontWeight="700" numberOfLines={1}>{account.name}</Paragraph>
            <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>{getAccountTypeLabel(account.accountType, t)} · {account.currency}</Paragraph>
          </YStack>
          <Paragraph color={isNegative ? '$red11' : '$color12'} fontSize="$4" fontWeight="800" shrink={0}>
            {formatMoney(account.balance, account.currency)}
          </Paragraph>
        </XStack>
        <Button
          circular
          chromeless
          size="$3"
          disabled={isDeleting}
          icon={isDeleting ? <Spinner size="small" color="$red10" /> : <Trash2 size={19} color="$red10" />}
          pressStyle={{ bg: '$red3' }}
          onPress={onDelete}
          aria-label={t('accounts.deleteAccessibility', { name: account.name })}
        />
      </XStack>
    </FintCard>
  )
}

function DeleteAccountDialog({ account, isPending, onCancel, onConfirm }: { account: Account | null; isPending: boolean; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useTranslation()
  return (
    <Dialog modal open={Boolean(account)} onOpenChange={(open) => !open && !isPending && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay key="account-delete-overlay" bg="rgba(4,18,28,0.68)" />
        <Dialog.Content key="account-delete-content" bordered elevate bg="$popover" borderColor="$borderColor" rounded="$7" width="88%" maxW={420} p="$5" gap="$4">
          <YStack gap="$2">
            <Dialog.Title color="$color12" fontFamily="$heading" fontSize="$6" fontWeight="700">{t('accounts.deleteTitle')}</Dialog.Title>
            <Dialog.Description color="$color10" fontSize="$3">{t('accounts.deleteDescription', { name: account?.name ?? '' })}</Dialog.Description>
          </YStack>
          <XStack gap="$3" justify="flex-end">
            <Button flex={1} chromeless color="$color11" disabled={isPending} onPress={onCancel}>{t('actions.cancel')}</Button>
            <Button flex={1} bg="$destructive" color="white" fontWeight="700" disabled={isPending} icon={isPending ? <Spinner size="small" color="white" /> : <Trash2 size={17} color="white" />} onPress={onConfirm}>
              {isPending ? t('accounts.deleting') : t('accounts.deleteConfirm')}
            </Button>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}

function getAccountIcon(accountType: string) {
  if (accountType === 'credit_card') return CreditCard
  if (accountType === 'checking_account') return Building2
  if (accountType === 'savings_account') return PiggyBank
  return Wallet
}

function getAccountTypeLabel(accountType: string, t: (key: string) => string) {
  if (accountType === 'cash') return t('accountTypes.cash')
  if (accountType === 'credit_card') return t('accountTypes.creditCard')
  if (accountType === 'checking_account') return t('accountTypes.checkingAccount')
  if (accountType === 'savings_account') return t('accountTypes.savingsAccount')
  return accountType
}
