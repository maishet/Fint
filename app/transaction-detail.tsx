import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Copy, Pencil, Receipt, Trash2, WalletCards } from '@tamagui/lucide-icons-2'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paragraph, XStack, YStack } from 'tamagui'
import { financeApi } from '../src/api/finance'
import { Screen } from '../src/components/Screen'
import { getCategoryLabel } from '../src/finance/categoryLabels'
import { suggestedCategoryIcons } from '../src/finance/categoryIcons'
import { getAppLocale } from '../src/i18n'
import { useNotify } from '../src/ui/notify'
import { useSensitiveMoney } from '../src/privacy/useSensitiveMoney'
import { FintButton, FintCard, FintConfirmDialog } from '../src/ui'

type DetailParams = {
  id?: string
  type?: 'income' | 'expense'
  amount?: string
  currency?: string
  category?: string
  account?: string
  note?: string
  date?: string
}

export default function TransactionDetailScreen() {
  const { i18n, t } = useTranslation()
  const router = useRouter()
  const toast = useNotify()
  const queryClient = useQueryClient()
  const params = useLocalSearchParams<DetailParams>()
  const { formatSensitiveAmount } = useSensitiveMoney()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const id = params.id ?? ''
  const type = params.type === 'income' ? 'income' : 'expense'
  const isIncome = type === 'income'
  const amount = Number(params.amount ?? 0)
  const currency = params.currency ?? 'PEN'
  const category = params.category ?? ''
  const account = params.account ?? ''
  const note = params.note ?? ''
  const date = (params.date ?? '').slice(0, 10)
  const emoji = suggestedCategoryIcons(category, type)[0] ?? (isIncome ? '💰' : '🧾')
  const dateLabel = date
    ? new Intl.DateTimeFormat(getAppLocale(i18n.resolvedLanguage), { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
    : '—'

  const deleteMutation = useMutation({
    mutationFn: () => financeApi.deleteTransaction(id),
    onSuccess: async () => {
      setConfirmDelete(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ])
      toast.success(t('movementUx.deletedToast'), { message: t('movementUx.deletedMessage') })
      router.back()
    },
    onError: () => toast.error(t('movementUx.deleteError')),
  })

  const goEdit = () =>
    router.push({
      pathname: '/transaction-form',
      params: { id, type, amount: String(amount), category, account, note, date },
    })

  const goDuplicate = () =>
    router.push({
      pathname: '/transaction-form',
      // Sin id ni fecha: crea uno nuevo prellenado, con fecha de hoy por defecto.
      params: { type, amount: String(amount), category, account, note },
    })

  return (
    <>
      <Stack.Screen options={{ title: t('transactionDetail.title') }} />
      <Screen>
        <YStack gap="$5" pb="$5">
          <FintCard items="center" gap="$3" py="$5">
            <YStack width={64} height={64} rounded="$12" bg={isIncome ? '$green2' : '$red2'} items="center" justify="center">
              <Paragraph fontSize="$8">{emoji}</Paragraph>
            </YStack>
            <YStack items="center" gap="$1">
              <Paragraph color="$color12" fontFamily="$heading" fontSize="$5" fontWeight="800" text="center">
                {getCategoryLabel(category, t)}
              </Paragraph>
              <XStack items="center" gap="$1.5" bg={isIncome ? '$green2' : '$red2'} px="$2.5" py="$1" rounded="$10">
                {isIncome ? <ArrowDownLeft size={13} color="$green10" /> : <ArrowUpRight size={13} color="$red10" />}
                <Paragraph color={isIncome ? '$green11' : '$red11'} fontSize="$1" fontWeight="800">
                  {t(`forms.${type}`)}
                </Paragraph>
              </XStack>
            </YStack>
            <Paragraph color={isIncome ? '$green10' : '$red10'} fontFamily="$body" fontSize="$10" fontWeight="900" letterSpacing={-1}>
              {isIncome ? '+' : '-'}{formatSensitiveAmount(amount, currency)}
            </Paragraph>
          </FintCard>

          <FintCard p={0} overflow="hidden">
            <DetailRow icon={<WalletCards size={19} color="$primary" />} label={t('forms.account')} value={account || '—'} />
            <DetailRow icon={<CalendarDays size={19} color="$primary" />} label={t('movements.date')} value={dateLabel} divider />
            <DetailRow icon={<Pencil size={19} color="$primary" />} label={t('movementUx.noteOptional')} value={note || t('transactionDetail.noNote')} muted={!note} divider />
          </FintCard>

          <FintCard items="center" gap="$2" py="$4" borderStyle="dashed">
            <YStack width={44} height={44} rounded="$10" bg="$secondary" items="center" justify="center">
              <Receipt size={20} color="$color10" />
            </YStack>
            <Paragraph color="$color11" fontWeight="700">{t('transactionDetail.receiptTitle')}</Paragraph>
            <Paragraph color="$color10" fontSize="$2" text="center" maxW={260}>{t('transactionDetail.receiptHint')}</Paragraph>
          </FintCard>

          <YStack gap="$2">
            <FintButton width="100%" minH={50} icon={<Pencil size={18} />} onPress={goEdit}>{t('actions.edit')}</FintButton>
            <FintButton width="100%" minH={48} variant="outlined" icon={<Copy size={17} />} onPress={goDuplicate}>{t('transactionDetail.duplicate')}</FintButton>
            <FintButton width="100%" minH={48} variant="outlined" color="$red10" borderColor="$red6" icon={<Trash2 size={17} />} onPress={() => setConfirmDelete(true)}>{t('movementUx.deleteConfirm')}</FintButton>
          </YStack>
        </YStack>
      </Screen>

      <FintConfirmDialog
        open={confirmDelete}
        isPending={deleteMutation.isPending}
        title={t('movementUx.deleteTitle')}
        description={t('movementUx.deleteDescription', { name: getCategoryLabel(category, t) })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('movementUx.deleteConfirm')}
        pendingLabel={t('movementUx.deleting')}
        destructive
        icon={<Trash2 size={17} color="$primaryForeground" />}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  )
}

function DetailRow({ icon, label, value, muted = false, divider = false }: { icon: React.ReactNode; label: string; value: string; muted?: boolean; divider?: boolean }) {
  return (
    <XStack items="center" gap="$3" p="$3" borderTopColor="$borderColor" borderTopWidth={divider ? 1 : 0}>
      <YStack width={38} height={38} rounded="$9" bg="$accent2" items="center" justify="center">{icon}</YStack>
      <YStack flex={1} minW={0} gap={2}>
        <Paragraph color="$color10" fontSize="$1" fontWeight="600">{label}</Paragraph>
        <Paragraph color={muted ? '$color9' : '$color12'} fontSize="$3" fontWeight="700" numberOfLines={3}>{value}</Paragraph>
      </YStack>
    </XStack>
  )
}
