import { ChevronRight } from '@tamagui/lucide-icons-2'
import { Children, Fragment, type ReactNode } from 'react'
import { Paragraph, XStack, YStack } from 'tamagui'
import { FintCard } from '../ui'

/**
 * Lista agrupada: un solo contenedor con filete entre filas, en vez de una
 * tarjeta por campo. El filete se sangra hasta donde arranca el texto (49 px en
 * formularios: relleno 14 + glifo 22 + hueco 13).
 */
export const LIST_ROW_INSET = 49

export function FintListGroup({ children, inset = LIST_ROW_INSET, invalid = false }: { children: ReactNode; inset?: number; invalid?: boolean }) {
  const rows = Children.toArray(children).filter(Boolean)
  return (
    // El error tiñe el borde del grupo; el mensaje va debajo, no dentro.
    <FintCard p={0} overflow="hidden" borderColor={invalid ? '$red8' : '$borderColor'}>
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <YStack height={1} bg="$borderColor" ml={inset} /> : null}
          {row}
        </Fragment>
      ))}
    </FintCard>
  )
}

/**
 * Fila de formulario: etiqueta pequeña arriba, valor debajo.
 *
 * En su día esto fue una sola línea -etiqueta izquierda, valor derecha, como
 * Ajustes de iOS-, pero ese patrón da por hecho que ambos son cortos. En
 * español no lo son: "Fecha del movimiento" con "Selecciona una categoría" no
 * entra en 390 px y el valor acababa comiéndose la etiqueta.
 */
export function FintListRow({
  icon,
  label,
  onPress,
  required = false,
  disabled = false,
  value,
  valueSlot,
  trailing,
}: {
  icon: ReactNode
  label: string
  onPress?: () => void
  required?: boolean
  disabled?: boolean
  value?: string
  /** Ocupa la línea del valor: un input, por ejemplo. */
  valueSlot?: ReactNode
  /** Control al final de la fila. Por defecto, el chevron cuando la fila abre algo. */
  trailing?: ReactNode
}) {
  const interactive = Boolean(onPress) && !disabled
  return (
    <XStack
      minH={64}
      items="center"
      gap="$3"
      px={14}
      py="$2"
      bg="transparent"
      opacity={disabled ? 0.45 : 1}
      cursor={interactive ? 'pointer' : undefined}
      role={interactive ? 'button' : undefined}
      transition="quick"
      pressStyle={interactive ? { bg: '$secondary' } : undefined}
      onPress={interactive ? onPress : undefined}
      aria-label={value ? `${label}: ${value}` : label}
    >
      <YStack shrink={0}>{icon}</YStack>
      <YStack flex={1} minW={0} gap={2}>
        <Paragraph color="$color10" fontSize="$1" fontWeight="600">
          {label}
          {required ? ' *' : ''}
        </Paragraph>
        {valueSlot ?? (
          <Paragraph color="$color12" fontSize="$3" fontWeight="600" numberOfLines={1}>
            {value}
          </Paragraph>
        )}
      </YStack>
      {trailing ?? (interactive ? <ChevronRight size={20} color="$color9" /> : null)}
    </XStack>
  )
}

/** Nota al pie del grupo: explica sin colgarle "(opcional)" a la etiqueta. */
export function FintListFootnote({ children }: { children: ReactNode }) {
  return (
    <Paragraph color="$color10" fontSize="$1" px="$1" pt="$2">
      {children}
    </Paragraph>
  )
}
