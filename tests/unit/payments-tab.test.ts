import { describe, expect, test } from 'bun:test'
import type { PaymentOccurrence } from '../../src/api/types'
import { buildPendingItems, dueText, groupHistory, groupPending, leadOccurrence, monthSummaries, partialProgress } from '../../src/payments/logic'

const occ = (id: string, dueDate: string | null, extra: Partial<PaymentOccurrence> = {}): PaymentOccurrence => ({
  id, ruleId: `r-${id}`, title: id, kind: 'fixed_payment', dueDate, currency: 'PEN', totalAmount: 100, minimumAmount: null,
  paidAmount: 0, remainingAmount: 100, amountStatus: 'confirmed', paymentStatus: 'unpaid', temporalStatus: 'upcoming',
  cardAccount: null, autoPayEnabled: false, paidAt: null, paidAccount: null, ...extra,
})

// Jueves 24 de setiembre de 2026: la semana termina el domingo 27.
const today = new Date(2026, 8, 24, 10)

describe('buildPendingItems', () => {
  test('junta los períodos de una regla, el más antiguo primero, y ordena por vencimiento', () => {
    const items = buildPendingItems([
      occ('b', '2026-09-30'),
      occ('a2', '2026-09-05', { ruleId: 'r-a' }),
      occ('a1', '2026-08-05', { ruleId: 'r-a' }),
      occ('x', null, { ruleId: null }),
    ])
    expect(items.map((i) => leadOccurrence(i).id)).toEqual(['a1', 'b', 'x'])
    expect(items[0].kind === 'group' && items[0].periods.map((p) => p.id)).toEqual(['a1', 'a2'])
  })
})

describe('groupPending', () => {
  test('Vencido, Esta semana (hasta el domingo) y Más adelante; sin grupos vacíos', () => {
    const items = buildPendingItems([occ('late', '2026-09-21'), occ('today', '2026-09-24'), occ('sun', '2026-09-27'), occ('mon', '2026-09-28'), occ('nodate', null)])
    const groups = groupPending(items, today)
    expect(groups.map((g) => [g.key, g.items.map((i) => leadOccurrence(i).id)])).toEqual([
      ['overdue', ['late']],
      ['week', ['today', 'sun']],
      ['later', ['mon', 'nodate']],
    ])
    expect(groupPending(buildPendingItems([occ('mon', '2026-09-28')]), today).map((g) => g.key)).toEqual(['later'])
  })

  test('el domingo, Esta semana es solo hoy', () => {
    const sunday = new Date(2026, 8, 27)
    expect(groupPending(buildPendingItems([occ('sun', '2026-09-27'), occ('mon', '2026-09-28')]), sunday).map((g) => g.key)).toEqual(['week', 'later'])
  })
})

test('dueText', () => {
  expect(dueText('2026-09-21', today)).toEqual({ kind: 'overdue', days: 3 })
  expect(dueText('2026-09-24', today).kind).toBe('today')
  expect(dueText('2026-09-25', today).kind).toBe('tomorrow')
  expect(dueText('2026-09-26', today).kind).toBe('weekday')
  expect(dueText('2026-10-05', today).kind).toBe('date')
  expect(dueText(null, today).kind).toBe('none')
})

test('partialProgress solo con pago parcial', () => {
  expect(partialProgress(occ('g', '2026-09-28', { paidAmount: 30, remainingAmount: 30 }))).toBe(0.5)
  expect(partialProgress(occ('n', '2026-09-28'))).toBeNull()
})

describe('monthSummaries', () => {
  test('falta, pagado y total del mes por moneda, con atrasos y parciales; sin mezclar monedas', () => {
    const open = [
      occ('late', '2026-08-20', { remainingAmount: 50, totalAmount: 50 }),
      occ('gym', '2026-09-28', { paidAmount: 30, remainingAmount: 30, totalAmount: 60 }),
      occ('oct', '2026-10-05', { remainingAmount: 210 }),
      occ('usd', '2026-09-26', { currency: 'USD', remainingAmount: 12.99, totalAmount: 12.99 }),
    ]
    const paid = [
      occ('rent', '2026-09-01', { paymentStatus: 'paid', paidAmount: 800, remainingAmount: 0, totalAmount: 800, paidAt: '2026-09-01' }),
      occ('aug-paid-now', '2026-08-30', { paymentStatus: 'paid', paidAmount: 40, remainingAmount: 0, totalAmount: 40, paidAt: '2026-09-02' }),
      occ('old', '2026-08-10', { paymentStatus: 'paid', paidAmount: 99, remainingAmount: 0, totalAmount: 99, paidAt: '2026-08-10' }),
    ]
    expect(monthSummaries(open, paid, today)).toEqual([
      { currency: 'PEN', remaining: 80, paid: 870, total: 950 },
      { currency: 'USD', remaining: 12.99, paid: 0, total: 12.99 },
    ])
  })
})

test('groupHistory por mes de pago, del más reciente al más antiguo', () => {
  const groups = groupHistory([
    occ('a', '2026-08-01', { paidAt: '2026-08-02' }),
    occ('b', '2026-09-01', { paidAt: '2026-09-03' }),
    occ('c', '2026-09-10', { paidAt: '2026-09-11' }),
  ])
  expect(groups.map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([
    ['2026-8', ['c', 'b']],
    ['2026-7', ['a']],
  ])
})
