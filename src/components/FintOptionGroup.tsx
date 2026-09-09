import type { IconProps } from '@tamagui/helpers-icon'
import type { ReactElement } from 'react'
import { Paragraph, XStack } from 'tamagui'
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

  const track = (
    // La pista va en `$card`, no en `$muted`: en oscuro `$muted` y `$secondary`
    // -el relleno de lo elegido- son el mismo #223133, así que la opción
    // seleccionada sólo se distinguía por el borde de 1 px.
    <FintCard p="$1" bg="$card" rounded="$7">
      <XStack gap="$1" flexWrap={isGrid ? 'wrap' : 'nowrap'}>
        {options.map((option) => {
          const selected = option.value === value
          const tone = TONES[option.tone ?? 'accent']
          const Icon = option.icon
          return (
            <FintButton
              key={option.value}
              flex={isGrid ? undefined : 1}
              width={isGrid ? '49%' : undefined}
              minH={52}
              px={isGrid ? '$3' : '$2'}
              variant="solid"
              bg={selected ? tone.tint : 'transparent'}
              borderColor={selected ? tone.accent : 'transparent'}
              borderWidth={1}
              rounded={15}
              onPress={() => onValueChange(option.value)}
              aria-label={option.label}
              aria-selected={selected}
            >
              <XStack
                items="center"
                justify={isGrid ? 'flex-start' : 'center'}
                gap="$2"
                width={isGrid ? '100%' : undefined}
              >
                {Icon ? (
                  <Icon size={isGrid ? 16 : 15} color={selected ? tone.label : '$color10'} />
                ) : null}
                <Paragraph
                  color={selected ? tone.label : '$color10'}
                  fontSize={13}
                  fontWeight="600"
                  numberOfLines={1}
                  shrink={1}
                >
                  {option.label}
                </Paragraph>
              </XStack>
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
