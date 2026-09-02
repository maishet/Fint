import type { IconProps } from '@tamagui/helpers-icon'
import type { ReactElement } from 'react'
import { Paragraph, XStack, YStack } from 'tamagui'
import { FintButton, FintCard, FintFormField } from '../ui'

export type FintOptionTone = 'accent' | 'positive' | 'negative'

export interface FintOption<T extends string> {
  value: T
  label: string
  icon?: (props: IconProps) => ReactElement
  tone?: FintOptionTone
}

interface FintOptionGroupProps<T extends string> {
  options: readonly FintOption<T>[]
  value: T
  onValueChange: (value: T) => void
  label?: string
  required?: boolean
  error?: string
  layout?: 'row' | 'grid'
}

const TONES = {
  accent: { accent: '$primary', tint: '$secondary', label: '$primary' },
  positive: { accent: '$green9', tint: '$green2', label: '$green11' },
  negative: { accent: '$red9', tint: '$red2', label: '$red11' },
} as const satisfies Record<FintOptionTone, { accent: string; tint: string; label: string }>

export function FintOptionGroup<T extends string>({
  options,
  value,
  onValueChange,
  label,
  required = false,
  error,
  layout,
}: FintOptionGroupProps<T>) {
  const resolvedLayout = layout ?? (options.length > 3 ? 'grid' : 'row')
  const isGrid = resolvedLayout === 'grid'
  // En fila, tres opciones no caben con el icono al lado de la etiqueta.
  const stacked = !isGrid && options.length > 2
  const badgeSize = stacked ? 24 : isGrid ? 26 : 30
  const iconSize = stacked ? 14 : isGrid ? 15 : 16

  const track = (
    <FintCard p="$1" bg="$muted" rounded="$7">
      <XStack gap="$1" flexWrap={isGrid ? 'wrap' : 'nowrap'}>
        {options.map((option) => {
          const selected = option.value === value
          const tone = TONES[option.tone ?? 'accent']
          const Icon = option.icon
          const badge = Icon ? (
            <YStack
              width={badgeSize}
              height={badgeSize}
              rounded="$10"
              bg={selected ? tone.accent : '$color4'}
              items="center"
              justify="center"
            >
              <Icon size={iconSize} color={selected ? '$primaryForeground' : '$color10'} />
            </YStack>
          ) : null
          const text = (
            <Paragraph
              color={selected ? tone.label : '$color11'}
              fontSize={stacked || isGrid ? 12 : 14}
              fontWeight="600"
              numberOfLines={2}
              text={stacked ? 'center' : undefined}
              lineHeight={stacked ? 14 : undefined}
              flex={isGrid ? 1 : undefined}
            >
              {option.label}
            </Paragraph>
          )
          return (
            <FintButton
              key={option.value}
              flex={isGrid ? undefined : 1}
              width={isGrid ? '49%' : undefined}
              minH={stacked ? 64 : 56}
              px={isGrid ? '$3' : undefined}
              variant="solid"
              bg={selected ? tone.tint : 'transparent'}
              borderColor={selected ? tone.accent : 'transparent'}
              borderWidth={1}
              onPress={() => onValueChange(option.value)}
              aria-label={option.label}
            >
              {stacked ? (
                <YStack items="center" justify="center" gap="$1" px="$1">
                  {badge}
                  {text}
                </YStack>
              ) : (
                <XStack items="center" justify={isGrid ? 'flex-start' : 'center'} gap="$2" width={isGrid ? '100%' : undefined}>
                  {badge}
                  {text}
                </XStack>
              )}
            </FintButton>
          )
        })}
      </XStack>
    </FintCard>
  )

  if (!label) return track
  return (
    <FintFormField label={label} required={required} error={error}>
      {track}
    </FintFormField>
  )
}
