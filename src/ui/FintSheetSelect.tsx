import { Check, ChevronDown, Search } from '@tamagui/lucide-icons-2'
import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { Keyboard } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Input, Paragraph, Sheet, XStack, YStack, type XStackProps } from 'tamagui'
import { useSheetBackHandler } from '../hooks/useSheetBackHandler'

export interface FintSelectOption {
  icon?: ReactNode
  label: string
  value: string
}

interface FintSheetSelectProps extends Omit<XStackProps, 'onPress'> {
  label: string
  onValueChange: (value: string) => void
  options: readonly FintSelectOption[]
  placeholder: string
  searchable?: boolean
  searchPlaceholder?: string
  showLabel?: boolean
  renderTrigger?: (props: { onPress: () => void; selectedLabel: string }) => ReactNode
  value?: string
}

export function FintSheetSelect({ label, onValueChange, options, placeholder, searchable = false, searchPlaceholder = placeholder, showLabel = true, renderTrigger, value, ...props }: FintSheetSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const insets = useSafeAreaInsets()
  const selectedLabel = options.find((option) => option.value === value)?.label ?? placeholder
  const filteredOptions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return options
    return options.filter((option) => `${option.value} ${option.label}`.toLocaleLowerCase().includes(query))
  }, [options, search])
  const isLongList = searchable || options.length > 8
  const closeSheet = useCallback(() => {
    Keyboard.dismiss()
    setIsOpen(false)
    setSearch('')
  }, [])
  useSheetBackHandler(isOpen, closeSheet)

  const optionRows = filteredOptions.map((option) => {
    const isSelected = option.value === value
    return (
      <XStack
        key={option.value}
        items="center"
        justify="space-between"
        gap="$3"
        px="$3"
        py="$3"
        rounded="$5"
        bg={isSelected ? '$secondary' : 'transparent'}
        borderColor={isSelected ? '$primary' : 'transparent'}
        borderWidth={1}
        pressStyle={{ bg: '$secondary' }}
        cursor="pointer"
        role="button"
        onPress={() => {
          Keyboard.dismiss()
          onValueChange(option.value)
          setIsOpen(false)
          setSearch('')
        }}
        aria-label={option.label}
      >
        <XStack items="center" gap="$3" flex={1} minW={0}>
          {option.icon}
          <Paragraph color={isSelected ? '$primary' : '$color12'} fontWeight={isSelected ? '700' : '600'} numberOfLines={1}>{option.label}</Paragraph>
        </XStack>
        {isSelected ? <Check size={18} color="$primary" /> : null}
      </XStack>
    )
  })

  return (
    <>
      {renderTrigger ? renderTrigger({ onPress: () => setIsOpen(true), selectedLabel }) : (
        <XStack
          items="center"
          justify="space-between"
          gap="$3"
          bg="$muted"
          borderColor="$input"
          borderWidth={1}
          rounded={14}
          p="$3"
          pressStyle={{ bg: '$secondary', borderColor: '$ring' }}
          cursor="pointer"
          role="button"
          onPress={() => setIsOpen(true)}
          aria-label={`${label}: ${selectedLabel}`}
          {...props}
        >
          <YStack flex={1} minW={0} gap="$1">
            {showLabel ? <Paragraph color="$color10" fontSize="$1">{label}</Paragraph> : null}
            <Paragraph color="$color12" fontWeight="700" numberOfLines={1}>{selectedLabel}</Paragraph>
          </YStack>
          <ChevronDown size={18} color="$color10" />
        </XStack>
      )}

      <Sheet
        modal
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) Keyboard.dismiss()
          setIsOpen(open)
          if (!open) setSearch('')
        }}
        snapPointsMode={isLongList ? 'percent' : 'fit'}
        snapPoints={isLongList ? [78] : undefined}
        dismissOnSnapToBottom
        zIndex={110_000}
      >
        <Sheet.Overlay bg="rgba(0,0,0,0.4)" />
        <Sheet.Handle bg="$color6" />
        <Sheet.Frame bg="$popover" gap="$2" px="$4" pt="$2" pb={Math.max(insets.bottom, 16)} rounded={14}>
          <Paragraph color="$color12" fontFamily="$heading" fontSize="$5" fontWeight="700" mb="$1">{label}</Paragraph>
          {searchable ? (
            <XStack items="center" gap="$2" bg="$muted" borderColor="$input" borderWidth={1} rounded={14} px="$3">
              <Search size={17} color="$color10" />
              <Input
                flex={1}
                unstyled
                color="$color12"
                placeholderTextColor="$mutedForeground"
                placeholder={searchPlaceholder}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
              />
            </XStack>
          ) : null}
          {isLongList ? (
            <Sheet.ScrollView flex={1} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 4 }}>
              {optionRows}
            </Sheet.ScrollView>
          ) : optionRows}
        </Sheet.Frame>
      </Sheet>
    </>
  )
}
