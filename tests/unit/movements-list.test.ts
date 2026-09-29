import { describe, expect, test } from 'bun:test'
import type { Transaction } from '../../src/api/types'
import { buildEntries, filterByCurrency, filterItems, groupTransfers, monthCurrencies, netByCurrency, recentMonths, stickyIndices } from '../../src/movements/logic'

const tx = (id: string, date: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id, date, type: 'expense', amount, currency: 'PEN', category: 'Alimentación', account: 'BCP', ...extra,
})

const origin = tx('o', '2026-09-17', 800, { type: 'transfer', transferGroupId: 'g1', transferDirection: 'origin', account: 'BCP' })
const destination = tx('d', '2026-09-17', 800, { type: 'transfer', transferGroupId: 'g1', transferDirection: 'destination', account: 'Interbank' })

describe('groupTransfers', () => {
  test('junta las dos patas de una transferencia en una fila', () => {
    const items = groupTransfers([tx('a', '2026-09-18', 10), origin, destination, tx('b', '2026-09-17', 5)])
    expect(items.map((i) => i.kind)).toEqual(['movement', 'transfer', 'movement'])
    const transfer = items[1]
    expect(transfer.kind === 'transfer' && transfer.origin.account).toBe('BCP')
  })

  test('una pata suelta queda como movimiento', () => {
    expect(groupTransfers([origin]).map((i) => i.kind)).toEqual(['movement'])
  })
})

test('filterItems por tipo', () => {
  const items = groupTransfers([tx('a', '2026-09-18', 10), tx('i', '2026-09-18', 50, { type: 'income' }), origin, destination])
  expect(filterItems(items, 'all')).toHaveLength(3)
  expect(filterItems(items, 'expense')).toHaveLength(1)
  expect(filterItems(items, 'income')).toHaveLength(1)
  expect(filterItems(items, 'transfer')).toHaveLength(1)
})

test('netByCurrency: sin mezclar monedas y sin contar transferencias', () => {
  const items = groupTransfers([
    tx('a', '2026-09-18', 84.5),
    tx('b', '2026-09-18', 23.9),
    tx('i', '2026-09-18', 100, { type: 'income' }),
    tx('u', '2026-09-18', 10, { currency: 'USD' }),
    origin,
    destination,
  ])
  const net = netByCurrency(items)
  expect(net.get('PEN')).toBe(-8.4)
  expect(net.get('USD')).toBe(-10)
  expect(net.size).toBe(2)
})

describe('buildEntries', () => {
  const items = groupTransfers([
    tx('a', '2026-09-18', 84.5),
    tx('b', '2026-09-18T13:42:00Z', 23.9),
    origin,
    destination,
    tx('c', '2026-09-17', 18.6),
    tx('u', '2026-09-16', 5, { currency: 'USD' }),
  ])
  const entries = buildEntries(items, 'PEN')

  test('un encabezado por día, con primera y última fila marcadas', () => {
    expect(entries.map((e) => (e.type === 'day' ? e.day : e.key))).toEqual([
      '2026-09-18', 'a', 'b', '2026-09-17', 't-g1', 'c', '2026-09-16', 'u',
    ])
    const rows = entries.filter((e) => e.type === 'row')
    expect(rows.map((r) => r.type === 'row' && [r.first, r.last])).toEqual([
      [true, false], [false, true], [true, false], [false, true], [true, true],
    ])
  })

  test('neto del día en la moneda elegida, o en la del día si no la tiene', () => {
    const days = entries.filter((e) => e.type === 'day')
    expect(days.map((d) => d.type === 'day' && d.net)).toEqual([
      { currency: 'PEN', value: -108.4 },
      { currency: 'PEN', value: -18.6 },
      { currency: 'USD', value: -5 },
    ])
  })

  test('stickyIndices apunta a los encabezados', () => {
    expect(stickyIndices(entries)).toEqual([0, 3, 6])
  })
})

describe('moneda', () => {
  const usd = tx('u', '2026-09-18', 15, { currency: 'USD', category: 'Suscripciones' })
  const fxOrigin = tx('fo', '2026-09-16', 100, { type: 'transfer', transferGroupId: 'g2', transferDirection: 'origin', currency: 'USD' })
  const fxDestination = tx('fd', '2026-09-16', 370, { type: 'transfer', transferGroupId: 'g2', transferDirection: 'destination', currency: 'PEN' })
  const items = groupTransfers([tx('a', '2026-09-18', 10), usd, origin, destination, fxOrigin, fxDestination])

  test('filterByCurrency deja solo las filas de esa moneda', () => {
    expect(filterByCurrency(items, 'USD').map((i) => (i.kind === 'transfer' ? i.transferGroupId : i.movement.id))).toEqual(['u', 'g2'])
    expect(filterByCurrency(items, 'PEN').map((i) => (i.kind === 'transfer' ? i.transferGroupId : i.movement.id))).toEqual(['a', 'g1', 'g2'])
  })

  test('monthCurrencies une las del resumen y las de la lista, sin repetir', () => {
    expect(monthCurrencies(['PEN'], items)).toEqual(['PEN', 'USD'])
    expect(monthCurrencies([], [])).toEqual([])
  })
})

test('recentMonths: los últimos 6 meses, del más antiguo al actual, cruzando el año', () => {
  const months = recentMonths(new Date(2026, 1, 20))
  expect(months.map((d) => `${d.getFullYear()}-${d.getMonth() + 1}`)).toEqual(['2025-9', '2025-10', '2025-11', '2025-12', '2026-1', '2026-2'])
  expect(months.every((d) => d.getDate() === 1)).toBe(true)
})
