import { describe, expect, test } from 'bun:test'
import { SCREEN_READER_ACTION_MS, toastAnnouncement, toastDuration } from '../../src/ui/toastTiming'

describe('toastDuration', () => {
  test('sin lector de pantalla queda lo pedido', () => {
    expect(toastDuration(5000, true, false)).toBe(5000)
    expect(toastDuration(undefined, true, false)).toBeUndefined()
  })

  test('con lector, un toast con acción dura al menos 20 s', () => {
    expect(toastDuration(5000, true, true)).toBe(SCREEN_READER_ACTION_MS)
    expect(toastDuration(undefined, true, true)).toBe(SCREEN_READER_ACTION_MS)
  })

  test('con lector, no acorta lo que ya era más largo ni toca los toasts sin acción', () => {
    expect(toastDuration(60_000, true, true)).toBe(60_000)
    expect(toastDuration(Infinity, true, true)).toBe(Infinity)
    expect(toastDuration(4000, false, true)).toBe(4000)
    expect(toastDuration(undefined, false, true)).toBeUndefined()
  })
})

test('toastAnnouncement une título, detalle y acción sin huecos', () => {
  expect(toastAnnouncement('Gasto registrado', undefined, 'Deshacer')).toBe('Gasto registrado. Deshacer')
  expect(toastAnnouncement('Listo', 'Se guardó')).toBe('Listo. Se guardó')
  expect(toastAnnouncement('Error')).toBe('Error')
})
