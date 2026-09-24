import { describe, expect, test } from 'bun:test'
import type { PaymentOccurrence, Transaction } from '../../src/api/types'
import { buildAttention } from '../../src/home/attention'
import { buildSpendingSeries, cumulative, distinctCategoryColors, spendingRange, topCategories } from '../../src/home/spending'

const now = new Date(2026, 8, 18, 13, 0) // 18 de setiembre de 2026

const tx = (date: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `${date}-${amount}`, date, type: 'expense', amount, currency: 'PEN', category: 'Alimentación', account: 'BCP Soles', ...extra,
})

describe('buildSpendingSeries', () => {
  const series = buildSpendingSeries(
    [
      tx('2026-09-01', 10),
      tx('2026-09-18', 5.5),
      tx('2026-09-19', 999), // mañana: no cuenta
      tx('2026-08-10', 20),
      tx('2026-08-25', 30), // después del día 18: no entra en previousToDate
      tx('2026-09-02', 100, { type: 'transfer' }),
      tx('2026-09-02', 7, { type: 'income' }),
      tx('2026-09-03', 50, { currency: 'USD' }),
      tx('2026-09-04', 8, { account: 'Interbank' }),
    ],
    { currency: 'PEN', now },
  )

  test('cuenta solo egresos en la moneda del resumen, hasta hoy', () => {
    expect(series.today).toBe(18)
    expect(series.daysInMonth).toBe(30)
    expect(series.currentDaily).toHaveLength(18)
    expect(series.current).toBe(23.5)
  })

  test('compara contra el mismo día del mes anterior', () => {
    expect(series.previousDaily).toHaveLength(31)
    expect(series.previousToDate).toBe(20)
    expect(series.hasPrevious).toBe(true)
  })

  test('filtra por cuenta cuando se desliza el saldo', () => {
    expect(buildSpendingSeries([tx('2026-09-04', 8, { account: 'Interbank' }), tx('2026-09-04', 3)], { currency: 'PEN', account: 'Interbank', now }).current).toBe(8)
  })

  test('el rango pide desde el día 1 del mes anterior hasta mañana (el `to` de la API es exclusivo)', () => {
    expect(spendingRange(now)).toEqual({ from: '2026-08-01', to: '2026-09-19' })
    expect(spendingRange(new Date(2026, 0, 5))).toEqual({ from: '2025-12-01', to: '2026-01-06' })
    expect(spendingRange(new Date(2026, 8, 30))).toEqual({ from: '2026-08-01', to: '2026-10-01' })
    expect(spendingRange(new Date(2026, 11, 31))).toEqual({ from: '2026-11-01', to: '2027-01-01' })
  })

  test('cumulative acumula sin errores de redondeo', () => {
    expect(cumulative([0.1, 0.2, 0.3])).toEqual([0.1, 0.3, 0.6])
  })
})

describe('topCategories', () => {
  test('cuatro categorías y el resto en Otros, sumando 100', () => {
    const rows = topCategories(
      [
        { name: 'A', amount: 333 }, { name: 'B', amount: 333 }, { name: 'C', amount: 111 },
        { name: 'D', amount: 111 }, { name: 'E', amount: 56 }, { name: 'F', amount: 56 },
      ],
      'Otros',
    )
    expect(rows.map((r) => r.name)).toEqual(['A', 'B', 'C', 'D', 'Otros'])
    expect(rows.reduce((a, r) => a + r.percentage, 0)).toBe(100)
    expect(rows[4].color).toBe(6)
    expect(new Set(rows.map((r) => r.color)).size).toBe(5)
  })

  test('una categoría que se llama "Otros" se suma al grupo Otros', () => {
    const rows = topCategories(
      [{ name: 'A', amount: 50 }, { name: 'Otros', amount: 10 }, { name: 'B', amount: 5 }, { name: 'C', amount: 5 }, { name: 'D', amount: 5 }, { name: 'E', amount: 5 }],
      'Otros',
    )
    expect(rows.filter((r) => r.name === 'Otros')).toHaveLength(1)
    expect(rows.find((r) => r.isOther)?.amount).toBe(15)
    expect(rows.reduce((a, r) => a + r.percentage, 0)).toBe(100)
  })

  test('lo que el endpoint no lista (solo manda seis) va a Otros para cuadrar con lo gastado', () => {
    const rows = topCategories(
      [{ name: 'A', amount: 275 }, { name: 'B', amount: 240 }, { name: 'C', amount: 128.4 }, { name: 'D', amount: 116.8 }, { name: 'E', amount: 40 }, { name: 'F', amount: 21.8 }],
      'Otros',
      { spent: 836.25 },
    )
    expect(rows.find((r) => r.isOther)?.amount).toBe(76.05)
    expect(Math.round(rows.reduce((a, r) => a + r.amount, 0) * 100) / 100).toBe(836.25)
    expect(rows.reduce((a, r) => a + r.percentage, 0)).toBe(100)
  })

  test('si ya cuadra (o sobra), no inventa un Otros', () => {
    const rows = topCategories([{ name: 'A', amount: 60 }, { name: 'B', amount: 40 }], 'Otros', { spent: 100 })
    expect(rows.some((r) => r.isOther)).toBe(false)
    expect(topCategories([{ name: 'A', amount: 60 }], 'Otros', { spent: 50 }).some((r) => r.isOther)).toBe(false)
  })

  test('sin gastos devuelve una lista vacía', () => {
    expect(topCategories([], 'Otros')).toEqual([])
  })

  test('los colores no se repiten dentro de una lista', () => {
    const colors = distinctCategoryColors(['a', 'b', 'c', 'd', 'e'])
    expect(new Set(colors).size).toBe(5)
  })
})

describe('buildAttention', () => {
  const occ = (id: string, dueDate: string, extra: Partial<PaymentOccurrence> = {}): PaymentOccurrence => ({
    id, ruleId: null, title: id, kind: 'fixed_payment', dueDate, currency: 'PEN', totalAmount: 100, minimumAmount: null,
    paidAmount: 0, remainingAmount: 100, amountStatus: 'confirmed', paymentStatus: 'unpaid', temporalStatus: 'upcoming',
    cardAccount: null, autoPayEnabled: false, paidAt: null, paidAccount: null, ...extra,
  })

  test('ordena vencido, hoy, pronto y por revisar al final', () => {
    const items = buildAttention(
      [
        occ('pronto', '2026-09-20'),
        occ('lejos', '2026-10-30'),
        occ('hoy', '2026-09-18', { temporalStatus: 'due_today' }),
        occ('vencido', '2026-09-10', { temporalStatus: 'overdue' }),
        occ('auto', '2026-09-19', { autoPayEnabled: true }),
        occ('pagado', '2026-09-19', { paymentStatus: 'paid' }),
      ],
      2,
      now,
    )
    expect(items.map((i) => i.kind)).toEqual(['overdue', 'due_today', 'due_soon', 'review'])
    expect(items[3].count).toBe(2)
  })
})
