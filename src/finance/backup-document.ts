import * as XLSX from 'xlsx'
import type { Account, Category, Transaction } from '../api/types'

export interface BackupExportLabels {
  sheets: { accounts: string; categories: string; movements: string }
  columns: {
    name: string
    type: string
    currency: string
    balance: string
    icon: string
    date: string
    category: string
    account: string
    amount: string
    note: string
  }
  types: { income: string; expense: string; transfer: string }
  accountTypes: Record<string, string>
}

export interface BackupData {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
}

export function buildBackupXlsx(data: BackupData, labels: BackupExportLabels) {
  const workbook = buildBackupWorkbook(data, labels)
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Uint8Array(output)
}

export function buildBackupWorkbook(
  { accounts, categories, transactions }: BackupData,
  { accountTypes, columns, sheets, types }: BackupExportLabels,
) {
  const workbook = XLSX.utils.book_new()

  addSheet(workbook, sheets.accounts, [
    [columns.name, columns.type, columns.currency, columns.balance],
    ...accounts.map((account) => [
      account.name,
      accountTypes[account.accountType] ?? account.accountType,
      account.currency,
      account.balance,
    ]),
  ])

  addSheet(workbook, sheets.categories, [
    [columns.name, columns.type, columns.icon],
    ...categories.map((category) => [category.name, types[category.type], category.icon ?? '']),
  ])

  addSheet(workbook, sheets.movements, [
    [columns.date, columns.type, columns.category, columns.account, columns.amount, columns.currency, columns.note],
    ...transactions.map((transaction) => [
      transaction.date,
      types[transaction.type] ?? transaction.type,
      transaction.category,
      transaction.account,
      transaction.amount,
      transaction.currency,
      transaction.note ?? '',
    ]),
  ])

  return workbook
}

export function backupFileName(dateIso: string) {
  return `fint-backup-${dateIso.slice(0, 10)}.xlsx`
}

function addSheet(workbook: XLSX.WorkBook, name: string, rows: Array<Array<string | number | null | undefined>>) {
  const sheet = XLSX.utils.aoa_to_sheet(rows.map((row) => row.map(xlsxCell)))
  XLSX.utils.book_append_sheet(workbook, sheet, name)
}

// Evita la inyección de fórmulas (CSV/XLSX injection): un valor de texto que
// empieza con = + - @ se prefija con comilla simple para tratarse como literal.
function xlsxCell(value: string | number | null | undefined) {
  if (typeof value !== 'string') return value ?? null
  return /^[=+\-@]/.test(value) ? `'${value}` : value
}
