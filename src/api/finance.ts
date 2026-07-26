import { apiRequest } from './client'
import type {
  Account,
  AccountMutationResult,
  Category,
  ConfirmPendingInput,
  CreateAccountInput,
  CreateAccountResult,
  CreateCategoryInput,
  CreateCategoryResult,
  CreateDebtInput,
  CreateTransactionInput,
  CreateTransactionResult,
  CurrentUser,
  Debt,
  DiscardPendingInput,
  PayDebtInput,
  PendingMovement,
  Summary,
  Transaction,
  TransactionQuery,
  TransactionType,
  UpdateAccountInput,
  UpdateDebtInput,
  UpdateTransactionInput,
  GmailOAuthStart,
  GmailSource,
  GmailSourceConfigInput,
  FinancialReport,
  FinancialReportQuery,
} from './types'

function toQuery(params: { [key: string]: string | number | undefined }) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const financeApi = {
  getMe: () => apiRequest<CurrentUser>('/api/me'),
  listAccounts: () => apiRequest<Account[]>('/api/accounts'),
  createAccount: (input: CreateAccountInput) => apiRequest<CreateAccountResult>('/api/accounts', { method: 'POST', body: JSON.stringify(input) }),
  updateAccount: (id: string, input: UpdateAccountInput) => apiRequest<AccountMutationResult>(`/api/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteAccount: (id: string) => apiRequest<AccountMutationResult>(`/api/accounts/${id}`, { method: 'DELETE' }),
  getSummary: () => apiRequest<Summary>('/api/summary'),
  listTransactions: (query: TransactionQuery = {}) => apiRequest<Transaction[]>(`/api/transactions${toQuery({ ...query })}`),
  async listAllTransactions(query: Omit<TransactionQuery, 'limit' | 'offset'> = {}) {
    const pageSize = 200
    const transactions: Transaction[] = []
    let offset = 0

    while (true) {
      const page = await apiRequest<Transaction[]>(`/api/transactions${toQuery({ ...query, limit: pageSize, offset })}`)
      transactions.push(...page)
      if (page.length < pageSize) return transactions
      offset += pageSize
    }
  },
  getFinancialReport: (query: FinancialReportQuery) => apiRequest<FinancialReport>(`/api/reports/financial${toQuery({ ...query })}`),
  createTransaction: (input: CreateTransactionInput) => apiRequest<CreateTransactionResult>('/api/transactions', { method: 'POST', body: JSON.stringify(input) }),
  updateTransaction: (id: string, input: UpdateTransactionInput) => apiRequest<{ id: string }>(`/api/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteTransaction: (id: string) => apiRequest<{ id: string }>(`/api/transactions/${id}`, { method: 'DELETE' }),
  listCategories: (type?: TransactionType) => apiRequest<Category[]>(`/api/categories${toQuery({ type })}`),
  createCategory: (input: CreateCategoryInput) => apiRequest<CreateCategoryResult>('/api/categories', { method: 'POST', body: JSON.stringify(input) }),
  listDebts: () => apiRequest<Debt[]>('/api/debts'),
  createDebt: (input: CreateDebtInput) => apiRequest<{ id: string }>('/api/debts', { method: 'POST', body: JSON.stringify(input) }),
  updateDebt: (id: string, input: UpdateDebtInput) => apiRequest<{ id: string }>(`/api/debts/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteDebt: (id: string) => apiRequest<{ id: string }>(`/api/debts/${id}`, { method: 'DELETE' }),
  payDebt: (id: string, input: PayDebtInput) => apiRequest<{ id: string }>(`/api/debts/${id}/pay`, { method: 'POST', body: JSON.stringify(input) }),
  listPendingMovements: (limit = 50) => apiRequest<PendingMovement[]>(`/api/pending-movements${toQuery({ limit })}`),
  confirmPendingMovement: (id: string, input: ConfirmPendingInput) => apiRequest<{ id: string }>(`/api/pending-movements/${id}/confirm`, { method: 'POST', body: JSON.stringify(input) }),
  discardPendingMovement: (id: string, input: DiscardPendingInput = {}) => apiRequest<{ id: string }>(`/api/pending-movements/${id}/discard`, { method: 'POST', body: JSON.stringify(input) }),
  startGmailOAuth: () => apiRequest<GmailOAuthStart>('/api/integrations/gmail/oauth/start'),
  listGmailSources: () => apiRequest<GmailSource[]>('/api/integrations/sources/gmail'),
  updateGmailSource: (id: string, input: GmailSourceConfigInput) => apiRequest<{ id: string; labelIds: string[]; senderFilters: string[] }>(`/api/integrations/sources/gmail/${id}/config`, { method: 'PUT', body: JSON.stringify(input) }),
  syncGmailSource: (id: string) => apiRequest<{ processed: number; created: number; skipped: number }>(`/api/integrations/sources/gmail/${id}/sync`, { method: 'POST' }),
  disconnectGmailSource: (id: string) => apiRequest<{ id: string }>(`/api/integrations/sources/gmail/${id}`, { method: 'DELETE' }),
}
