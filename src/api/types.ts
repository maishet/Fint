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

export interface CompleteOnboardingResult {
  setupComplete: true
  completedAt: string | null
}

export interface InitializeMeResult {
  created: number
  skipped: boolean
}

export interface SupportReportInput {
  category: string
  description: string
  steps?: string
  diagnostics?: {
    appVersion?: string
    buildNumber?: string
    platform?: string
    environment?: string
    diagnosticId?: string | null
  }
}

export interface DeleteAccountResult {
  deleted: true
}

export interface AppCapabilities {
  features: {
    editablePendingMovements: boolean
    pendingToPayment: boolean
    recurringPayments: boolean
    pushPaymentReminders: boolean
  }
  jobs?: {
    paymentOccurrencesGenerate: boolean
    paymentReminders: boolean
    pushReceipts: boolean
  }
}

export type TransactionType = 'income' | 'expense'

export type MovementKind = TransactionType | 'transfer'

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
  type: MovementKind
  amount: number
  currency: string
  category: string
  account: string
  note?: string
  paymentOccurrenceId?: string | null
  paymentOccurrencePaymentId?: string | null
  transferGroupId?: string | null
  transferDirection?: 'origin' | 'destination' | null
}

export interface Category {
  id: string
  name: string
  type: TransactionType
  icon: string | null
}

// NOTE: 'credit_card' can still appear in `kind` for legacy rules/occurrences created before the
// credit-card payment flow was removed (single-step fixed_payment only). The app no longer lets
// users create, edit, or pay those legacy items — they are shown as read-only history if present.
// TODO: reconsiderar tipos de pago no fijos en el futuro.
export interface PaymentOccurrence {
  id: string
  ruleId: string | null
  title: string
  kind: 'fixed_payment' | 'credit_card'
  dueDate: string | null
  currency: string
  totalAmount: number | null
  minimumAmount: number | null
  paidAmount: number
  remainingAmount: number | null
  amountStatus: 'required' | 'confirmed'
  paymentStatus: 'unpaid' | 'partial' | 'minimum_met' | 'paid'
  temporalStatus: 'upcoming' | 'due_today' | 'overdue'
  cardAccount: string | null
}

export interface PaymentRule {
  id: string
  title: string
  kind: 'fixed_payment' | 'credit_card'
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  currency: string
  fixedAmount: number | null
  categoryId: string | null
  category: string | null
  cardAccountId: string | null
  cardAccount: string | null
  timezone: string
  startDate: string
  nextDueDate: string
  status: 'active' | 'paused' | 'ended'
}

export interface CreatePaymentRuleInput {
  kind: 'fixed_payment'
  title: string
  frequency: PaymentRule['frequency']
  currency: string
  fixedAmount: number
  categoryId: string
  timezone: string
  startDate: string
}

export interface UpdatePaymentRuleInput {
  title?: string
  frequency?: PaymentRule['frequency']
  fixedAmount?: number
  categoryId?: string
  startDate?: string
}

export interface PayPaymentOccurrenceInput {
  amount: number
  accountId: string
  transactionDate: string
  note?: string | null
  originInstallationId?: string | null
}

export interface ReversePaymentOccurrencePaymentInput {
  reason?: string | null
}

export interface AccountOption {
  id: string
  name: string
  currency: string
}

export type TransferAccountMatch = { accountId: string; accountName: string } | null

export interface PendingMovementTransferInfo {
  originAccountName: string | null
  destinationAccountName: string | null
  originMatch: TransferAccountMatch
  destinationMatch: TransferAccountMatch
}

export interface PendingMovementCard {
  id: string
  detectedAt: string
  title: string
  type: TransactionType | null
  amount: number | null
  currency: string | null
  accountSuggestion: AccountOption | null
  requiresReview: boolean
  recognitionConfidence: number | null
  transfer: PendingMovementTransferInfo | null
}

export interface PendingMovementPage {
  items: PendingMovementCard[]
  pageInfo: {
    hasNextPage: boolean
    nextCursor: string | null
  }
}

export interface PendingMovementDetail {
  id: string
  title: string
  type: TransactionType | null
  amount: number | null
  currency: string | null
  transactionDate: string
  accountSuggestion: AccountOption | null
  requiresReview: boolean
  recognitionConfidence: number | null
  transfer: PendingMovementTransferInfo | null
}

