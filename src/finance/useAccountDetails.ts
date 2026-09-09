import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../api/finance'
import { normalizeAccount } from '../api/mappers'

/**
 * El tipo y el saldo de una cuenta para pintarla en un selector.
 *
 * `/accounts/options` ya los manda, pero la app puede estar corriendo contra
 * una API anterior: entonces se rescatan de la vista general de cuentas, que
 * comparte clave de caché con la pestaña Cuentas y suele estar ya cargada. Si
 * tampoco está, se devuelve `null` y quien llama muestra sólo la moneda.
 */
export function useAccountDetails() {
  const overviewQuery = useQuery({
    queryKey: ['accounts', 'overview', ''],
    queryFn: ({ signal }) => financeApi.getAccountsOverview(undefined, signal),
  })
  const byId = new Map(
    (overviewQuery.data?.items ?? []).map(normalizeAccount).map((item) => [item.id, item]),
  )

  return (option: { id: string; accountType?: string | null; balance?: number | null; currency?: string }) => {
    const fallback = byId.get(option.id)
    return {
      accountType: option.accountType ?? fallback?.accountType ?? null,
      balance: option.balance ?? fallback?.balance ?? null,
      // Inicio manda las cuentas sin moneda; aquí se rescata.
      currency: option.currency ?? fallback?.currency ?? null,
    }
  }
}
