import { describe, expect, test } from 'bun:test'
import { amountParts, formatAmount, MINUS, THIN_SPACE } from '../../src/finance/formatAmount'

describe('formatAmount', () => {
  test('usa signo menos tipográfico y espacio fino de miles', () => {
    expect(formatAmount(-18420.65, 'PEN')).toBe(`${MINUS}S/${THIN_SPACE}18${THIN_SPACE}420.65`)
  })

  test('el signo + solo aparece si se pide', () => {
    expect(formatAmount(40, 'PEN')).toBe(`S/${THIN_SPACE}40.00`)
    expect(formatAmount(40, 'PEN', { sign: 'always' })).toBe(`+S/${THIN_SPACE}40.00`)
  })

  test('cero nunca lleva signo', () => {
    expect(amountParts(-0.001, 'PEN', { sign: 'always' }).sign).toBe('')
  })

  test('never quita el signo aunque sea negativo', () => {
    expect(amountParts(-500, 'USD', { sign: 'never' })).toEqual({ sign: '', symbol: '$', integer: '500', fraction: '00' })
  })

  test('un valor no numérico se muestra como cero', () => {
    expect(formatAmount(Number.NaN, 'PEN')).toBe(`S/${THIN_SPACE}0.00`)
  })
})
