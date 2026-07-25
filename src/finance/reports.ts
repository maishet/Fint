import type { Account, Debt, Transaction, TransactionType } from '../api/types'

export type ReportPeriodPreset = 'currentMonth' | 'previousMonth' | 'last3Months' | 'last6Months'
export type ReportGrouping = 'week' | 'month'

export interface ReportFilters {
  from: string
  to: string
  account?: string
  currency?: string
  type?: TransactionType | 'all'
  grouping?: ReportGrouping
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
  categories: Array<{ category: string; amount: number; percentage: number; previousAmount: number; change: number | null }>
  accounts: Array<{ id: string; name: string; type: string; balance: number; currency: string; percentage: number }>
  debts: Array<{ id: string; description: string; outstanding: number; originalAmount: number; currency: string; dueDate: string | null; status: string; paidPercentage: number }>
  generatedAt: string
  hasMixedCurrencies: boolean
}

export function getPresetRange(preset: ReportPeriodPreset, today = new Date()) {
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  if (preset === 'previousMonth') return toRange(new Date(today.getFullYear(), today.getMonth() - 1, 1), monthStart)
  if (preset === 'last3Months') return toRange(new Date(today.getFullYear(), today.getMonth() - 2, 1), new Date(today.getFullYear(), today.getMonth() + 1, 1))
  if (preset === 'last6Months') return toRange(new Date(today.getFullYear(), today.getMonth() - 5, 1), new Date(today.getFullYear(), today.getMonth() + 1, 1))
  return toRange(monthStart, new Date(today.getFullYear(), today.getMonth() + 1, 1))
}

export function buildFinancialReport(input: { transactions: Transaction[]; previousTransactions?: Transaction[]; accounts: Account[]; debts: Debt[]; filters: ReportFilters; now?: Date }): FinancialReport {
  const currency = input.filters.currency ?? input.transactions[0]?.currency ?? input.accounts[0]?.currency ?? input.debts[0]?.currency ?? 'PEN'
  const filtered = filterTransactions(input.transactions, input.filters, currency)
  const previous = filterTransactions(input.previousTransactions ?? [], { ...input.filters, account: input.filters.account }, currency)
  const income = roundMoney(sumByType(filtered, 'income'))
  const expenses = roundMoney(sumByType(filtered, 'expense'))
  const previousSavings = sumByType(previous, 'income') - sumByType(previous, 'expense')
  const savings = roundMoney(income - expenses)
  const categoryTotal = expenses
  const accountBalances = input.accounts.filter((account) => !input.filters.account || account.id === input.filters.account || account.name === input.filters.account)
  const accountTotal = accountBalances.reduce((sum, account) => sum + Math.abs(account.balance), 0)
  const currencies = new Set([...input.transactions.map((item) => item.currency), ...input.accounts.map((item) => item.currency), ...input.debts.map((item) => item.currency)])

  return {
    from: input.filters.from,
    to: input.filters.to,
    currency,
    income,
    expenses,
    savings,
    savingsRate: income > 0 ? Math.round((savings / income) * 1000) / 10 : null,
    previousPeriodChange: previousSavings === 0 ? null : Math.round(((savings - previousSavings) / Math.abs(previousSavings)) * 100),
    series: buildSeries(filtered, input.filters.grouping ?? 'week'),
    categories: buildCategories(filtered, previous, categoryTotal),
    accounts: accountBalances.map((account) => ({ id: account.id, name: account.name, type: account.accountType, balance: account.balance, currency: account.currency, percentage: accountTotal > 0 ? Math.round((Math.abs(account.balance) / accountTotal) * 1000) / 10 : 0 })),
    debts: input.debts.map((debt) => ({ id: debt.id, description: debt.description, outstanding: debt.outstanding, originalAmount: debt.originalAmount, currency: debt.currency, dueDate: debt.dueDate ?? null, status: debt.status, paidPercentage: debt.originalAmount > 0 ? Math.min(100, Math.round(((debt.originalAmount - debt.outstanding) / debt.originalAmount) * 100)) : 0 })),
    generatedAt: (input.now ?? new Date()).toISOString(),
    hasMixedCurrencies: currencies.size > 1,
  }
}

export function getPreviousRange(from: string, to: string) {
  const start = parseDate(from)
  const end = parseDate(to)
  const durationMs = end.getTime() - start.getTime()
  return { from: toIsoDate(new Date(start.getTime() - durationMs)), to: from }
}

function filterTransactions(transactions: Transaction[], filters: ReportFilters, currency: string) {
  const from = parseDate(filters.from)
  const to = parseDate(filters.to)
  return transactions.filter((transaction) => {
    const date = parseDate(transaction.date)
    if (date < from || date >= to) return false
    if (transaction.currency !== currency) return false
    if (filters.account && transaction.account !== filters.account) return false
    if (filters.type && filters.type !== 'all' && transaction.type !== filters.type) return false
    return true
  })
}

function buildSeries(transactions: Transaction[], grouping: ReportGrouping) {
  const totals = new Map<string, { period: string; income: number; expenses: number }>()
  for (const transaction of transactions) {
    const period = grouping === 'month' ? transaction.date.slice(0, 7) : getWeekKey(parseDate(transaction.date))
    const current = totals.get(period) ?? { period, income: 0, expenses: 0 }
    if (transaction.type === 'income') current.income += transaction.amount
    else current.expenses += transaction.amount
    totals.set(period, current)
  }
  return [...totals.values()].sort((a, b) => a.period.localeCompare(b.period)).map((item) => ({ ...item, income: roundMoney(item.income), expenses: roundMoney(item.expenses) }))
}

function buildCategories(transactions: Transaction[], previousTransactions: Transaction[], total: number) {
  const current = totalsByCategory(transactions)
  const previous = totalsByCategory(previousTransactions)
  return [...current.entries()].sort((a, b) => b[1] - a[1]).map(([category, amount]) => {
    const previousAmount = previous.get(category) ?? 0
    return { category: category || 'Sin categoria', amount: roundMoney(amount), percentage: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0, previousAmount: roundMoney(previousAmount), change: previousAmount > 0 ? Math.round(((amount - previousAmount) / previousAmount) * 100) : null }
  })
}

function totalsByCategory(transactions: Transaction[]) {
  const totals = new Map<string, number>()
  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue
    totals.set(transaction.category || 'Sin categoria', (totals.get(transaction.category || 'Sin categoria') ?? 0) + transaction.amount)
  }
  return totals
}

function sumByType(transactions: Transaction[], type: TransactionType) {
  return transactions.filter((transaction) => transaction.type === type).reduce((sum, transaction) => sum + transaction.amount, 0)
}

function getWeekKey(date: Date) {
  const weekStart = new Date(date)
  weekStart.setDate(date.getDate() - date.getDay())
  return toIsoDate(weekStart)
}

function toRange(from: Date, to: Date) {
  return { from: toIsoDate(from), to: toIsoDate(to) }
}

function parseDate(value: string) {
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid report date: ${value}`)
  return date
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}
