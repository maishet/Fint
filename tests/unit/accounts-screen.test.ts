import { expect, test } from 'bun:test'
import type { Account } from '../../src/api/types'
import { accountLines, assetsAndLiabilities, groupAccounts } from '../../src/accounts/logic'

const acc = (id: string, accountType: string, balance: number, currency = 'PEN', balances?: Account['balances']): Account => ({
  id, name: id, accountType, currency, balance, balances,
})

test('accountLines: una línea por moneda, o el saldo de la cuenta', () => {
  expect(accountLines(acc('a', 'cash', 10))).toEqual([{ currency: 'PEN', balance: 10 }])
  const visa = acc('v', 'credit_card', -100, 'PEN', [{ currency: 'PEN', balance: -100 }, { currency: 'USD', balance: -20 }])
  expect(accountLines(visa)).toHaveLength(2)
})

test('groupAccounts: por tipo, en orden, por saldo, con el total en la moneda elegida', () => {
  const visa = acc('visa', 'credit_card', -300, 'PEN', [{ currency: 'PEN', balance: -300 }, { currency: 'USD', balance: -20 }])
  const accounts = [
    acc('bcp', 'savings_account', 4120.3),
    acc('wallet', 'cash', 50),
    acc('caja', 'savings_account', 14350.65),
    acc('ibk', 'checking_account', 980),
    visa,
    acc('usd', 'savings_account', 500, 'USD'),
  ]
  const pen = groupAccounts(accounts, 'PEN')
  expect(pen.map((g) => [g.key, g.accounts.map((a) => a.id), g.total])).toEqual([
    ['bank', ['caja', 'bcp', 'ibk'], 19450.95],
    ['cash', ['wallet'], 50],
    ['card', ['visa'], -300],
  ])
  // En dólares solo aparecen las que tienen saldo en dólares (la tarjeta, por su línea en USD).
  expect(groupAccounts(accounts, 'USD').map((g) => [g.key, g.accounts.map((a) => a.id), g.total])).toEqual([
    ['bank', ['usd'], 500],
    ['card', ['visa'], -20],
  ])
})

test('assetsAndLiabilities: por moneda; una tarjeta a favor suma a activos, una con deuda a pasivos', () => {
  const accounts = [
    acc('bcp', 'savings_account', 1000),
    acc('visa', 'credit_card', 100, 'PEN', [{ currency: 'PEN', balance: 100 }, { currency: 'USD', balance: 7.01 }]),
    acc('amex', 'credit_card', -250.5),
  ]
  expect(assetsAndLiabilities(accounts, 'PEN')).toEqual({ assets: 1100, liabilities: 250.5 })
  expect(assetsAndLiabilities(accounts, 'USD')).toEqual({ assets: 7.01, liabilities: 0 })
})
