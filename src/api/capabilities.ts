import { useQuery } from '@tanstack/react-query'
import { financeApi } from './finance'
import type { AppCapabilities } from './types'

export const disabledCapabilities: AppCapabilities = {
  features: {
    editablePendingMovements: false,
    pendingToPayment: false,
    recurringPayments: false,
    pushPaymentReminders: false,
    autoPayPayments: false,
    captureImport: false,
    accountCurrencyBalances: false,
  },
}

export function useCapabilities() {
  const query = useQuery({ queryKey: ['capabilities'], queryFn: financeApi.getCapabilities, retry: false })
  const capabilities = query.data ?? disabledCapabilities
  // Rama de lanzamiento a tiendas: la captura por foto se vende como "Próximamente"
  // (ComingSoonCard) sin importar lo que devuelva el backend todavía.
  return { ...query, capabilities: { ...capabilities, features: { ...capabilities.features, captureImport: false } } }
}
