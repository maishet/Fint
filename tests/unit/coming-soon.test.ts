import { describe, expect, test } from 'bun:test'
import { parseComingSoon, parseHidden } from '../../src/config/comingSoon'

describe('funciones en "Pronto"', () => {
  test('sin la variable, todo está disponible', () => {
    expect(parseComingSoon(undefined).size).toBe(0)
    expect(parseComingSoon('').size).toBe(0)
  })

  test('lee la lista separada por coma, con espacios, y descarta lo desconocido', () => {
    const soon = parseComingSoon(' photoCapture, gmail ,reportExport,emailKeywords,hero ')
    expect([...soon].sort()).toEqual(['emailKeywords', 'gmail', 'photoCapture', 'reportExport'])
  })
})

describe('funciones ocultas en la tienda', () => {
  test('solo reconoce las que existen', () => {
    expect([...parseHidden('csvImport, gmail')]).toEqual(['csvImport'])
    expect(parseHidden(undefined).size).toBe(0)
  })
})
