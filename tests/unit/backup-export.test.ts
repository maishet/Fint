import { expect, test } from 'bun:test'
import * as XLSX from 'xlsx'
import type { Account, Category, Transaction } from '../../src/api/types'
import { backupFileName, buildBackupXlsx, type BackupExportLabels } from '../../src/finance/backup-document'

const accounts: Account[] = [
  { id: 'a1', name: 'Efectivo', accountType: 'cash', currency: 'PEN', balance: 1250.5 },
]

const categories: Category[] = [
  { id: 'c1', name: 'Comida', type: 'expense', icon: '🍽️' },
  { id: 'c2', name: 'Sueldo', type: 'income', icon: null },
]

const transactions: Transaction[] = [
  { id: 't1', date: '2026-08-01', type: 'expense', amount: 84.2, currency: 'PEN', category: '=Comida', account: 'Efectivo', note: '' },
  { id: 't2', date: '2026-08-02', type: 'income', amount: 3000, currency: 'PEN', category: 'Sueldo', account: 'Efectivo', note: 'Mensual' },
]

const labels: BackupExportLabels = {
  sheets: { accounts: 'Cuentas', categories: 'Categorías', movements: 'Movimientos' },
  columns: { name: 'Nombre', type: 'Tipo', currency: 'Moneda', balance: 'Saldo', icon: 'Icono', date: 'Fecha', category: 'Categoría', account: 'Cuenta', amount: 'Monto', note: 'Nota' },
  types: { income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia' },
  accountTypes: { cash: 'Efectivo' },
}

test('builds a three-sheet backup workbook with numeric amounts', () => {
  const bytes = buildBackupXlsx({ accounts, categories, transactions }, labels)
  const workbook = XLSX.read(bytes, { type: 'array' })
  expect(workbook.SheetNames).toEqual(['Cuentas', 'Categorías', 'Movimientos'])
  expect(workbook.Sheets.Cuentas?.D2?.v).toBe(1250.5)
  expect(workbook.Sheets.Movimientos?.E2?.v).toBe(84.2)
  expect(workbook.Sheets.Movimientos?.E3?.v).toBe(3000)
})

test('escapes formula-like category cells to prevent CSV injection', () => {
  const bytes = buildBackupXlsx({ accounts, categories, transactions }, labels)
  const workbook = XLSX.read(bytes, { type: 'array' })
  expect(workbook.Sheets.Movimientos?.C2?.v).toBe("'=Comida")
})

test('names the backup file with the given date', () => {
  expect(backupFileName('2026-08-14T10:00:00Z')).toBe('fint-backup-2026-08-14.xlsx')
})
