import { expect, test } from 'bun:test'
import { amountText, nextDue, upcomingDates } from '../../src/payments/form'

test('nextDue: semanal y quincenal suman días, cruzando el mes', () => {
  expect(nextDue('weekly', '2026-09-28', '2026-09-28')).toBe('2026-10-05')
  expect(nextDue('biweekly', '2026-12-25', '2026-12-25')).toBe('2027-01-08')
})

test('nextDue: mensual vuelve al día de la primera fecha o al último del mes', () => {
  expect(nextDue('monthly', '2026-01-31', '2026-01-31')).toBe('2026-02-28')
  expect(nextDue('monthly', '2026-02-28', '2026-01-31')).toBe('2026-03-31')
  expect(nextDue('monthly', '2026-12-15', '2026-12-15')).toBe('2027-01-15')
})

test('nextDue: anual, con el 29 de febrero', () => {
  expect(nextDue('yearly', '2028-02-29', '2028-02-29')).toBe('2029-02-28')
  expect(nextDue('yearly', '2029-02-28', '2028-02-29')).toBe('2030-02-28')
  expect(nextDue('yearly', '2031-02-28', '2028-02-29')).toBe('2032-02-29')
})

test('upcomingDates: las tres primeras desde la primera fecha', () => {
  expect(upcomingDates('2026-10-01', 'monthly')).toEqual(['2026-10-01', '2026-11-01', '2026-12-01'])
  expect(upcomingDates('2026-09-24', 'weekly', 2)).toEqual(['2026-09-24', '2026-10-01'])
})

test('upcomingDates: al editar, solo desde hoy', () => {
  expect(upcomingDates('2026-01-10', 'monthly', 3, '2026-09-24')).toEqual(['2026-10-10', '2026-11-10', '2026-12-10'])
  expect(upcomingDates('2026-09-24', 'monthly', 1, '2026-09-24')).toEqual(['2026-09-24'])
})

test('upcomingDates: una fecha inválida no da fechas', () => {
  expect(upcomingDates('', 'monthly')).toEqual([])
})

test('amountText: dos decimales, o los que tenga si son más', () => {
  expect(amountText(258)).toBe('258.00')
  expect(amountText(45.9)).toBe('45.90')
  expect(amountText(1.2345)).toBe('1.2345')
  expect(amountText(null)).toBe('')
})
