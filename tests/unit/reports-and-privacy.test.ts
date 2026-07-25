import { expect, test } from 'bun:test'
import { buildFinancialReport, getPresetRange, getPreviousRange } from '../../src/finance/reports'
import { buildSupportMailto, setLastRequestId } from '../../src/support/diagnostics'
import { validateAnalyticsEvent } from '../../src/analytics/privacy'
import type { Account, Debt, Transaction } from '../../src/api/types'

const accounts: Account[] = [
  { id: 'account-1', name: 'Principal', accountType: 'cash', currency: 'PEN', balance: 700 },
]

const debts: Debt[] = [
  { id: 'debt-1', description: 'Prestamo', originalAmount: 1000, outstanding: 250, currency: 'PEN', dueDate: '2026-08-10', accountId: null, account: null, status: 'active' },
]

const transactions: Transaction[] = [
  { id: 'tx-1', date: '2026-07-02', type: 'income', amount: 1000, currency: 'PEN', category: 'salary', account: 'Principal' },
  { id: 'tx-2', date: '2026-07-04', type: 'expense', amount: 200, currency: 'PEN', category: 'food', account: 'Principal' },
  { id: 'tx-3', date: '2026-07-05', type: 'expense', amount: 100, currency: 'PEN', category: 'food', account: 'Principal' },
  { id: 'tx-4', date: '2026-07-06', type: 'expense', amount: 75, currency: 'USD', category: 'travel', account: 'Principal' },
]

test('builds financial report totals by date range, type and currency', () => {
  const report = buildFinancialReport({ transactions, accounts, debts, filters: { from: '2026-07-01', to: '2026-08-01', currency: 'PEN' }, now: new Date('2026-07-25T10:00:00Z') })
  expect(report.income).toBe(1000)
  expect(report.expenses).toBe(300)
  expect(report.savings).toBe(700)
  expect(report.savingsRate).toBe(70)
  expect(report.categories[0]).toMatchObject({ category: 'food', amount: 300, percentage: 100 })
  expect(report.debts[0].paidPercentage).toBe(75)
  expect(report.hasMixedCurrencies).toBe(true)
})

test('uses an equivalent previous range for comparisons', () => {
  expect(getPresetRange('currentMonth', new Date('2026-07-25T12:00:00')).from).toBe('2026-07-01')
  expect(getPreviousRange('2026-07-01', '2026-08-01')).toEqual({ from: '2026-05-31', to: '2026-07-01' })
})

test('rejects undeclared or sensitive analytics properties', () => {
  expect(() => validateAnalyticsEvent('transaction_created', { type: 'income' })).not.toThrow()
  expect(() => validateAnalyticsEvent('transaction_created', { amount: 100 } as never)).toThrow('prohibited')
  expect(() => validateAnalyticsEvent('support_report_submitted', { category: 'Gmail', email: 'user@example.com' } as never)).toThrow('prohibited')
})

test('support mailto includes safe diagnostics only with consent', () => {
  setLastRequestId('req_123')
  const url = buildSupportMailto({ category: 'Cuentas y saldos', description: 'No carga', includeDiagnostics: true })
  const decoded = decodeURIComponent(url)
  expect(decoded).toContain('ID de diagnostico: req_123')
  expect(decoded).toContain('No adjuntes tokens')
  expect(decoded).not.toContain('Authorization')
})
