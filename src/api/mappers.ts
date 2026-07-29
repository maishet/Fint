import type { Account, DashboardSummary, Summary, Transaction } from './types'

export function formatMoney(value = 0, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', { currency, currencyDisplay: 'code', style: 'currency' }).format(value)
}

export function normalizeSummary(summary?: Summary): DashboardSummary {
  return {
    currency: summary?.baseCurrency ?? 'PEN',
    netWorth: summary?.accounts?.netWorth ?? 0,
    totalAssets: summary?.accounts?.totalAssets ?? 0,
    totalLiabilities: summary?.accounts?.totalLiabilities ?? 0,
    accountCount: summary?.accounts?.count ?? 0,
    month: summary?.month?.month ?? new Date().getMonth() + 1,
    year: summary?.month?.year ?? new Date().getFullYear(),
    income: summary?.month?.income ?? 0,
    expenses: summary?.month?.expenses ?? 0,
    savings: summary?.month?.savings ?? 0,
    activeDebtCount: summary?.debts?.activeCount ?? 0,
    pendingDebtTotal: summary?.debts?.pendingTotal ?? 0,
  }
}

export function normalizeAccount(account: Account): Account {
  return {
    ...account,
    balance: Number(account.balance) || 0,
    currency: account.currency || 'PEN',
  }
}

export function normalizeTransaction(transaction: Transaction): Transaction {
  return {
    ...transaction,
    amount: Number(transaction.amount) || 0,
    currency: transaction.currency || 'PEN',
    category: transaction.category || 'General',
    account: transaction.account || 'Cuenta',
    note: transaction.note || undefined,
  }
}
