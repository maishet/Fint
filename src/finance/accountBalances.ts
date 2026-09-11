import type { AccountOption } from '../api/types'

/** Las monedas que puede afectar esta cuenta: sus saldos, o su principal si aún no las trae. */
export function balanceCurrencies(item: AccountOption): string[] {
  return item.balances && item.balances.length > 0 ? item.balances.map((line) => line.currency) : [item.currency]
}
