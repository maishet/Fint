import { ArrowDown, ArrowUp, FilePenLine } from '@tamagui/lucide-icons-2'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Input, Paragraph, XStack, YStack, type InputProps } from 'tamagui'
import type { TransactionType } from '../api/types'
import { getCurrencySymbol } from '../finance/currencies'
import { sanitizeAmountInput } from '../forms'
import { FintCard, FintFormField } from '../ui'
import { FintOptionGroup } from './FintOptionGroup'
import { FintListGroup, FintListRow } from './FintListGroup'

export function MovementTypeSelector({ onValueChange, value }: { onValueChange: (value: TransactionType) => void; value: TransactionType }) {
  const { t } = useTranslation()
  return (
    <FintOptionGroup
      value={value}
      onValueChange={onValueChange}
      options={[
        { value: 'expense' as const, label: t('forms.expense'), icon: ArrowDown, tone: 'negative' as const },
        { value: 'income' as const, label: t('forms.income'), icon: ArrowUp, tone: 'positive' as const },
      ]}
    />
  )
}

export function MovementAmountField({ currency, error, helperText, label, onBlur, onChangeText, onCurrencyPress, required = true, value }: { currency: string; error?: string; helperText?: string; label?: string; onBlur?: () => void; onChangeText: (value: string) => void; onCurrencyPress?: () => void; required?: boolean; value: string }) {
  const { t } = useTranslation()
  const fieldLabel = label ?? t('forms.amount')
  // Centrado y con tamano fijo, un monto largo se recorta por los DOS lados y el
  // cursor deja de coincidir con el texto. La cifra encoge antes de llegar ahi.
  const amountFontSize = value.length > 12 ? 24 : value.length > 9 ? 29 : 34
  return (
    <FintFormField label={fieldLabel} required={required} error={error} showLabel={false}>
      {/*
        El relleno va en `$card`, no en `$accent1`: en tema oscuro `$accent1` es
        el propio fondo de pantalla, así que el campo no se leía como campo.
      */}
      <YStack
        minH={122}
        gap="$2"
        p="$4"
        bg="$card"
        borderColor={error ? '$red8' : required ? '$accent5' : '$borderColor'}
        borderWidth={1}
        rounded="$7"
      >
        <Paragraph color="$color10" fontSize="$2" fontWeight="600">{fieldLabel}{required ? ' *' : ''}</Paragraph>
        <XStack flex={1} items="center" gap="$3">
          <YStack minW={48} height={48} px="$2" rounded="$10" bg="$secondary" items="center" justify="center" onPress={onCurrencyPress} role={onCurrencyPress ? 'button' : undefined} cursor={onCurrencyPress ? 'pointer' : undefined} pressStyle={onCurrencyPress ? { bg: '$elevated' } : undefined} aria-label={currency}>
            <Paragraph color="$primary" fontFamily="$heading" fontSize="$3" fontWeight="600">{getCurrencySymbol(currency)}</Paragraph>
          </YStack>
          <Input
            unstyled
            flex={1}
            // Con alto fijo, Android recorta la parte alta de los digitos: el
            // alto y el interlineado salen del propio tamano de la cifra.
            minH={amountFontSize + 20}
            lineHeight={Math.round(amountFontSize * 1.3)}
            textAlignVertical="center"
            color="$color12"
            fontFamily="$body"
            fontSize={amountFontSize}
            fontWeight="600"
            letterSpacing={-0.6}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="$color7"
            textAlign="center"
            value={value}
            onChangeText={(next) => onChangeText(sanitizeAmountInput(next))}
            onBlur={onBlur}
            aria-label={fieldLabel}
          />
        </XStack>
        {helperText ? <Paragraph color="$color10" fontSize="$1">{helperText}</Paragraph> : null}
      </YStack>
    </FintFormField>
  )
}

export function FormTextField({ autoCapitalize = 'sentences', autoComplete, error, icon, keyboardType, label, maxLength, onBlur, onChangeText, placeholder, required = false, secureTextEntry, trailing, value }: { autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'; autoComplete?: InputProps['autoComplete']; error?: string; icon: ReactNode; keyboardType?: InputProps['keyboardType']; label: string; maxLength?: number; onBlur?: () => void; onChangeText: (value: string) => void; placeholder: string; required?: boolean; secureTextEntry?: boolean; /** Control al final de la fila: el ojo de mostrar contrasena, por ejemplo. */ trailing?: ReactNode; value: string }) {
  return (
    <FintFormField label={label} required={required} error={error} showLabel={false}>
      <FintListGroup invalid={Boolean(error)}>
        <FintListRow
          icon={icon}
          label={label}
          required={required}
          trailing={trailing}
          valueSlot={
            <Input
              unstyled
              width="100%"
              height={22}
              minH={22}
              p={0}
              m={0}
              lineHeight={20}
              color="$color12"
              fontFamily="$body"
              fontSize="$3"
              fontWeight="600"
              placeholder={placeholder}
              placeholderTextColor="$color8"
              value={value}
              onChangeText={onChangeText}
              onBlur={onBlur}
              autoCapitalize={autoCapitalize}
              autoComplete={autoComplete}
              keyboardType={keyboardType}
              secureTextEntry={secureTextEntry}
              maxLength={maxLength}
              aria-label={label}
            />
          }
        />
      </FintListGroup>
    </FintFormField>
  )
}

export function FormTextArea({ error, icon, label, minHeight = 112, onChangeText, placeholder, required = false, value }: { error?: string; icon: ReactNode; label: string; minHeight?: number; onChangeText: (value: string) => void; placeholder: string; required?: boolean; value: string }) {
  return (
    <FintFormField label={label} required={required} error={error} showLabel={false}>
      <FintCard p={0} overflow="hidden" borderColor={error ? '$red8' : '$borderColor'}>
        <XStack minH={minHeight} items="flex-start" gap="$3" px={14} py="$3">
          <YStack shrink={0}>{icon}</YStack>
          <YStack flex={1} minW={0} gap={2}>
            <Paragraph color="$color10" fontSize="$1" fontWeight="600">{label}{required ? ' *' : ''}</Paragraph>
            <Input unstyled flex={1} width="100%" minH={minHeight - 44} p={0} m={0} color="$color12" fontFamily="$body" fontSize="$3" placeholder={placeholder} placeholderTextColor="$color8" value={value} onChangeText={onChangeText} multiline textAlignVertical="top" aria-label={label} />
          </YStack>
        </XStack>
      </FintCard>
    </FintFormField>
  )
}

/**
 * Disparador suelto de un selector: la misma fila del grupo, pero con su
 * propio marco porque no vive dentro de uno.
 */
export function MovementPickerTrigger({ icon, invalid = false, label, onPress, required = false, value }: { icon: ReactNode; invalid?: boolean; label: string; onPress: () => void; required?: boolean; value: string }) {
  return (
    <FintListGroup invalid={invalid}>
      <FintListRow icon={icon} label={label} onPress={onPress} required={required} value={value} />
    </FintListGroup>
  )
}

export function MovementNoteField({ label, onChangeText, placeholder, value }: { label: string; onChangeText: (value: string) => void; placeholder: string; value: string }) {
  return <FormTextArea icon={<FilePenLine size={22} color="$primary" />} label={label} placeholder={placeholder} value={value} onChangeText={onChangeText} />
}
