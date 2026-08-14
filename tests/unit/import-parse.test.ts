import { expect, test } from 'bun:test'
import { buildImportItems, detectMapping, normalizeAmount, normalizeDate, normalizeType } from '../../src/finance/import-parse'

test('detects column mapping from localized headers', () => {
  const mapping = detectMapping(['Fecha', 'Tipo', 'Monto', 'Categoría', 'Cuenta', 'Nota'])
  expect(mapping).toEqual({ transactionDate: 0, type: 1, amount: 2, category: 3, account: 4, note: 5 })
})

test('normalizes amounts with thousands and decimal separators', () => {
  expect(normalizeAmount('1.234,56')).toBe(1234.56)
  expect(normalizeAmount('1,234.56')).toBe(1234.56)
  expect(normalizeAmount('S/ 84.20')).toBe(84.2)
  expect(normalizeAmount('-50')).toBe(50)
  expect(normalizeAmount('')).toBeNull()
})

test('normalizes ISO and DD/MM/YYYY dates, rejecting invalid ones', () => {
  expect(normalizeDate('2026-08-01')).toBe('2026-08-01')
  expect(normalizeDate('2026-08-01T10:00:00Z')).toBe('2026-08-01')
  expect(normalizeDate('01/08/2026')).toBe('2026-08-01')
  expect(normalizeDate('1/8/26')).toBe('2026-08-01')
  expect(normalizeDate('not a date')).toBeNull()
})

test('infers income vs expense from the type cell, defaulting to expense', () => {
  expect(normalizeType('Ingreso')).toBe('income')
  expect(normalizeType('income')).toBe('income')
  expect(normalizeType('Gasto')).toBe('expense')
  expect(normalizeType(undefined)).toBe('expense')
})

test('builds valid items, counts invalid rows, and skips blanks', () => {
  const mapping = { transactionDate: 0, type: 1, amount: 2, category: 3, account: 4, note: 5 }
  const rows = [
    ['2026-08-01', 'Gasto', '84.20', 'Comida', 'Efectivo', 'Mercado'],
    ['2026-08-02', 'Ingreso', '3000', 'Sueldo', 'Efectivo', ''],
    ['', '', '', '', '', ''], // vacía → ignorada
    ['2026-08-03', 'Gasto', '10', '', 'Efectivo', ''], // sin categoría → inválida
  ]
  const { items, invalid } = buildImportItems(rows, mapping, 'PEN')
  expect(invalid).toBe(1)
  expect(items).toHaveLength(2)
  expect(items[0]).toEqual({ transactionDate: '2026-08-01', type: 'expense', amount: 84.2, currency: 'PEN', category: 'Comida', account: 'Efectivo', note: 'Mercado' })
  expect(items[1]).toMatchObject({ type: 'income', amount: 3000, currency: 'PEN' })
  expect(items[1]).not.toHaveProperty('note')
})

test('falls back to the given currency when no currency column is mapped', () => {
  const { items } = buildImportItems([['2026-08-01', 'Gasto', '10', 'Comida', 'Efectivo', '']], { transactionDate: 0, type: 1, amount: 2, category: 3, account: 4, note: 5 }, 'USD')
  expect(items[0]?.currency).toBe('USD')
})
