import { Layers } from '@tamagui/lucide-icons-2'
import { useTranslation } from 'react-i18next'
import { YStack } from 'tamagui'
import { useSensitiveMoney } from '../privacy/useSensitiveMoney'
import type { FintSelectOption } from '../ui/FintSheetSelect'
import { getAccountRowIcon, getAccountTypeLabel } from './accountTypes'
import { useAccountDetails } from './useAccountDetails'

/** Lo mínimo para pintar una cuenta: el resto se rescata si no viene. */
export type PickableAccount = {
  id: string
  name: string
  currency?: string
  accountType?: string | null
  balance?: number | null
}

/**
 * Arma la opción de una cuenta para una hoja de selección: insignia con el
 * ícono de su tipo, el mismo de Cuentas —en rojo si el saldo está en negativo—, "tipo · moneda" en el
 * segundo renglón y el saldo a la derecha.
 *
 * En la fila manda el nombre; el disparador necesita además la moneda, de ahí
 * el `triggerLabel`. Si no hay detalle de la cuenta, cae a nombre + moneda.
 */
export function useAccountPickerOptions() {
  const { t } = useTranslation()
  const { formatSensitiveAmount } = useSensitiveMoney()
  const accountDetails = useAccountDetails()

  return (item: PickableAccount, useIdAsValue = true): FintSelectOption => {
    const { accountType, balance, currency } = accountDetails(item)
    const Icon = getAccountRowIcon(accountType)
    const isNegative = (balance ?? 0) < 0
    const typeLabel = accountType ? getAccountTypeLabel(accountType, t) : null
    return {
      value: useIdAsValue ? item.id : item.name,
      label: item.name,
      triggerLabel: currency ? `${item.name} · ${currency}` : item.name,
      detail: [typeLabel, currency].filter(Boolean).join(' · ') || undefined,
      meta: balance == null || !currency ? undefined : formatSensitiveAmount(balance, currency),
      icon: (
        <YStack width={38} height={38} rounded={12} bg={isNegative ? '$dangerWash' : '$surface'} items="center" justify="center">
          <Icon size={19} color={isNegative ? '$dangerHard' : '$ink'} strokeWidth={2} />
        </YStack>
      ),
    }
  }
}

/**
 * La fila "todas las cuentas" de los filtros. Lleva insignia como las demás:
 * sin ella su texto arrancaría 51 px antes que el del resto.
 */
export function allAccountsOption(value: string, label: string): FintSelectOption {
  return {
    value,
    label,
    icon: (
      <YStack width={38} height={38} rounded={12} bg="$surface" items="center" justify="center">
        <Layers size={19} color="$ink" strokeWidth={2} />
      </YStack>
    ),
  }
}
