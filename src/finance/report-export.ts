import { File, Paths } from 'expo-file-system'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'
import type { FinancialReport } from '../api/types'
import { buildReportCsv, buildReportHtml, reportFileName, type ReportExportOptions } from './report-document'

export type { ReportExportLabels } from './report-document'

export async function exportFinancialReportCsv(report: FinancialReport, options: ReportExportOptions) {
  const fileName = reportFileName(report, 'csv')
  const csv = buildReportCsv(report, options)
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
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: options.labels.title, UTI: 'public.comma-separated-values-text' })
}

export async function exportFinancialReportPdf(report: FinancialReport, options: ReportExportOptions) {
  const html = buildReportHtml(report, options)
  if (Platform.OS === 'web') {
    await Print.printAsync({ html })
    return
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device')
  const { uri } = await Print.printToFileAsync({ html, base64: false })
  const source = new File(uri)
  const target = new File(Paths.cache, reportFileName(report, 'pdf'))
  if (target.exists) target.delete()
  source.copy(target)
  await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', dialogTitle: options.labels.title, UTI: 'com.adobe.pdf' })
}
