export interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: string
  message?: string
}

export interface ApiErrorPayload {
  ok?: false
  error?: string
  message?: string
}

export interface CurrentUser {
  userId: string
  email?: string
  status: 'active' | string
  setupComplete: boolean
  gmailEnabled: boolean
  voiceEnabled: boolean
}

export type TransactionType = 'income' | 'expense'

export type AccountType = 'cash' | 'credit_card' | 'checking_account' | 'savings_account'

export interface Account {
  id: string
  name: string
  accountType: AccountType | string
  currency: string
  balance: number
}

export interface Transaction {
  id: string
  date: string
  type: TransactionType
  amount: number
  currency: string
  category: string
  account: string
  note?: string
  debtId?: string | null
}

export interface Category {
  id: string
  name: string
  type: TransactionType
  icon: string | null
}

export interface Debt {
  id: string
  description: string
  originalAmount: number
  outstanding: number
  currency: string
  dueDate?: string | null
  accountId: string | null
  account: string | null
  note?: string
  status: 'active' | 'paid' | 'overdue' | string
}

export interface PendingMovement {
  id: string
  detectedAt: string
  source: string
  account: string | null
  type: TransactionType
  amount: number
  currency: string
  description: string | null
  reference: string | null
  status: string
  confidence: number | null
  transactionId: string | null
  observation: string | null
}

export interface GmailSource {
  id: string
  emailAddress: string
  labelIds: string[]
  senderFilters: string[]
  status: string
  watchExpiresAt?: string | null
  lastSyncAt?: string | null
}

export interface GmailOAuthStart {
  authUrl: string
  expiresInSeconds: number
}

export interface GmailSourceConfigInput {
  labelIds: string[]
  senderFilters: string[]
}

export interface Summary {
  userId: string
  baseCurrency: string
  accounts: {
    totalAssets: number
    totalLiabilities: number
    netWorth: number
    count: number
  }
  month: {
    month: number
    year: number
    income: number
    expenses: number
    savings: number
  }
  debts: {
    activeCount: number
    pendingTotal: number
  }
}

export interface FinancialReport {
  from: string
  to: string
  currency: string
  income: number
  expenses: number
  savings: number
  savingsRate: number | null
  previousPeriodChange: number | null
  series: Array<{ period: string; income: number; expenses: number }>
  categories: Array<{ category: string; amount: number; percentage: number }>
}

export interface DashboardSummary {
  currency: string
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  accountCount: number
  month: number
  year: number
  income: number
  expenses: number
  savings: number
  activeDebtCount: number
  pendingDebtTotal: number
}

export interface CreateAccountInput {
  name: string
  accountType: AccountType
  currency: string
  openingBalance: number
}

export interface CreateAccountResult {
  id: string
  name: string
  created: boolean
}

export interface UpdateAccountInput {
  name?: string
  accountType?: AccountType
  currency?: string
}

export interface AccountMutationResult {
  id: string
}

export interface CreateCategoryInput {
  name: string
  type: TransactionType
  icon?: string
}

export interface CreateCategoryResult {
  name: string
  type: TransactionType
  icon: string | null
  created: boolean
}

export interface CreateTransactionInput {
  type: TransactionType
  amount: number
  currency: string
  category: string
  account: string
  note?: string
  transactionDate?: string
}

export interface CreateTransactionResult {
  id: string
}

export interface UpdateTransactionInput extends CreateTransactionInput {
  transactionDate: string
}

export interface TransactionQuery {
  from?: string
  to?: string
  accountId?: string
  account?: string
  type?: TransactionType | 'all'
  limit?: number
  offset?: number
}

export interface PayDebtInput {
  amount: number
  currency: string
  account: string
  note?: string
}

export interface CreateDebtInput {
  description: string
  amount: number
  currency: string
  dueDate: string
  accountId?: string | null
  note?: string
}

export interface UpdateDebtInput {
  description?: string
  amount?: number
  dueDate?: string
  accountId?: string | null
  note?: string | null
}

export interface ConfirmPendingInput {
  category: string
  note?: string
}

export interface DiscardPendingInput {
  reason?: string
}
