import { CalendarClock, Receipt } from '@tamagui/lucide-icons-2'
import { useTranslation } from 'react-i18next'
import { YStack } from 'tamagui'
import type { PaymentOccurrence } from '../api/types'
import { getAppLocale } from '../i18n'
import { useSensitiveMoney } from '../privacy/useSensitiveMoney'
import type { FintSelectOption } from '../ui/FintSheetSelect'
import { getDueState } from './dueState'

function badge(children: React.ReactNode, overdue = false) {
  return (
    <YStack
      width={34}
      height={34}
      rounded="$10"
      bg={overdue ? '$red2' : '$secondary'}
      items="center"
      justify="center"
    >
      {children}
    </YStack>
  )
}

/**
 * Aplicar un movimiento detectado a un pago programado. Antes el título y el
 * saldo pendiente iban apretados en una sola línea; aquí el título manda, el
 * vencimiento va debajo y el saldo a la derecha.
 */
export function useOccurrencePickerOptions() {
  const { i18n, t } = useTranslation()
  const { formatSensitiveAmount } = useSensitiveMoney()
  const locale = getAppLocale(i18n.resolvedLanguage)

  return (occurrence: PaymentOccurrence): FintSelectOption => {
    const due = getDueState(occurrence.dueDate, locale, t)
    return {
      value: occurrence.id,
      label: occurrence.title,
      detail: due.label,
      // Pasa por el ojo de privacidad, igual que los saldos de las cuentas.
      meta: formatSensitiveAmount(occurrence.remainingAmount ?? 0, occurrence.currency),
      icon: badge(
        <CalendarClock size={17} color={due.overdue ? '$red10' : '$primary'} />,
        due.overdue,
      ),
    }
  }
}

/** La opción "es un movimiento normal": misma insignia, para que nada baile. */
export function normalMovementOption(value: string, label: string): FintSelectOption {
  return { value, label, icon: badge(<Receipt size={17} color="$primary" />) }
}
