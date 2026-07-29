import { apiRequest } from './client'
import type {
  Account,
  AccountOption,
  AccountMutationResult,
  AccountsOverview,
  Category,
  ConfirmPendingInput,
  ConfirmPendingResult,
  CreateAccountInput,
  CreateAccountResult,
  CreateCategoryInput,
  CreateCategoryResult,
  CreateDebtInput,
  CreateTransactionInput,
  CreateTransactionResult,
  CurrentUser,
  DashboardOverview,
  Debt,
  DiscardPendingInput,
  DiscardPendingResult,
  PayDebtInput,
  PaymentOccurrence,
  PendingMovementDetail,
  PendingMovementPage,
  PendingMovementsSummary,
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
  FinancialReportOptions,
  FinancialReportPeriod,
  FinancialReportPosition,
  FinancialTopTransaction,
  ExpenseCategoriesOverview,
  TransactionPage,
} from './types'

function toQuery(params: { [key: string]: string | number | undefined }) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

function idempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

export const financeApi = {
  getMe: () => apiRequest<CurrentUser>('/api/me'),
  listAccounts: () => apiRequest<Account[]>('/api/accounts'),
  listAccountOptions: (query: { currency?: string; accountType?: string; excludeAccountType?: string } = {}) => apiRequest<AccountOption[]>(`/api/accounts/options${toQuery(query)}`),
  getAccount: (id: string, signal?: AbortSignal) => apiRequest<Account>(`/api/accounts/${id}`, { signal }),
  createAccount: (input: CreateAccountInput) => apiRequest<CreateAccountResult>('/api/accounts', { method: 'POST', body: JSON.stringify(input) }),
  updateAccount: (id: string, input: UpdateAccountInput) => apiRequest<AccountMutationResult>(`/api/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteAccount: (id: string) => apiRequest<AccountMutationResult>(`/api/accounts/${id}`, { method: 'DELETE' }),
  getSummary: () => apiRequest<Summary>('/api/summary'),
  getFinanceOptions: () => apiRequest<{ baseCurrency: string }>('/api/finance/options'),
  getAccountsOverview: (currency?: string, signal?: AbortSignal) => apiRequest<AccountsOverview>(`/api/accounts/overview${toQuery({ currency })}`, { signal }),
  getDashboardOverview: (currency?: string, signal?: AbortSignal) => apiRequest<DashboardOverview>(`/api/dashboard/overview${toQuery({ currency })}`, { signal }),
  getDashboardExpenseCategories: (query: { currency: string; accountId?: string }, signal?: AbortSignal) => apiRequest<ExpenseCategoriesOverview>(`/api/dashboard/expense-categories${toQuery(query)}`, { signal }),
  listTransactions: (query: TransactionQuery = {}) => apiRequest<Transaction[]>(`/api/transactions${toQuery({ ...query })}`),
  getTransactionPage: (query: { from?: string; to?: string; limit?: number; cursor?: string } = {}, signal?: AbortSignal) => apiRequest<TransactionPage>(`/api/transactions/page${toQuery(query)}`, { signal }),
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
  getFinancialReportOptions: (signal?: AbortSignal) => apiRequest<FinancialReportOptions>('/api/reports/financial/options', { signal }),
  getFinancialReportPeriod: (query: FinancialReportQuery, signal?: AbortSignal) => apiRequest<FinancialReportPeriod>(`/api/reports/financial/period${toQuery({ ...query })}`, { signal }),
  getFinancialReportPosition: (query: Pick<FinancialReportQuery, 'accountId' | 'currency'>, signal?: AbortSignal) => apiRequest<FinancialReportPosition>(`/api/reports/financial/position${toQuery({ ...query })}`, { signal }),
  getFinancialTopTransactions: (query: Omit<FinancialReportQuery, 'grouping'> & { limit?: number }, signal?: AbortSignal) => apiRequest<FinancialTopTransaction[]>(`/api/reports/financial/top-transactions${toQuery({ ...query })}`, { signal }),
  getFinancialReportExportData: (query: FinancialReportQuery) => apiRequest<FinancialReport>(`/api/reports/financial/export-data${toQuery({ ...query })}`),
  createTransaction: (input: CreateTransactionInput) => apiRequest<CreateTransactionResult>('/api/transactions', { method: 'POST', body: JSON.stringify(input) }),
  updateTransaction: (id: string, input: UpdateTransactionInput) => apiRequest<{ id: string }>(`/api/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteTransaction: (id: string) => apiRequest<{ id: string }>(`/api/transactions/${id}`, { method: 'DELETE' }),
  listCategories: (type?: TransactionType) => apiRequest<Category[]>(`/api/categories${toQuery({ type })}`),
  createCategory: (input: CreateCategoryInput) => apiRequest<CreateCategoryResult>('/api/categories', { method: 'POST', body: JSON.stringify(input) }),
  listDebts: () => apiRequest<Debt[]>('/api/debts'),
  getDebt: (id: string, signal?: AbortSignal) => apiRequest<Debt>(`/api/debts/${id}`, { signal }),
  createDebt: (input: CreateDebtInput) => apiRequest<{ id: string }>('/api/debts', { method: 'POST', body: JSON.stringify(input) }),
  updateDebt: (id: string, input: UpdateDebtInput) => apiRequest<{ id: string }>(`/api/debts/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteDebt: (id: string) => apiRequest<{ id: string }>(`/api/debts/${id}`, { method: 'DELETE' }),
  payDebt: (id: string, input: PayDebtInput) => apiRequest<{ id: string }>(`/api/debts/${id}/pay`, { method: 'POST', body: JSON.stringify(input) }),
  listPaymentOccurrences: (query: { status?: 'open' | 'paid' | 'overdue' } = {}, signal?: AbortSignal) => apiRequest<PaymentOccurrence[]>(`/api/payment-occurrences${toQuery(query)}`, { signal }),
  getPendingMovementsSummary: () => apiRequest<PendingMovementsSummary>('/api/pending-movements/summary'),
  listPendingMovements: (query: { limit?: number; cursor?: string } = {}, signal?: AbortSignal) => apiRequest<PendingMovementPage>(`/api/pending-movements${toQuery(query)}`, { signal }),
  getPendingMovement: (id: string, signal?: AbortSignal) => apiRequest<PendingMovementDetail>(`/api/pending-movements/${id}`, { signal }),
  confirmPendingMovement: (id: string, input: ConfirmPendingInput) => apiRequest<ConfirmPendingResult>(`/api/pending-movements/${id}/confirm`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey() }, body: JSON.stringify(input) }),
  discardPendingMovement: (id: string, input: DiscardPendingInput = {}) => apiRequest<DiscardPendingResult>(`/api/pending-movements/${id}/discard`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey() }, body: JSON.stringify(input) }),
  startGmailOAuth: () => apiRequest<GmailOAuthStart>('/api/integrations/gmail/oauth/start'),
  listGmailSources: () => apiRequest<GmailSource[]>('/api/integrations/sources/gmail'),
  updateGmailSource: (id: string, input: GmailSourceConfigInput) => apiRequest<{ id: string; labelIds: string[]; senderFilters: string[] }>(`/api/integrations/sources/gmail/${id}/config`, { method: 'PUT', body: JSON.stringify(input) }),
  syncGmailSource: (id: string) => apiRequest<{ processed: number; created: number; skipped: number }>(`/api/integrations/sources/gmail/${id}/sync`, { method: 'POST' }),
  disconnectGmailSource: (id: string) => apiRequest<{ id: string }>(`/api/integrations/sources/gmail/${id}`, { method: 'DELETE' }),
}
