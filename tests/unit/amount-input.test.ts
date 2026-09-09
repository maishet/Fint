import { describe, expect, test } from 'bun:test'
import { AMOUNT_MAX_DECIMALS, sanitizeAmountInput } from '../../src/forms'

describe('sanitizeAmountInput', () => {
  test('deja pasar un monto normal', () => {
    expect(sanitizeAmountInput('185.40')).toBe('185.40')
  })

  test('corta en cuatro decimales', () => {
    expect(sanitizeAmountInput('1.234567')).toBe('1.2345')
    expect(AMOUNT_MAX_DECIMALS).toBe(4)
  })

  test('respeta la coma como separador', () => {
    expect(sanitizeAmountInput('1,234567')).toBe('1,2345')
  })

  test('se queda con el primer separador y descarta los demas', () => {
    expect(sanitizeAmountInput('1.2.3.4')).toBe('1.234')
    expect(sanitizeAmountInput('1,2.3')).toBe('1,23')
  })

  test('descarta lo que no sea digito ni separador', () => {
    expect(sanitizeAmountInput('S/ 1 200,50')).toBe('1200,50')
    expect(sanitizeAmountInput('-45')).toBe('45')
  })

  test('deja escribir el separador antes de los decimales', () => {
    expect(sanitizeAmountInput('12.')).toBe('12.')
    expect(sanitizeAmountInput('')).toBe('')
  })
})
