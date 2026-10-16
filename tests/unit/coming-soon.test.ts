import { describe, expect, test } from 'bun:test'
import { comingSoonFeatures, parseComingSoon, parseHidden } from '../../src/config/comingSoon'
import { comingSoonTranslations } from '../../src/i18n/comingSoon'

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

describe('hoja de "Pronto"', () => {
  const languages = ['es', 'en', 'pt'] as const

  test('cada función tiene nombre, titular y una línea en los tres idiomas', () => {
    for (const language of languages) {
      const copy = comingSoonTranslations[language].comingSoon
      for (const feature of comingSoonFeatures) {
        expect(copy[feature].kicker.length).toBeGreaterThan(0)
        expect(copy[feature].title.length).toBeGreaterThan(0)
        expect(copy[feature].line.length).toBeGreaterThan(0)
      }
      expect(copy.ok.length).toBeGreaterThan(0)
      expect(copy.tapHint.length).toBeGreaterThan(0)
    }
  })

  test('la app se llama My Fint, nunca Fint a secas', () => {
    const strings = JSON.stringify(comingSoonTranslations)
    expect(strings).not.toMatch(/(?<!My )Fint/)
  })
})

describe('funciones ocultas en la tienda', () => {
  test('solo reconoce las que existen', () => {
    expect([...parseHidden('csvImport, gmail')]).toEqual(['csvImport'])
    expect(parseHidden(undefined).size).toBe(0)
  })
})
