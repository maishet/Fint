import { Plus, X } from '@tamagui/lucide-icons-2'
import { useState } from 'react'
import { Button, Input, Paragraph, XStack } from 'tamagui'

/**
 * Palabras sueltas como chips llenos (fondo $primary, no el mismo tono que la
 * tarjeta) para que se lean como algo tocable. "Agregar" es otro chip -- al
 * tocarlo se convierte en un input que se cierra solo al confirmar.
 */
export function ChipInput({
  value,
  onChange,
  placeholder,
  addLabel,
  maxChips = 5,
  ariaLabel,
  removeAriaLabel,
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  addLabel?: string
  maxChips?: number
  ariaLabel?: string
  removeAriaLabel?: (chip: string) => string
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const commitDraft = () => {
    const trimmed = draft.trim()
    setDraft('')
    setIsAdding(false)
    if (!trimmed || value.length >= maxChips) return
    if (value.some((chip) => chip.toLowerCase() === trimmed.toLowerCase())) return
    onChange([...value, trimmed])
  }

  const removeChip = (chip: string) => onChange(value.filter((item) => item !== chip))
  const canAddMore = value.length < maxChips

  return (
    <XStack flexWrap="wrap" gap="$2" items="center">
      {value.map((chip) => (
        <XStack key={chip} items="center" gap="$1.5" bg="$primary" rounded="$10" pl="$3.5" pr="$1.5" py="$2" shadowOpacity={0.18} shadowRadius={6} shadowOffset={{ width: 0, height: 3 }}>
          <Paragraph color="$primaryForeground" fontSize="$2" fontWeight="700">
            {chip}
          </Paragraph>
          <Button
            circular
            chromeless
            size="$1"
            icon={<X size={12} color="$primaryForeground" />}
            pressStyle={{ bg: '$primaryStrong' }}
            onPress={() => removeChip(chip)}
            aria-label={removeAriaLabel?.(chip) ?? chip}
          />
        </XStack>
      ))}

      {canAddMore && isAdding ? (
        <XStack items="center" bg="$background" borderColor="$primary" borderWidth={1.5} rounded="$10" pl="$3.5" pr="$2" py="$1.5">
          <Input
            unstyled
            width={100}
            height={22}
            minH={22}
            p={0}
            m={0}
            color="$color12"
            fontFamily="$body"
            fontSize="$2"
            fontWeight="700"
            placeholder={placeholder}
            placeholderTextColor="$color9"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={commitDraft}
            onBlur={commitDraft}
            returnKeyType="done"
            autoCapitalize="characters"
            autoFocus
            aria-label={ariaLabel}
          />
        </XStack>
      ) : canAddMore ? (
        <XStack
          items="center"
          gap="$1"
          borderColor="$primary"
          borderWidth={1.5}
          borderStyle="dashed"
          rounded="$10"
          pl="$3"
          pr="$3.5"
          py="$2"
          cursor="pointer"
          pressStyle={{ bg: '$secondary' }}
          onPress={() => setIsAdding(true)}
          role="button"
          aria-label={addLabel}
        >
          <Plus size={13} color="$primary" />
          <Paragraph color="$primary" fontSize="$2" fontWeight="700">
            {addLabel}
          </Paragraph>
        </XStack>
      ) : null}
    </XStack>
  )
}
