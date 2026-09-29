import { describe, expect, test } from 'bun:test'
import { movementText } from '../../src/movements/text'

describe('texto de un movimiento en la fila', () => {
  test('la nota y la descripción del correo, las dos', () => {
    expect(movementText({ note: 'Para el cumple', userNote: 'Para el cumple', sourceTitle: 'Yapeo enviado - Tienda Don Pepe' })).toBe('Para el cumple · Yapeo enviado - Tienda Don Pepe')
  })
  test('sin nota, la descripción; sin descripción, la nota', () => {
    expect(movementText({ note: 'Yapeo enviado', userNote: '', sourceTitle: 'Yapeo enviado' })).toBe('Yapeo enviado')
    expect(movementText({ note: 'Almuerzo', userNote: 'Almuerzo', sourceTitle: null })).toBe('Almuerzo')
  })
  test('con el backend anterior (sin campos nuevos), `note`', () => {
    expect(movementText({ note: 'Consumo Tottus' })).toBe('Consumo Tottus')
    expect(movementText({})).toBe('')
  })
})
