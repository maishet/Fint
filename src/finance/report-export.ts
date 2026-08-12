import { File, Paths } from 'expo-file-system'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import type { FinancialReport } from '../api/types'
import { buildReportHtml, buildReportXlsx, reportFileName, type ReportExportOptions } from './report-document'

export type { ReportExportLabels } from './report-document'

export async function exportFinancialReportXlsx(report: FinancialReport, options: ReportExportOptions) {
  const fileName = reportFileName(report, 'xlsx')
  const workbook = buildReportXlsx(report, options)
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device')
  const file = new File(Paths.cache, fileName)
  file.create({ overwrite: true })
  file.write(workbook)
  await Sharing.shareAsync(file.uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: options.labels.title, UTI: 'org.openxmlformats.spreadsheetml.sheet' })
}

export async function exportFinancialReportPdf(report: FinancialReport, options: ReportExportOptions) {
  const html = buildReportHtml(report, options)
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device')
  const { uri } = await Print.printToFileAsync({ html, base64: false })
  const source = new File(uri)
  const target = new File(Paths.cache, reportFileName(report, 'pdf'))
  if (target.exists) target.delete()
  source.copy(target)
  await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', dialogTitle: options.labels.title, UTI: 'com.adobe.pdf' })
}
