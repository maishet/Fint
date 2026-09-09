import { getCurrencySymbol } from '../finance/currencies'
import { getAppLocale } from '../i18n'
import type { Account, DashboardSummary, Summary, Transaction } from './types'

export function formatMoney(value = 0, currency = 'PEN', locale = getAppLocale()) {
  const amount = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  return `${getCurrencySymbol(currency)} ${amount}`
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
  const currency = account.currency || 'PEN'
  const balance = Number(account.balance) || 0
  // Si el backend aún no manda líneas por moneda, se deriva una desde el saldo
  // legacy: la UI ya lee `balances` y no habrá que tocarla cuando lleguen N.
  const balances = Array.isArray(account.balances) && account.balances.length > 0
    ? account.balances.map((line) => ({
        currency: line.currency || currency,
        balance: Number(line.balance) || 0,
      }))
    : [{ currency, balance }]
  return { ...account, balance, currency, balances }
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
