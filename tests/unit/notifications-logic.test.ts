import { describe, expect, test } from 'bun:test'
import type { PaymentOccurrence, UserNotification } from '../../src/api/types'
import { buildAttention } from '../../src/home/attention'
import { bellState, feedGroups, feedTime, namesSummary } from '../../src/notifications/logic'

// Lunes 28 de setiembre de 2026, 11:00.
const now = new Date(2026, 8, 28, 11)

const gmail = (id: string, createdAt: Date): UserNotification => ({ id, kind: 'gmail_imported', data: { count: 1, titles: ['Tambo+'] }, createdAt: createdAt.toISOString(), readAt: null, link: '/pending-movements' })

describe('feed de Avisos', () => {
  test('agrupa en Hoy, Esta semana y Antes, sin grupos vacíos', () => {
    const groups = feedGroups([gmail('a', new Date(2026, 8, 28, 9)), gmail('b', new Date(2026, 8, 22, 20)), gmail('c', new Date(2026, 8, 21, 20))], now)
    expect(groups.map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([['today', ['a']], ['week', ['b']], ['earlier', ['c']]])
    expect(feedGroups([gmail('b', new Date(2026, 8, 25))], now).map((g) => g.key)).toEqual(['week'])
  })

  test('la hora: hoy en 24 h, esta semana el día corto en minúscula, antes la fecha', () => {
    expect(feedTime(new Date(2026, 8, 28, 10, 24).toISOString(), now, 'es-PE')).toBe('10:24')
    expect(feedTime(new Date(2026, 8, 27, 18).toISOString(), now, 'es-PE')).toBe('dom')
    expect(feedTime(new Date(2026, 8, 16, 18).toISOString(), now, 'es-PE')).toBe('16 set')
    expect(feedTime(new Date(2026, 8, 27, 18).toISOString(), now, 'en-US')).toBe('Sun')
  })

  test('hasta dos nombres y cuántos quedan', () => {
    expect(namesSummary(['Tambo+', 'Uber', 'Rappi'], 5)).toEqual({ shown: ['Tambo+', 'Uber'], rest: 3 })
    expect(namesSummary(['Tambo+'], 1)).toEqual({ shown: ['Tambo+'], rest: 0 })
  })

  test('la campana cuenta solo lo por hacer; sin nada, un punto si hay sin leer', () => {
    expect(bellState(2, 5)).toEqual({ count: 2, dot: false })
    expect(bellState(0, 1)).toEqual({ count: 0, dot: true })
    expect(bellState(0, 0)).toEqual({ count: 0, dot: false })
  })
})

describe('"Recordar el día que vence" en Por hacer', () => {
  const occurrence = (over: Partial<PaymentOccurrence>): PaymentOccurrence => ({
    id: 'o1', ruleId: null, title: 'Luz del Sur', kind: 'fixed_payment', dueDate: '2026-10-01', currency: 'PEN', totalAmount: 132.4, minimumAmount: null,
    paidAmount: 0, remainingAmount: 132.4, amountStatus: 'confirmed', paymentStatus: 'unpaid', temporalStatus: 'upcoming', cardAccount: null,
    autoPayEnabled: false, paidAt: null, paidAccount: null, ...over,
  })

  test('pospuesto sale de Por hacer hasta el día que vence y ese día vuelve', () => {
    expect(buildAttention([occurrence({})], 0, now)).toHaveLength(1)
    expect(buildAttention([occurrence({ reminderSnoozedUntil: '2026-10-01' })], 0, now)).toHaveLength(0)
    expect(buildAttention([occurrence({ reminderSnoozedUntil: '2026-10-01' })], 0, new Date(2026, 9, 1, 9))[0]?.kind).toBe('due_today')
  })
})
