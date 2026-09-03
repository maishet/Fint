import { data as currencyData } from 'currency-codes'
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

export const currencyOptions: readonly FintSelectOption[] = currencyData
  .filter((currency) => currency.code in currencySymbols)
  .map((currency) => ({
    value: currency.code,
    label: `${getCurrencySymbol(currency.code)}  ${currency.code} · ${currency.currency}`,
  }))
  .sort((left, right) => {
    const leftPriority = priority.get(left.value) ?? 99
    const rightPriority = priority.get(right.value) ?? 99
    return leftPriority - rightPriority || left.value.localeCompare(right.value)
  })
