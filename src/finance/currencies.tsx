import { data as currencyData } from 'currency-codes'
import { Paragraph, YStack } from 'tamagui'
import type { FintSelectOption } from '../ui/FintSheetSelect'

const priority = new Map([
  ['PEN', 0],
  ['USD', 1],
  ['EUR', 2],
])

const currencySymbols: Record<string, string> = {
  // Latinoamérica y Caribe
  PEN: 'S/', MXN: '$', ARS: '$', CLP: '$', COP: '$', UYU: '$U', PYG: '₲', BOB: 'Bs',
  BRL: 'R$', VES: 'Bs', CRC: '₡', GTQ: 'Q', HNL: 'L', NIO: 'C$', PAB: 'B/.', DOP: 'RD$', CUP: '$',
  // Principales monedas globales
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', CHF: 'CHF', CAD: '$', AUD: '$',
}

export function getCurrencySymbol(code: string = 'PEN'): string {
  return currencySymbols[code] ?? code
}

/**
 * El simbolo va en su propia insignia, el nombre manda y el codigo queda de
 * apoyo: antes los tres iban apretados en una sola linea de texto.
 */
export const currencyOptions: readonly FintSelectOption[] = currencyData
  .filter((currency) => currency.code in currencySymbols)
  .map((currency) => ({
    value: currency.code,
    label: currency.currency,
    detail: currency.code,
    triggerLabel: `${currency.code} · ${currency.currency}`,
    icon: (
      <YStack width={34} height={34} rounded="$10" bg="$secondary" items="center" justify="center">
        <Paragraph color="$primary" fontFamily="$heading" fontSize="$2" fontWeight="600">
          {getCurrencySymbol(currency.code)}
        </Paragraph>
      </YStack>
    ),
  }))
  .sort((left, right) => {
    const leftPriority = priority.get(left.value) ?? 99
    const rightPriority = priority.get(right.value) ?? 99
    return leftPriority - rightPriority || left.value.localeCompare(right.value)
  })
