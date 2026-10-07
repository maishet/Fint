import { describe, expect, test } from 'bun:test'
import { AMOUNT_MAX_DECIMALS } from '../../src/forms'
import { amountInputValue, applyAmountKey, displayAmountInput, MAX_INTEGER_DIGITS, type AmountKey } from '../../src/forms/amountInput'

const type = (keys: string) => [...keys].reduce((acc, k) => applyAmountKey(acc, (k === '<' ? 'del' : k) as AmountKey), '')

describe('applyAmountKey', () => {
  test('escribe un monto normal', () => {
    expect(type('84.50')).toBe('84.50')
  })

  test('no deja ceros a la izquierda', () => {
    expect(type('0005')).toBe('5')
  })

  test('el punto al inicio escribe 0.', () => {
    expect(type('.5')).toBe('0.5')
  })

  test('acepta un solo punto', () => {
    expect(type('1..2.3')).toBe('1.23')
  })

  test('corta en los decimales que acepta la validación', () => {
    expect(type('1.123456').split('.')[1]).toHaveLength(AMOUNT_MAX_DECIMALS)
  })

  test('limita la parte entera', () => {
    expect(type('1234567890123').length).toBe(MAX_INTEGER_DIGITS)
  })

  test('borrar quita el último carácter y no falla vacío', () => {
    expect(type('84.5<')).toBe('84.')
    expect(type('<<')).toBe('')
  })
})

describe('amountInputValue y displayAmountInput', () => {
  test('vacío y "0." valen cero', () => {
    expect(amountInputValue('')).toBe(0)
    expect(amountInputValue('0.')).toBe(0)
  })

  test('agrupa miles con espacio fino y respeta lo escrito', () => {
    expect(displayAmountInput('1450.')).toBe('1 450.')
    expect(displayAmountInput('')).toBe('0')
  })
})
