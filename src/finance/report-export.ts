import { File, Paths } from 'expo-file-system'
import * as IntentLauncher from 'expo-intent-launcher'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'
import type { FinancialReport } from '../api/types'
import { countPdfPages } from '../reports/logic'
import { buildReportHtml, buildReportXlsx, reportFileName, type ReportExportOptions } from './report-document'

export type { ReportExportLabels, ReportExportOptions } from './report-document'

export type ReportFormat = 'pdf' | 'xlsx'

/** El archivo del reporte ya creado, para mostrarlo en "Listo" y compartirlo o abrirlo. */
export interface ReportFile {
  uri: string
  name: string
  format: ReportFormat
  /** En bytes. */
  size: number
  /** Solo en el PDF. */
  pages?: number
}

const MIME: Record<ReportFormat, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
const UTI: Record<ReportFormat, string> = { pdf: 'com.adobe.pdf', xlsx: 'org.openxmlformats.spreadsheetml.sheet' }

/** Lo que se armó en la etapa 2 (el HTML del PDF o el libro de Excel), para crear el archivo en la 3. */
export type ReportDraft = { format: 'pdf'; html: string } | { format: 'xlsx'; workbook: Uint8Array }

/** Deja pintar la pantalla antes de un paso síncrono y pesado (armar el HTML o el libro). */
const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 16))

/** Etapa 2: dibujar los gráficos y armar el PDF (HTML), o agrupar por categoría y armar el libro. */
export async function draftReport(report: FinancialReport, format: ReportFormat, options: ReportExportOptions): Promise<ReportDraft> {
  await nextFrame()
  return format === 'pdf'
    ? { format, html: buildReportHtml(report, options) }
    : { format, workbook: buildReportXlsx(report, options) }
}

/** Nombre del archivo sin caracteres que un sistema de archivos rechace. */
function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim()
}

/** Etapa 3: crear el archivo en la caché. `baseName` es el nombre sin extensión ("My Fint · Setiembre 2026"). */
export async function writeReportFile(report: FinancialReport, draft: ReportDraft, baseName?: string): Promise<ReportFile> {
  await nextFrame()
  const name = baseName ? `${safeFileName(baseName)}.${draft.format}` : reportFileName(report, draft.format)
  const target = new File(Paths.cache, name)
  if (draft.format === 'pdf') {
    const { uri } = await Print.printToFileAsync({ html: draft.html, base64: false })
    const source = new File(uri)
    if (target.exists) target.delete()
    source.move(target)
    // Las páginas se cuentan en el archivo: el `numberOfPages` de `printToFileAsync` no coincide en Android.
    return { uri: target.uri, name, format: 'pdf', size: target.size, pages: countPdfPages(await target.bytes()) }
  }
  target.create({ overwrite: true })
  target.write(draft.workbook)
  return { uri: target.uri, name, format: 'xlsx', size: target.size }
}

/** Borra un archivo a medio hacer o ya descartado. */
export function discardReportFile(file: ReportFile | null) {
  if (!file) return
  try {
    const f = new File(file.uri)
    if (f.exists) f.delete()
  } catch {
    // Está en la caché: si no se puede borrar, el sistema lo limpia.
  }
}

/** "Compartir": la hoja del sistema (Guardar en archivos, WhatsApp, correo). */
export async function shareReportFile(file: ReportFile, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device')
  await Sharing.shareAsync(file.uri, { mimeType: MIME[file.format], dialogTitle, UTI: UTI[file.format] })
}

/**
 * "Ver": abre el archivo en el visor del sistema. En Android, con un `content://` y permiso de lectura; si no hay app
 * para ese tipo, lanza. En iOS, la hoja de compartir ya muestra la vista previa.
 */
export async function openReportFile(file: ReportFile, dialogTitle: string) {
  if (Platform.OS !== 'android') return shareReportFile(file, dialogTitle)
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: new File(file.uri).contentUri,
    type: MIME[file.format],
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  })
}
