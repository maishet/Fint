import { File, Paths } from 'expo-file-system'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'
import type { FinancialReport } from './reports'

export async function exportFinancialReportCsv(report: FinancialReport) {
  const fileName = `fint-reporte-${report.from}-${report.to}.csv`
  const csv = buildReportCsv(report)

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
    return
  }

  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device')
  const file = new File(Paths.cache, fileName)
  file.create({ overwrite: true })
  file.write(`\uFEFF${csv}`)
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Exportar reporte de Fint', UTI: 'public.comma-separated-values-text' })
}

export async function exportFinancialReportPdf(report: FinancialReport, labels: { title: string; period: string; income: string; expenses: string; savings: string; savingsRate: string; flow: string; categories: string; accounts: string; debts: string }) {
  const html = buildReportHtml(report, labels)
  if (Platform.OS === 'web') {
    await Print.printAsync({ html })
    return
  }

  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device')
  const { uri } = await Print.printToFileAsync({ html, base64: false })
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: labels.title, UTI: 'com.adobe.pdf' })
}

export function buildReportCsv(report: FinancialReport) {
  const rows: Array<Array<string | number | null>> = [
    ['Reporte financiero Fint'],
    ['Desde', report.from],
    ['Hasta', report.to],
    ['Moneda', report.currency],
    ['Ingresos', report.income],
    ['Gastos', report.expenses],
    ['Ahorro neto', report.savings],
    ['Tasa de ahorro', report.savingsRate],
    [],
    ['Flujo por periodo'],
    ['Periodo', 'Ingresos', 'Gastos'],
    ...report.series.map((item) => [item.period, item.income, item.expenses]),
    [],
    ['Gastos por categoria'],
    ['Categoria', 'Monto', 'Porcentaje', 'Variacion vs anterior'],
    ...report.categories.map((item) => [item.category, item.amount, item.percentage, item.change]),
    [],
    ['Cuentas'],
    ['Cuenta', 'Tipo', 'Balance', 'Moneda', 'Participacion'],
    ...report.accounts.map((item) => [item.name, item.type, item.balance, item.currency, item.percentage]),
    [],
    ['Deudas'],
    ['Deuda', 'Pendiente', 'Original', 'Moneda', 'Estado', 'Pagado'],
    ...report.debts.map((item) => [item.description, item.outstanding, item.originalAmount, item.currency, item.status, item.paidPercentage]),
  ]

  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function buildReportHtml(report: FinancialReport, labels: { title: string; period: string; income: string; expenses: string; savings: string; savingsRate: string; flow: string; categories: string; accounts: string; debts: string }) {
  const money = (value: number, currency = report.currency) => `${escapeHtml(currency)} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const rows = (values: string[][]) => values.map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 28px; } body { color: #0f2a38; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 12px; }
    .hero { background: #0f5d73; border-radius: 16px; color: white; padding: 22px; } .hero h1 { margin: 0 0 6px; font-size: 24px; } .hero p { color: #c7e5ed; margin: 0; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; } .metric { border: 1px solid #d7e6f0; border-radius: 12px; padding: 12px; } .metric small { color: #5c7885; display: block; margin-bottom: 5px; } .metric strong { font-size: 16px; }
    h2 { border-bottom: 2px solid #d7e6f0; font-size: 16px; margin: 22px 0 8px; padding-bottom: 6px; } table { border-collapse: collapse; width: 100%; } th { background: #eef7fa; text-align: left; } th, td { border-bottom: 1px solid #e4eef3; padding: 7px 6px; } .right { text-align: right; }
    .footer { color: #78909a; font-size: 10px; margin-top: 24px; text-align: center; }
  </style></head><body>
    <section class="hero"><h1>${escapeHtml(labels.title)}</h1><p>${escapeHtml(labels.period)}: ${escapeHtml(report.from)} - ${escapeHtml(report.to)} · ${escapeHtml(report.currency)}</p></section>
    <section class="metrics"><div class="metric"><small>${escapeHtml(labels.income)}</small><strong>${money(report.income)}</strong></div><div class="metric"><small>${escapeHtml(labels.expenses)}</small><strong>${money(report.expenses)}</strong></div><div class="metric"><small>${escapeHtml(labels.savings)}</small><strong>${money(report.savings)}</strong></div><div class="metric"><small>${escapeHtml(labels.savingsRate)}</small><strong>${report.savingsRate === null ? '-' : `${report.savingsRate}%`}</strong></div></section>
    <h2>${escapeHtml(labels.flow)}</h2><table><thead><tr><th>${escapeHtml(labels.period)}</th><th class="right">${escapeHtml(labels.income)}</th><th class="right">${escapeHtml(labels.expenses)}</th></tr></thead><tbody>${rows(report.series.map((item) => [escapeHtml(item.period), money(item.income), money(item.expenses)]))}</tbody></table>
    <h2>${escapeHtml(labels.categories)}</h2><table><thead><tr><th>${escapeHtml(labels.categories)}</th><th class="right">%</th><th class="right">${escapeHtml(report.currency)}</th></tr></thead><tbody>${rows(report.categories.map((item) => [escapeHtml(item.category), `${item.percentage}%`, money(item.amount)]))}</tbody></table>
    <h2>${escapeHtml(labels.accounts)}</h2><table><tbody>${rows(report.accounts.map((item) => [escapeHtml(item.name), escapeHtml(item.type), money(item.balance, item.currency)]))}</tbody></table>
    <h2>${escapeHtml(labels.debts)}</h2><table><tbody>${rows(report.debts.map((item) => [escapeHtml(item.description), `${item.paidPercentage}%`, money(item.outstanding, item.currency)]))}</tbody></table>
    <p class="footer">Fint · ${escapeHtml(new Date(report.generatedAt).toLocaleString())}</p>
  </body></html>`
}

function csvCell(value: string | number | null) {
  if (value === null) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character)
}
