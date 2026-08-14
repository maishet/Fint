import type { ImportTransactionItem, TransactionType } from '../api/types'

export type ImportField = 'transactionDate' | 'type' | 'amount' | 'currency' | 'category' | 'account' | 'note'

export const IMPORT_FIELDS: ImportField[] = ['transactionDate', 'type', 'amount', 'currency', 'category', 'account', 'note']
export const REQUIRED_IMPORT_FIELDS: ImportField[] = ['transactionDate', 'amount', 'category', 'account']

/** field → índice de columna (o ausente si no está mapeado). */
export type ColumnMapping = Partial<Record<ImportField, number>>

const HEADER_HINTS: Record<ImportField, string[]> = {
  transactionDate: ['date', 'fecha', 'data', 'dia'],
  type: ['type', 'tipo'],
  amount: ['amount', 'monto', 'valor', 'importe', 'total'],
  currency: ['currency', 'moneda', 'moeda', 'divisa'],
  category: ['category', 'categoria', 'rubro'],
  account: ['account', 'cuenta', 'conta'],
  note: ['note', 'nota', 'descripcion', 'description', 'observacao', 'observacion', 'detalle', 'concepto'],
}

const INCOME_HINTS = ['income', 'ingreso', 'receita', 'entrada', 'credit', 'credito', 'abono', 'deposito', 'haber']

export function detectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  headers.forEach((header, index) => {
    const norm = normalize(header)
    if (!norm) return
    for (const field of IMPORT_FIELDS) {
      if (mapping[field] === undefined && HEADER_HINTS[field].some((hint) => norm.includes(hint))) {
        mapping[field] = index
      }
    }
  })
  return mapping
}

export interface ParseResult {
  items: ImportTransactionItem[]
  invalid: number
}

export function buildImportItems(rows: string[][], mapping: ColumnMapping, fallbackCurrency: string): ParseResult {
  const items: ImportTransactionItem[] = []
  let invalid = 0
  for (const row of rows) {
    if (row.every((cell) => !cell || !cell.trim())) continue // fila vacía: se ignora
    const item = buildItem(row, mapping, fallbackCurrency)
    if (item) items.push(item)
    else invalid++
  }
  return { items, invalid }
}

function buildItem(row: string[], mapping: ColumnMapping, fallbackCurrency: string): ImportTransactionItem | null {
  const date = normalizeDate(cell(row, mapping.transactionDate))
  const amount = normalizeAmount(cell(row, mapping.amount))
  const category = (cell(row, mapping.category) ?? '').trim()
  const account = (cell(row, mapping.account) ?? '').trim()
  if (!date || amount === null || amount <= 0 || !category || !account) return null
  const currency = normalizeCurrency(cell(row, mapping.currency)) ?? fallbackCurrency
  const note = (cell(row, mapping.note) ?? '').trim()
  return {
    transactionDate: date,
    type: normalizeType(cell(row, mapping.type)),
    amount,
    currency,
    category,
    account,
    ...(note ? { note } : {}),
  }
}

function cell(row: string[], index: number | undefined) {
  return index === undefined ? undefined : row[index]
}

export function normalizeType(value: string | undefined): TransactionType {
  const norm = normalize(value ?? '')
  return INCOME_HINTS.some((hint) => norm.includes(hint)) ? 'income' : 'expense'
}

export function normalizeAmount(value: string | undefined): number | null {
  if (value === undefined) return null
  let text = String(value).trim().replace(/[^\d.,-]/g, '')
  if (!text) return null
  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  if (lastComma !== -1 && lastDot !== -1) {
    // El separador decimal es el que aparece más a la derecha; el otro son miles.
    const decimal = lastComma > lastDot ? ',' : '.'
    const thousands = decimal === ',' ? '.' : ','
    text = text.split(thousands).join('').replace(decimal, '.')
  } else if (lastComma !== -1) {
    text = text.replace(',', '.')
  }
  const parsed = Number(text)
  return Number.isFinite(parsed) ? Math.abs(parsed) : null
}

export function normalizeDate(value: string | undefined): string | null {
  if (!value) return null
  const text = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  // DD/MM/YYYY o DD-MM-YYYY (formato común en LATAM/EU).
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (match) {
    const day = Number(match[1])
    const month = Number(match[2])
    let year = Number(match[3])
    if (year < 100) year += 2000
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad(month)}-${pad(day)}`
    }
  }
  return null
}

function normalizeCurrency(value: string | undefined): string | null {
  if (!value) return null
  const text = String(value).trim().toUpperCase()
  return /^[A-Z]{3}$/.test(text) ? text : null
}

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

function normalize(value: string): string {
  return value.normalize('NFD').replace(DIACRITICS, '').toLowerCase().trim()
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
