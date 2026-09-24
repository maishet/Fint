import { expect, test } from 'bun:test'
import { addKeyword, filterCurrencies, previewAmount, sameKeywords, selectableTypes } from '../../src/accounts/form'

test('addKeyword: limpia, no repite y no pasa de cinco', () => {
  expect(addKeyword([], '  Visa   0931 ')).toEqual(['Visa 0931'])
  expect(addKeyword(['BCP'], 'bcp')).toEqual(['BCP'])
  expect(addKeyword(['BCP'], '   ')).toEqual(['BCP'])
  expect(addKeyword(['a', 'b', 'c', 'd', 'e'], 'f')).toEqual(['a', 'b', 'c', 'd', 'e'])
  expect(addKeyword([], 'x'.repeat(80))[0]).toHaveLength(60)
})

test('sameKeywords: mismo orden y contenido', () => {
  expect(sameKeywords(['a', 'b'], ['a', 'b'])).toBe(true)
  expect(sameKeywords(['a', 'b'], ['b', 'a'])).toBe(false)
  expect(sameKeywords([], ['a'])).toBe(false)
})

test('filterCurrencies: por código o nombre, sin tildes ni mayúsculas', () => {
  const options = [
    { code: 'PEN', name: 'Sol peruano', englishName: 'Sol' },
    { code: 'USD', name: 'Dólar estadounidense', englishName: 'US Dollar' },
    { code: 'CAD', name: 'Dólar canadiense', englishName: 'Canadian Dollar' },
  ]
  expect(filterCurrencies(options, '').map((o) => o.code)).toEqual(['PEN', 'USD', 'CAD'])
  expect(filterCurrencies(options, 'dolar').map((o) => o.code)).toEqual(['USD', 'CAD'])
  expect(filterCurrencies(options, 'pen').map((o) => o.code)).toEqual(['PEN'])
  expect(filterCurrencies(options, 'canadian').map((o) => o.code)).toEqual(['CAD'])
})

test('selectableTypes: al editar, Tarjeta no entra ni sale', () => {
  expect(selectableTypes(false, null)).toEqual(['cash', 'checking_account', 'savings_account', 'credit_card'])
  expect(selectableTypes(true, 'savings_account')).toEqual(['cash', 'checking_account', 'savings_account'])
  expect(selectableTypes(true, 'credit_card')).toEqual([])
})

test('previewAmount: lo escrito, con coma o punto, o cero', () => {
  expect(previewAmount('2500.5')).toBe(2500.5)
  expect(previewAmount('12,3')).toBe(12.3)
  expect(previewAmount('')).toBe(0)
  expect(previewAmount('.')).toBe(0)
})
