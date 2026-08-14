import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { backupFileName, buildBackupXlsx, type BackupData, type BackupExportLabels } from './backup-document'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const XLSX_UTI = 'org.openxmlformats.spreadsheetml.sheet'

export async function exportBackupXlsx(
  data: BackupData,
  labels: BackupExportLabels,
  dialogTitle: string,
  dateIso: string,
) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device')
  const bytes = buildBackupXlsx(data, labels)
  const file = new File(Paths.cache, backupFileName(dateIso))
  file.create({ overwrite: true })
  file.write(bytes)
  await Sharing.shareAsync(file.uri, { mimeType: XLSX_MIME, dialogTitle, UTI: XLSX_UTI })
}
