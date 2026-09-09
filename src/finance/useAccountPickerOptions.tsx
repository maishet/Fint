import { Layers } from '@tamagui/lucide-icons-2'
import { useTranslation } from 'react-i18next'
import { YStack } from 'tamagui'
import { useSensitiveMoney } from '../privacy/useSensitiveMoney'
import type { FintSelectOption } from '../ui/FintSheetSelect'
import { getAccountIcon, getAccountTypeLabel } from './accountTypes'
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
 * glifo de su tipo —roja si el saldo está en negativo—, "tipo · moneda" en el
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
    const Icon = getAccountIcon(accountType ?? '')
    const isNegative = (balance ?? 0) < 0
    const typeLabel = accountType ? getAccountTypeLabel(accountType, t) : null
    return {
      value: useIdAsValue ? item.id : item.name,
      label: item.name,
      triggerLabel: currency ? `${item.name} · ${currency}` : item.name,
      detail: [typeLabel, currency].filter(Boolean).join(' · ') || undefined,
      meta: balance == null || !currency ? undefined : formatSensitiveAmount(balance, currency),
      icon: (
        <YStack
          width={34}
          height={34}
          rounded="$10"
          bg={isNegative ? '$red2' : '$secondary'}
          items="center"
          justify="center"
        >
          <Icon size={17} color={isNegative ? '$red10' : '$primary'} />
        </YStack>
      ),
    }
  }
}

/**
 * La fila "todas las cuentas" de los filtros. Lleva insignia como las demás:
 * sin ella su texto arrancaría 47 px antes que el del resto.
 */
export function allAccountsOption(value: string, label: string): FintSelectOption {
  return {
    value,
    label,
    icon: (
      <YStack width={34} height={34} rounded="$10" bg="$secondary" items="center" justify="center">
        <Layers size={17} color="$primary" />
      </YStack>
    ),
  }
}