export interface PendingMovementsSummary {
  count: number
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

export interface FinancialReportQuery {
  from: string
  to: string
  accountId?: string
  currency?: string
  grouping?: 'week' | 'month'
}

export interface FinancialReportOptions {
  baseCurrency: string
  accounts: Array<{ id: string; name: string; currency: string }>
  currencies: string[]
}

export interface FinancialReportPeriod {
  generatedAt: string
  period: { from: string; to: string; previousFrom: string; previousTo: string; grouping: 'week' | 'month' }
  filters: { accountId: string | null; currency: string }
  summary: FinancialReport['summary']
  highlights: {
    topExpenseCategory: { name: string; icon: string | null; amount: number; percentage: number } | null
    largestTransaction: Omit<ReportTransaction, 'note'> | null
  }
  series: FinancialReport['series']
  categories: FinancialReport['categories']
  accountActivity: FinancialReport['accountActivity']
}

export type FinancialReportPosition = FinancialReport['currentPosition']
export type FinancialTopTransaction = Omit<ReportTransaction, 'note'>

export interface FinancialReport {
  reportType: 'financial_closing'
  version: 1
  generatedAt: string
  period: { from: string; to: string; previousFrom: string; previousTo: string; grouping: 'week' | 'month' }
  filters: {
    accountId: string | null
    currency: string
    availableAccounts: Array<{ id: string; name: string; accountType: string; currency: string }>
    availableCurrencies: string[]
  }
  hasMixedCurrencies: boolean
  summary: {
    income: number
    expenses: number
    net: number
    savingsRate: number | null
    transactionCount: number
    previousIncome: number
    previousExpenses: number
    previousNet: number
    netChangePercentage: number | null
    status: 'healthy' | 'balanced' | 'attention' | 'no_data'
  }
  highlights: {
    topExpenseCategory: { name: string; icon: string | null; amount: number; percentage: number } | null
    largestTransaction: ReportTransaction | null
  }
  series: Array<{ period: string; income: number; expenses: number; net: number; transactionCount: number }>
  categories: Array<{ name: string; icon: string | null; amount: number; percentage: number; previousAmount: number; changePercentage: number | null; transactionCount: number }>
  accountActivity: Array<{ id: string; name: string; accountType: string; income: number; expenses: number; net: number; transactionCount: number }>
  topTransactions: ReportTransaction[]
  currentPosition: {
    asOf: string
    accounts: Array<{ id: string; name: string; accountType: string; balance: number; currency: string }>
    totalAccountBalance: number
    debts: Array<{ id: string; description: string; outstanding: number; originalAmount: number; currency: string; dueDate: string | null; status: string; paidPercentage: number; account: string }>
    totalDebtOutstanding: number
    netPosition: number
  }
}

export interface ReportTransaction {
  id: string
  date: string
  type: TransactionType
  amount: number
  category: string
  account: string
  note: string
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

export interface DashboardOverview {
  currency: string
  netWorth: number
  accountCount: number
  currentMonth: { month: number; year: number; income: number; expenses: number; savings: number }
  previousMonth: { income: number; expenses: number; savings: number }
  weeklyFlow: Array<{ start: string; end: string; income: number; expenses: number }>
  recentTransactions: Transaction[]
}

export interface ExpenseCategoriesOverview {
  currency: string
  selectedAccountId: string | null
  accounts: Array<{ id: string; name: string }>
  categories: Array<{ name: string; icon: string | null; amount: number; percentage: number; transactionCount: number }>
}

export interface AccountsOverview {
  currency: string
  currencies: string[]
  totals: { assets: number; liabilities: number; netWorth: number; count: number }
  items: Account[]
}

export interface TransactionPage {
  summary: {
    totalCount: number
    byCurrency: Array<{ currency: string; income: number; expenses: number; net: number; count: number }>
  }
  items: Transaction[]
  pageInfo: { hasNextPage: boolean; nextCursor: string | null }
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

export type ConfirmPendingInput =
  | {
      mode: 'transaction'
      title: string
      type: TransactionType
      amount: number
      currency?: string
      transactionDate: string
      accountId: string
      categoryId?: string
      note?: string | null
    }
  | {
      mode: 'payment'
      paymentOccurrenceId: string
      title: string
      type: TransactionType
      amount: number
      currency: string
      transactionDate: string
      accountId: string
      categoryId?: string | null
      note?: string | null
      originInstallationId?: string | null
    }

export interface PushInstallationInput {
  expoPushToken: string
  platform: 'android' | 'ios'
  locale: string
  timezone: string
}

export interface ConfirmPendingResult {
  id: string
  transactionId?: string
  status: 'confirmed'
}

export interface DiscardPendingInput {
  reason?: string
}

export interface DiscardPendingResult {
  id: string
  status: 'discarded'
}

export interface CreateTransferInput {
  originAccountId: string
  destinationAccountId: string
  amount: number
  currency: string
  transactionDate: string
  note?: string | null
  pendingMovementId?: string | null
}

export interface TransferResult {
  transferGroupId: string
  originTransactionId: string
  destinationTransactionId: string
}

export interface TransferReverseResult {
  transferGroupId: string
  status: 'voided'
}
