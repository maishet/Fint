import { expect, test } from 'bun:test'
import * as XLSX from 'xlsx'
import type { FinancialReport } from '../../src/api/types'
import { buildReportHtml, buildReportXlsx, type ReportExportLabels } from '../../src/finance/report-document'

const report: FinancialReport = {
  reportType: 'financial_closing', version: 1, generatedAt: '2026-07-25T10:00:00Z',
  period: { from: '2026-07-01', to: '2026-08-01', previousFrom: '2026-05-31', previousTo: '2026-07-01', grouping: 'week' },
  filters: { accountId: null, currency: 'PEN', availableAccounts: [{ id: 'a1', name: 'Principal', accountType: 'cash', currency: 'PEN' }], availableCurrencies: ['PEN'] },
  hasMixedCurrencies: false,
  summary: { income: 1000, expenses: 300, net: 700, savingsRate: 70, transactionCount: 3, previousIncome: 800, previousExpenses: 250, previousNet: 550, netChangePercentage: 27, status: 'healthy' },
  highlights: { topExpenseCategory: { name: 'Comida & hogar', icon: '🍽️', amount: 300, percentage: 100 }, largestTransaction: { id: 't1', date: '2026-07-02', type: 'income', amount: 1000, category: 'Sueldo', account: 'Principal', note: '' } },
  series: [{ period: '2026-07-01', income: 1000, expenses: 300, net: 700, transactionCount: 3 }],
  categories: [{ name: 'Comida & hogar', icon: '🍽️', amount: 300, percentage: 100, previousAmount: 250, changePercentage: 20, transactionCount: 2 }],
  accountActivity: [{ id: 'a1', name: 'Principal', accountType: 'cash', income: 1000, expenses: 300, net: 700, transactionCount: 3 }],
  topTransactions: [{ id: 't1', date: '2026-07-02', type: 'income', amount: 1000, category: '=Sueldo <mensual>', account: 'Principal', note: '' }],
  currentPosition: { asOf: '2026-07-25T10:00:00Z', accounts: [{ id: 'a1', name: 'Principal', accountType: 'cash', balance: 1700, currency: 'PEN' }], totalAccountBalance: 1700, debts: [{ id: 'd1', description: 'Préstamo', outstanding: 250, originalAmount: 1000, currency: 'PEN', dueDate: '2026-08-10', status: 'active', paidPercentage: 75, account: 'Principal' }], totalDebtOutstanding: 250, netPosition: 1450 },
}

const labels: ReportExportLabels = {
  title: 'Cierre financiero', closing: 'Reporte de cierre', generated: 'Generado', period: 'Periodo', executiveSummary: 'Resumen ejecutivo', financialStatus: 'Estado financiero', income: 'Ingresos', expenses: 'Gastos', net: 'Resultado neto', savingsRate: 'Tasa de ahorro', transactions: 'Movimientos', previousPeriod: 'Periodo anterior', flow: 'Evolución', categories: 'Categorías', accountActivity: 'Actividad por cuenta', currentPosition: 'Posición actual', accounts: 'Cuentas', debts: 'Deudas', topTransactions: 'Movimientos destacados', category: 'Categoría', account: 'Cuenta', date: 'Fecha', type: 'Tipo', amount: 'Monto', balance: 'Saldo', outstanding: 'Pendiente', dueDate: 'Vencimiento', progress: 'Pagado', noData: 'Sin datos', currentSnapshotNote: 'Saldos actuales.', statuses: { healthy: 'Saludable', balanced: 'Equilibrio', attention: 'Atención', no_data: 'Sin actividad' }, statusMessages: { healthy: 'Buen resultado.', balanced: 'Resultado equilibrado.', attention: 'Revisar gastos.', no_data: 'Sin datos.' }, accountTypes: { cash: 'Efectivo' }, incomeType: 'Ingreso', expenseType: 'Gasto',
}

test('builds a structured, escaped four-page closing report', () => {
  const html = buildReportHtml(report, { labels, locale: 'es-PE' })
  expect(html.match(/<section class="page/g)?.length).toBe(4)
  expect(html).toContain('Estado financiero')
  expect(html).toContain('Actividad por cuenta')
  expect(html).toContain('Posición actual')
  expect(html).toContain('=Sueldo &lt;mensual&gt;')
  expect(html).not.toContain('=Sueldo <mensual>')
})

test('builds a real XLSX workbook with numeric amounts and safe text cells', () => {
  const bytes = buildReportXlsx(report, { labels, locale: 'es-PE' })
  const workbook = XLSX.read(bytes, { type: 'array' })
  expect(workbook.SheetNames).toEqual(['Resumen', 'Flujo', 'Categorías', 'Cuentas', 'Movimientos', 'Pagos'])
  expect(workbook.Sheets.Resumen?.B6?.v).toBe(1000)
  expect(workbook.Sheets.Categorías?.A2?.v).toContain('Comida & hogar')
  expect(workbook.Sheets.Movimientos?.C2?.v).toBe("'=Sueldo <mensual>")
})
