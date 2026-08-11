import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, Plus, Shapes, Trash2 } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Paragraph, Separator, XStack, YStack } from 'tamagui'
import { financeApi } from '../src/api/finance'
import type { Category, TransactionType } from '../src/api/types'
import { CreateCategorySheet } from '../src/components/CreateCategorySheet'
import { DataStateCard } from '../src/components/DataStateCard'
import { MovementTypeSelector } from '../src/components/MovementFormControls'
import { Screen } from '../src/components/Screen'
import { SkeletonGroup, SkeletonList } from '../src/components/Skeleton'
import { getCategoryLabel } from '../src/finance/categoryLabels'
import { suggestedCategoryIcons } from '../src/finance/categoryIcons'
import { FintButton, FintCard, FintConfirmDialog, FintSpinner } from '../src/ui'

export default function CategoriesScreen() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToastController()
  const [type, setType] = useState<TransactionType>('expense')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => financeApi.listCategories(), retry: false })
  const categories = (categoriesQuery.data ?? []).filter((category) => category.type === type)

  const openCreate = () => { setEditingCategory(null); setIsSheetOpen(true) }
  const openEdit = (category: Category) => { setEditingCategory(category); setIsSheetOpen(true) }
  const handleSheetOpenChange = (next: boolean) => {
    setIsSheetOpen(next)
    if (!next) setEditingCategory(null)
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financeApi.deleteCategory(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ])
      setDeleteTarget(null)
      toast.show(t('categories.deletedToast'), { message: t('categories.deletedMessage'), preset: 'success', duration: 3500 })
    },
    onError: (error) =>
      toast.show(t('categories.deleteError'), {
        message: error instanceof Error ? error.message : t('states.error'),
        preset: 'error',
        duration: 4500,
      }),
  })

  return (
    <>
      <Screen isRefreshing={categoriesQuery.isRefetching} onRefresh={() => categoriesQuery.refetch()}>
        <XStack items="center" justify="space-between" gap="$3">
          <YStack gap="$1" flex={1}>
            <Paragraph color="$color12" fontFamily="$heading" fontSize="$7" fontWeight="700">{t('categories.title')}</Paragraph>
            <Paragraph color="$color10">{t('categories.subtitle')}</Paragraph>
          </YStack>
          <FintButton circular width={44} height={44} icon={<Plus size={20} />} onPress={openCreate} aria-label={t('categories.newTitle')} />
        </XStack>

        <MovementTypeSelector value={type} onValueChange={setType} />

        {categoriesQuery.isLoading ? <SkeletonGroup label={t('states.loading')}><SkeletonList grouped rows={6} /></SkeletonGroup> : null}
        {categoriesQuery.error ? <DataStateCard message={t('categories.loadError')} onRetry={() => { void categoriesQuery.refetch() }} /> : null}
        {!categoriesQuery.isLoading && !categoriesQuery.error && categories.length === 0 ? (
          <FintCard gap="$3" items="center" py="$6">
            <YStack width={58} height={58} rounded="$10" bg="$secondary" items="center" justify="center">
              <Shapes size={28} color="$primary" />
            </YStack>
            <Paragraph color="$color12" fontFamily="$heading" fontSize="$5" fontWeight="700">{t('categories.emptyTitle')}</Paragraph>
            <Paragraph color="$color10" text="center">{t('categories.emptyDescription')}</Paragraph>
            <FintButton onPress={openCreate}>{t('categories.newAction')}</FintButton>
          </FintCard>
        ) : null}
        {!categoriesQuery.isLoading && !categoriesQuery.error && categories.length > 0 ? (
          <FintCard p={0} overflow="hidden">
            {categories.map((category, index) => (
              <YStack key={category.id}>
                {index > 0 ? <Separator ml={66} /> : null}
                <XStack items="center" gap="$1" px="$2" py="$1">
                  <XStack
                    flex={1}
                    minW={0}
                    items="center"
                    gap="$3"
                    px="$2"
                    py="$2"
                    rounded="$5"
                    cursor="pointer"
                    role="button"
                    pressStyle={{ bg: '$secondary' }}
                    onPress={() => openEdit(category)}
                    aria-label={t('categories.editAccessibility', { name: getCategoryLabel(category.name, t) })}
                  >
                    <YStack width={42} height={42} rounded="$9" bg="$secondary" items="center" justify="center">
                      <Paragraph fontSize="$5">{category.icon || suggestedCategoryIcons(category.name, category.type)[0]}</Paragraph>
                    </YStack>
                    <Paragraph color="$color12" fontSize="$3" fontWeight="700" flex={1} numberOfLines={1}>{getCategoryLabel(category.name, t)}</Paragraph>
                    <XStack items="center" gap="$1" bg={category.type === 'income' ? '$green2' : '$red2'} px="$2" py="$1" rounded="$10">
                      {category.type === 'income' ? <ArrowDownLeft size={12} color="$green10" /> : <ArrowUpRight size={12} color="$red10" />}
                      <Paragraph color={category.type === 'income' ? '$green11' : '$red11'} fontSize={10} fontWeight="800">{t(`forms.${category.type}`)}</Paragraph>
                    </XStack>
                  </XStack>
                  <Button
                    circular
                    chromeless
                    size="$3"
                    disabled={deleteMutation.isPending && deleteTarget?.id === category.id}
                    icon={
                      deleteMutation.isPending && deleteTarget?.id === category.id
                        ? <FintSpinner size="small" color="$red10" />
                        : <Trash2 size={18} color="$red10" />
                    }
                    pressStyle={{ bg: '$red3' }}
                    onPress={() => setDeleteTarget(category)}
                    aria-label={t('categories.deleteAccessibility', { name: getCategoryLabel(category.name, t) })}
                  />
                </XStack>
              </YStack>
            ))}
          </FintCard>
        ) : null}
      </Screen>
      <CreateCategorySheet initialType={type} category={editingCategory} open={isSheetOpen} onOpenChange={handleSheetOpenChange} />
      <FintConfirmDialog
        open={Boolean(deleteTarget)}
        isPending={deleteMutation.isPending}
        title={t('categories.deleteTitle')}
        description={t('categories.deleteDescription', { name: deleteTarget ? getCategoryLabel(deleteTarget.name, t) : '' })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('categories.deleteConfirm')}
        pendingLabel={t('categories.deleting')}
        destructive
        icon={<Trash2 size={17} color="$primaryForeground" />}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </>
  )
}
