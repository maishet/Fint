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
  },
}

export function useCapabilities() {
  const query = useQuery({ queryKey: ['capabilities'], queryFn: financeApi.getCapabilities, retry: false })
  return { ...query, capabilities: query.data ?? disabledCapabilities }
}
