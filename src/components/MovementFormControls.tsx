import { ArrowDownLeft, ArrowUpRight, ChevronRight, FilePenLine } from '@tamagui/lucide-icons-2'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Input, Paragraph, XStack, YStack } from 'tamagui'
import type { TransactionType } from '../api/types'
import { FintButton, FintCard, FintFormField } from '../ui'

export function MovementTypeSelector({ onValueChange, value }: { onValueChange: (value: TransactionType) => void; value: TransactionType }) {
  const { t } = useTranslation()
  return (
    <FintCard p="$1" bg="$muted" rounded="$7">
      <XStack gap="$1">
        {(['expense', 'income'] as const).map((option) => {
          const selected = value === option
          const income = option === 'income'
          const accent = income ? '$green9' : '$red9'
          return (
            <FintButton
              key={option}
              flex={1}
              minH={56}
              variant="solid"
              bg={selected ? income ? '$green2' : '$red2' : 'transparent'}
              color={selected ? income ? '$green11' : '$red11' : '$color10'}
              borderColor={selected ? accent : 'transparent'}
              borderWidth={1}
              icon={<YStack width={30} height={30} rounded="$10" bg={selected ? accent : '$color4'} items="center" justify="center">{income ? <ArrowDownLeft size={16} color={selected ? 'white' : '$color10'} /> : <ArrowUpRight size={16} color={selected ? 'white' : '$color10'} />}</YStack>}
              onPress={() => onValueChange(option)}
            >
              {t(`forms.${option}`)}
            </FintButton>
          )
        })}
      </XStack>
    </FintCard>
  )
}

export function MovementAmountField({ currency, error, label, onChangeText, required = true, value }: { currency: string; error?: string; label?: string; onChangeText: (value: string) => void; required?: boolean; value: string }) {
  const { t } = useTranslation()
  const fieldLabel = label ?? t('forms.amount')
  return (
    <FintFormField label={fieldLabel} required={required} error={error} showLabel={false}>
      <YStack
        minH={148}
        gap="$2"
        p="$4"
        bg="$accent1"
        borderColor={error ? '$red8' : '$accent5'}
        borderWidth={1}
        rounded="$7"
      >
        <Paragraph color="$color10" fontSize="$2" fontWeight="600">{fieldLabel}{required ? ' *' : ''}</Paragraph>
        <XStack flex={1} items="center" gap="$3">
          <YStack minW={48} height={48} px="$2" rounded="$10" bg="$accent3" items="center" justify="center">
            <Paragraph color="$primary" fontFamily="$heading" fontSize="$3" fontWeight="900">{currency}</Paragraph>
          </YStack>
          <Input
            unstyled
            flex={1}
            height={88}
            color="$color12"
            fontFamily="$body"
            fontSize="$9"
            fontWeight="900"
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="$color7"
            textAlign="center"
            value={value}
            onChangeText={onChangeText}
            aria-label={fieldLabel}
          />
        </XStack>
      </YStack>
    </FintFormField>
  )
}

export function FormTextField({ autoCapitalize = 'sentences', error, icon, label, maxLength, onChangeText, placeholder, required = false, value }: { autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'; error?: string; icon: ReactNode; label: string; maxLength?: number; onChangeText: (value: string) => void; placeholder: string; required?: boolean; value: string }) {
  return (
    <FintFormField label={label} required={required} error={error} showLabel={false}>
      <XStack minH={68} items="center" gap="$3" bg="$card" borderColor={error ? '$red8' : '$borderColor'} borderWidth={1} rounded="$6" px="$3">
        <YStack width={42} height={42} rounded="$10" bg="$accent2" items="center" justify="center">{icon}</YStack>
        <YStack flex={1} minW={0} gap={2}>
          <Paragraph color="$color10" fontSize="$1" fontWeight="600">{label}{required ? ' *' : ''}</Paragraph>
          <Input unstyled height={22} minH={22} p={0} m={0} lineHeight={20} color="$color12" fontSize="$3" fontWeight="700" placeholder={placeholder} placeholderTextColor="$color8" value={value} onChangeText={onChangeText} autoCapitalize={autoCapitalize} maxLength={maxLength} aria-label={label} />
        </YStack>
      </XStack>
    </FintFormField>
  )
}

export function FormTextArea({ error, icon, label, minHeight = 112, onChangeText, placeholder, required = false, value }: { error?: string; icon: ReactNode; label: string; minHeight?: number; onChangeText: (value: string) => void; placeholder: string; required?: boolean; value: string }) {
  return (
    <FintFormField label={label} required={required} error={error} showLabel={false}>
      <XStack minH={minHeight} items="flex-start" gap="$3" bg="$card" borderColor={error ? '$red8' : '$borderColor'} borderWidth={1} rounded="$6" p="$3">
        <YStack width={42} height={42} rounded="$10" bg="$accent2" items="center" justify="center">{icon}</YStack>
        <YStack flex={1} minW={0} gap={2}>
          <Paragraph color="$color10" fontSize="$1" fontWeight="600">{label}{required ? ' *' : ''}</Paragraph>
          <Input unstyled flex={1} minH={minHeight - 52} p={0} m={0} color="$color12" placeholder={placeholder} placeholderTextColor="$color8" value={value} onChangeText={onChangeText} multiline textAlignVertical="top" aria-label={label} />
        </YStack>
      </XStack>
    </FintFormField>
  )
}

export function MovementPickerTrigger({ icon, invalid = false, label, onPress, required = false, value }: { icon: ReactNode; invalid?: boolean; label: string; onPress: () => void; required?: boolean; value: string }) {
  return (
    <XStack
      width="100%"
      minH={68}
      items="center"
      gap="$3"
      bg="$card"
      borderColor={invalid ? '$red8' : '$borderColor'}
      borderWidth={1}
      rounded="$6"
      px="$3"
      pressStyle={{ bg: '$secondary', borderColor: invalid ? '$red8' : '$ring' }}
      cursor="pointer"
      role="button"
      onPress={onPress}
      aria-label={`${label}: ${value}`}
    >
      <YStack width={42} height={42} rounded="$10" bg="$accent2" items="center" justify="center">{icon}</YStack>
      <YStack flex={1} minW={0} gap="$1">
        <Paragraph color="$color10" fontSize="$1" fontWeight="600">{label}{required ? ' *' : ''}</Paragraph>
        <Paragraph color="$color12" fontSize="$3" fontWeight="800" numberOfLines={1}>{value}</Paragraph>
      </YStack>
      <ChevronRight size={20} color="$color9" />
    </XStack>
  )
}

export function MovementNoteField({ label, onChangeText, placeholder, value }: { label: string; onChangeText: (value: string) => void; placeholder: string; value: string }) {
  return <FormTextArea icon={<FilePenLine size={21} color="$primary" />} label={label} placeholder={placeholder} value={value} onChangeText={onChangeText} />
}
