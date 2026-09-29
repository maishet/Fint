import { describe, expect, test } from 'bun:test'
import type { AccountOption, Category, Transaction } from '../../src/api/types'
import {
  accountBalance,
  balanceAfter,
  daysWithMovements,
  frequentCategories,
  last30DaysRange,
  monthGrid,
  recentNotes,
  sharedCurrencies,
  splitAddress,
} from '../../src/movement-form/logic'

const cat = (name: string, type: 'expense' | 'income' = 'expense'): Category => ({ id: name, name, type, icon: null })
const tx = (date: string, category: string, extra: Partial<Transaction> = {}): Transaction => ({
  id: `${date}-${category}-${Math.random()}`, date, type: 'expense', amount: 10, currency: 'PEN', category, account: 'BCP', ...extra,
})

describe('frequentCategories', () => {
  const categories = ['Alimentación', 'Transporte', 'Servicios', 'Vivienda', 'Salud', 'Ocio'].map((n) => cat(n))

  test('ordena por uso y desempata por la más reciente', () => {
    const result = frequentCategories(
      [
        tx('2026-09-01', 'Transporte'),
        tx('2026-09-02', 'Transporte'),
        tx('2026-09-03', 'Salud'),
        tx('2026-09-10', 'Ocio'),
        tx('2026-09-04', 'alimentación'),
        tx('2026-09-05', 'Alimentación'),
        tx('2026-09-06', 'Sueldo', { type: 'income' }),
      ],
      'expense',
      categories,
    )
    expect(result.map((c) => c.name)).toEqual(['Alimentación', 'Transporte', 'Ocio', 'Salud'])
  })

  test('completa con las demás categorías si faltan', () => {
    expect(frequentCategories([tx('2026-09-01', 'Vivienda')], 'expense', categories).map((c) => c.name)).toEqual([
      'Vivienda', 'Alimentación', 'Transporte', 'Servicios',
    ])
  })

  test('ignora movimientos de otro tipo y categorías que ya no existen', () => {
    expect(frequentCategories([tx('2026-09-01', 'Borrada'), tx('2026-09-01', 'Salud', { type: 'income' })], 'expense', categories.slice(0, 2)).map((c) => c.name)).toEqual([
      'Alimentación', 'Transporte',
    ])
  })
})

test('recentNotes: distintas, de la más reciente a la más antigua', () => {
  expect(
    recentNotes([
      tx('2026-09-01', 'A', { note: 'Menú del día' }),
      tx('2026-09-05', 'A', { note: 'Taxi a casa' }),
      tx('2026-09-03', 'A', { note: '  menú del día ' }),
      tx('2026-09-04', 'A', { note: '' }),
    ]),
  ).toEqual(['Taxi a casa', 'menú del día'])
})

test('balanceAfter', () => {
  expect(balanceAfter(4120.3, 84.5, 'expense')).toBe(4035.8)
  expect(balanceAfter(100, 220, 'expense')).toBe(-120)
  expect(balanceAfter(100, 0.1, 'income')).toBe(100.1)
  expect(balanceAfter(980, 800, 'transfer')).toBe(180)
})

describe('cuentas', () => {
  const visa: AccountOption = { id: 'v', name: 'Visa', currency: 'PEN', balance: -50, balances: [{ currency: 'PEN', balance: -50 }, { currency: 'USD', balance: -20 }] }
  const bcp: AccountOption = { id: 'b', name: 'BCP', currency: 'PEN', balance: 4120.3 }
  const usd: AccountOption = { id: 'u', name: 'Dólares', currency: 'USD', balance: 10 }

  test('accountBalance por moneda', () => {
    expect(accountBalance(visa, 'USD')).toBe(-20)
    expect(accountBalance(bcp, 'PEN')).toBe(4120.3)
    expect(accountBalance(bcp, 'USD')).toBeNull()
  })

  test('sharedCurrencies', () => {
    expect(sharedCurrencies(visa, bcp)).toEqual(['PEN'])
    expect(sharedCurrencies(visa, usd)).toEqual(['USD'])
    expect(sharedCurrencies(bcp, usd)).toEqual([])
    expect(sharedCurrencies(bcp, undefined)).toEqual([])
  })
})

describe('calendario', () => {
  test('monthGrid empieza en lunes', () => {
    const sept = monthGrid(2026, 8) // 1 de setiembre de 2026 es martes
    expect(sept.slice(0, 2)).toEqual([null, 1])
    expect(sept.filter((d) => d !== null)).toHaveLength(30)
    const feb = monthGrid(2026, 1) // 1 de febrero de 2026 es domingo
    expect(feb.indexOf(1)).toBe(6)
    expect(feb.filter((d) => d !== null)).toHaveLength(28)
  })

  test('daysWithMovements solo del mes pedido', () => {
    const days = daysWithMovements([tx('2026-09-16', 'A'), tx('2026-09-02', 'A'), tx('2026-08-16', 'A')], 2026, 8)
    expect([...days].sort((a, b) => a - b)).toEqual([2, 16])
  })

  test('last30DaysRange incluye hoy con to exclusivo', () => {
    expect(last30DaysRange(new Date(2026, 8, 24, 10))).toEqual({ from: '2026-08-26', to: '2026-09-25' })
    expect(last30DaysRange(new Date(2026, 11, 31))).toEqual({ from: '2026-12-02', to: '2027-01-01' })
  })
})

test('splitAddress', () => {
  expect(splitAddress('Metro Larco, Av. José Larco 1250, Miraflores')).toEqual({ primary: 'Metro Larco', secondary: 'Av. José Larco 1250, Miraflores' })
  expect(splitAddress(null)).toEqual({ primary: null, secondary: null })
})
