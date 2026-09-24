import { describe, expect, test } from 'bun:test'
import type { Transaction } from '../../src/api/types'
import { categoryRows, changePercent, dailyFlow, fillSeries, isCurrentPeriod, periodRange, periodStart, shiftPeriod } from '../../src/reports/logic'

// Jueves 24 de setiembre de 2026.
const today = new Date(2026, 8, 24, 15)

describe('periodos', () => {
  test('el primer día de cada periodo; la semana empieza el lunes', () => {
    expect(periodRange('week', periodStart('week', today))).toEqual({ from: '2026-09-21', to: '2026-09-28' })
    expect(periodRange('month', periodStart('month', today))).toEqual({ from: '2026-09-01', to: '2026-10-01' })
    expect(periodRange('year', periodStart('year', today))).toEqual({ from: '2026-01-01', to: '2027-01-01' })
    // Domingo: sigue siendo la semana del lunes anterior.
    expect(periodRange('week', periodStart('week', new Date(2026, 8, 27)))).toEqual({ from: '2026-09-21', to: '2026-09-28' })
  })

  test('moverse entre periodos, cruzando meses y años', () => {
    expect(periodRange('week', shiftPeriod('week', periodStart('week', today), -4))).toEqual({ from: '2026-08-24', to: '2026-08-31' })
    expect(periodRange('month', shiftPeriod('month', new Date(2026, 0, 1), -1))).toEqual({ from: '2025-12-01', to: '2026-01-01' })
    expect(isCurrentPeriod('month', periodStart('month', today), today)).toBe(true)
    expect(isCurrentPeriod('month', new Date(2026, 7, 1), today)).toBe(false)
  })
})

test('changePercent: "nueva" (null) cuando antes era cero; 0 si no cambió', () => {
  expect(changePercent(110, 100)).toBe(10)
  expect(changePercent(88.6, 100)).toBe(-11.4)
  expect(changePercent(50, 0)).toBeNull()
  expect(changePercent(0, 0)).toBe(0)
})

test('dailyFlow: siete días, solo la moneda elegida, sin transferencias', () => {
  const tx = (date: string, type: Transaction['type'], amount: number, currency = 'PEN'): Transaction => ({
    id: `${date}-${type}-${amount}`, date, type, amount, currency, category: 'X', account: 'A',
  })
  const days = dailyFlow(
    [tx('2026-09-21', 'income', 100), tx('2026-09-21T15:00:00Z', 'expense', 30.5), tx('2026-09-22', 'expense', 12, 'USD'), tx('2026-09-23', 'transfer', 500), tx('2026-09-28', 'expense', 9)],
    new Date(2026, 8, 21),
    'PEN',
  )
  expect(days).toHaveLength(7)
  expect(days[0]).toEqual({ start: '2026-09-21', income: 100, expenses: 30.5 })
  expect(days.slice(1).every((d) => d.income === 0 && d.expenses === 0)).toBe(true)
  expect(days[6].start).toBe('2026-09-27')
})

describe('categoryRows', () => {
  const cat = (name: string, amount: number, percentage: number, previousAmount = amount, changePercentage: number | null = 0) => ({
    name, label: name, amount, percentage, previousAmount, changePercentage,
  })

  test('hasta seis, todas, con el porcentaje del servidor y colores sin repetir', () => {
    const rows = categoryRows([cat('A', 10, 10), cat('B', 50, 50), cat('C', 20, 20), cat('D', 8, 8), cat('E', 7, 7), cat('F', 5, 5)], 'Otros')
    expect(rows.map((r) => r.label)).toEqual(['B', 'C', 'A', 'D', 'E', 'F'])
    expect(rows.map((r) => r.percentage)).toEqual([50, 20, 10, 8, 7, 5])
    expect(new Set(rows.map((r) => r.color)).size).toBe(6)
  })

  test('de la séptima en adelante, "Otros" con chart-6 y su variación sumada', () => {
    const rows = categoryRows(
      [cat('A', 40, 40), cat('B', 20, 20), cat('C', 15, 15), cat('D', 10, 10), cat('E', 5, 5), cat('F', 6, 6, 3, 100), cat('G', 4, 4, 0, null)],
      'Otros',
    )
    expect(rows).toHaveLength(6)
    expect(rows[5]).toEqual({ key: null, label: 'Otros', amount: 9, percentage: 9, change: 80, color: 6 })
  })
})

describe('fillSeries', () => {
  test('un mes: semanas desde el lunes, las vacías en cero, hasta la de hoy', () => {
    const cols = fillSeries('month', new Date(2026, 8, 1), [{ period: '2026-08-31', income: 100, expenses: 5 }, { period: '2026-09-14', income: 0, expenses: 9 }], today)
    expect(cols.map((c) => c.start)).toEqual(['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21'])
    expect(cols[1]).toEqual({ start: '2026-09-07', income: 0, expenses: 0 })
  })

  test('un mes pasado llega a su última semana; un año, a sus doce meses (o hasta el actual)', () => {
    expect(fillSeries('month', new Date(2026, 7, 1), [], today).map((c) => c.start)).toEqual(['2026-07-27', '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31'])
    expect(fillSeries('year', new Date(2025, 0, 1), [], today)).toHaveLength(12)
    expect(fillSeries('year', new Date(2026, 0, 1), [{ period: '2026-09-01', income: 1, expenses: 2 }], today).map((c) => c.start).at(-1)).toBe('2026-09-01')
  })

  test('si el backend agrupa con otro inicio de semana, se usa su serie', () => {
    expect(fillSeries('month', new Date(2026, 8, 1), [{ period: '2026-09-01', income: 1, expenses: 0 }], today).map((c) => c.start)).toEqual(['2026-09-01'])
  })
})
