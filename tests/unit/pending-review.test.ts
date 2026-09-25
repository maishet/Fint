import { expect, test } from 'bun:test'
import type { PaymentOccurrence, PendingMovementCard } from '../../src/api/types'
import {
  canConfirmFromList,
  compatibleOccurrences,
  detectedWhen,
  isMatchedTransfer,
  matchingOccurrence,
} from '../../src/pending/logic'

const card = (over: Partial<PendingMovementCard> = {}): PendingMovementCard => ({
  id: 'p', detectedAt: '2026-09-24T14:12:00.000Z', transactionDate: '2026-09-24', title: 'Uber', type: 'expense', amount: 23.9, currency: 'PEN',
  accountSuggestion: { id: 'a', name: 'BCP', currency: 'PEN' } as PendingMovementCard['accountSuggestion'],
  requiresReview: false, recognitionConfidence: null, transfer: null, ...over,
})
const occ = (id: string, remaining: number, dueDate: string, over: Partial<PaymentOccurrence> = {}): PaymentOccurrence => ({
  id, ruleId: 'r', title: id, kind: 'fixed_payment', dueDate, currency: 'PEN', totalAmount: remaining, minimumAmount: null, paidAmount: 0,
  remainingAmount: remaining, amountStatus: 'confirmed', paymentStatus: 'unpaid', temporalStatus: 'upcoming', cardAccount: null,
  autoPayEnabled: false, paidAt: null, paidAccount: null, ...over,
})

test('canConfirmFromList y isMatchedTransfer', () => {
  expect(canConfirmFromList(card())).toBe(true)
  expect(canConfirmFromList(card({ accountSuggestion: null }))).toBe(false)
  expect(canConfirmFromList(card({ requiresReview: true }))).toBe(false)
  expect(canConfirmFromList(card({ currency: 'USD' }))).toBe(false)
  const transfer = { originAccountName: 'A', destinationAccountName: 'B', originMatch: { accountId: '1', accountName: 'A' }, destinationMatch: { accountId: '2', accountName: 'B' } }
  expect(canConfirmFromList(card({ transfer: transfer as PendingMovementCard['transfer'] }))).toBe(false)
  expect(isMatchedTransfer(card({ transfer: transfer as PendingMovementCard['transfer'] }))).toBe(true)
  expect(isMatchedTransfer(card({ transfer: { ...transfer, destinationMatch: null } as PendingMovementCard['transfer'] }))).toBe(false)
})

test('compatibleOccurrences y matchingOccurrence: solo coincide el monto exacto', () => {
  const list = [occ('luz', 80, '2026-09-28'), occ('netflix', 44.9, '2026-10-20'), occ('usd', 100, '2026-09-25', { currency: 'USD' }), occ('chico', 10, '2026-09-26')]
  const compatible = compatibleOccurrences(list, { type: 'expense', amount: 44.9, currency: 'PEN' })
  expect(compatible.map((o) => o.id)).toEqual(['luz', 'netflix'])
  expect(matchingOccurrence(compatible, 44.9)?.id).toBe('netflix')
  expect(matchingOccurrence(compatible, 30)).toBeNull()
  expect(matchingOccurrence([occ('b', 30, '2026-10-02'), occ('a', 30, '2026-09-29')], 30)?.id).toBe('a')
  expect(compatibleOccurrences(list, { type: 'income', amount: 44.9, currency: 'PEN' })).toEqual([])
  expect(matchingOccurrence([], 1)).toBeNull()
})

test('detectedWhen: hoy, ayer o fecha', () => {
  const now = new Date(2026, 8, 24, 18, 0)
  expect(detectedWhen(new Date(2026, 8, 24, 9, 12).toISOString(), now).day).toBe('today')
  expect(detectedWhen(new Date(2026, 8, 23, 23, 59).toISOString(), now).day).toBe('yesterday')
  expect(detectedWhen(new Date(2026, 8, 20, 10, 0).toISOString(), now).day).toBe('date')
})
