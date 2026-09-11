import { expect, test } from 'bun:test'
import { balanceCurrencies } from '../../src/finance/accountBalances'

test('lists every active balance currency for a multi-currency account', () => {
  const account = {
    id: 'a1',
    name: 'AMEX',
    currency: 'PEN',
    balances: [{ currency: 'PEN', balance: -1240 }, { currency: 'USD', balance: -320 }],
  }
  expect(balanceCurrencies(account)).toEqual(['PEN', 'USD'])
})

test('falls back to the primary currency when balances is missing or empty', () => {
  expect(balanceCurrencies({ id: 'a1', name: 'Efectivo', currency: 'PEN' })).toEqual(['PEN'])
  expect(balanceCurrencies({ id: 'a1', name: 'Efectivo', currency: 'PEN', balances: [] })).toEqual(['PEN'])
})
