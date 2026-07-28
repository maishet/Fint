import { Plus, X } from '@tamagui/lucide-icons-2'
import { useCallback, useState } from 'react'
import { Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Paragraph, Sheet, XStack, YStack } from 'tamagui'
import type { Category, TransactionType } from '../api/types'
import { getCategoryLabel } from '../finance/categoryLabels'
import { suggestedCategoryIcons } from '../finance/categoryIcons'
import { useSheetBackHandler } from '../hooks/useSheetBackHandler'
import { CreateCategorySheet } from './CreateCategorySheet'

interface CategoryPickerSheetProps {
  allowCreate?: boolean
  categories: Category[]
  onValueChange: (value: string) => void
  type: TransactionType
  value: string
  showLabel?: boolean
}

export function CategoryPickerSheet({ allowCreate = true, categories, onValueChange, showLabel = true, type, value }: CategoryPickerSheetProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const selected = categories.find((category) => category.name === value)
  const closePicker = useCallback(() => setOpen(false), [])
  useSheetBackHandler(open && !createOpen, closePicker)

  return (
    <>
      <XStack
        items="center"
        justify="space-between"
        gap="$3"
        bg="$muted"
        borderColor="$input"
        borderWidth={1}
        rounded={14}
        p="$3"
        role="button"
        onPress={() => setOpen(true)}
        aria-label={`${t('forms.category')}: ${selected ? getCategoryLabel(selected.name, t) : t('movements.selectCategory')}`}
      >
        <YStack flex={1} minW={0} gap="$1">
          {showLabel ? <Paragraph color="$color10" fontSize="$1">{t('forms.category')}</Paragraph> : null}
          <Paragraph color="$color12" fontWeight="700" numberOfLines={1}>{selected ? `${selected.icon || suggestedCategoryIcons(selected.name, type)[0]} ${getCategoryLabel(selected.name, t)}` : t('movements.selectCategory')}</Paragraph>
        </YStack>
        <Paragraph fontSize="$6">{selected?.icon || '⌄'}</Paragraph>
      </XStack>

      <Sheet modal open={open} onOpenChange={setOpen} snapPoints={[76]} dismissOnSnapToBottom zIndex={110_000}>
        <Sheet.Overlay bg="rgba(4,18,28,0.58)" />
        <Sheet.Handle bg="$color6" />
        <Sheet.Frame bg="$popover" px="$4" pt="$2" pb={Math.max(insets.bottom, 16)} rounded={18}>
          <XStack items="center" justify="space-between" mb="$3">
            <Paragraph color="$color12" fontFamily="$heading" fontSize="$6" fontWeight="700">{t('categories.routeTitle')}</Paragraph>
            <Button circular chromeless size="$3" icon={<X size={20} color="$color11" />} onPress={() => setOpen(false)} aria-label={t('actions.cancel')} />
          </XStack>
          <Sheet.ScrollView showsVerticalScrollIndicator={false}>
            <XStack flexWrap="wrap" justify="space-between" rowGap="$3" pb="$5">
              {allowCreate ? <CategoryTile icon="+" label={t('categories.newAction')} selected={false} onPress={() => setCreateOpen(true)} /> : null}
              {categories.map((category) => (
                <CategoryTile
                  key={category.id}
                  icon={category.icon || suggestedCategoryIcons(category.name, category.type)[0]}
                  label={getCategoryLabel(category.name, t)}
                  selected={category.name === value}
                  onPress={() => { onValueChange(category.name); setOpen(false) }}
                />
              ))}
            </XStack>
          </Sheet.ScrollView>
        </Sheet.Frame>
      </Sheet>

      {allowCreate ? <CreateCategorySheet
        initialType={type}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(category) => { onValueChange(category.name); setOpen(false) }}
      /> : null}
    </>
  )
}

function CategoryTile({ icon, label, onPress, selected }: { icon: string; label: string; onPress: () => void; selected: boolean }) {
  return (
    <YStack width="30%" minW={0} minH={96} items="center" gap="$2" role="button" onPress={onPress} aria-label={label}>
      <YStack width={60} height={60} rounded="$8" bg={selected ? '$secondary' : '$muted'} borderColor={selected ? '$primary' : '$borderColor'} borderWidth={1} items="center" justify="center" overflow="visible">
        {icon === '+' ? <Plus size={25} color="$primary" /> : <Text style={{ fontSize: 30, includeFontPadding: false, lineHeight: 36, textAlign: 'center', textAlignVertical: 'center' }}>{icon}</Text>}
      </YStack>
      <Paragraph color={selected ? '$primary' : '$color10'} fontSize="$1" fontWeight={selected ? '800' : '600'} numberOfLines={1} width="100%" text="center">{label}</Paragraph>
    </YStack>
  )
}
