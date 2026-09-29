import { describe, expect, test } from 'bun:test'
import { DEFAULT_HOME_LAYOUT, moveSection, normalizeHomeLayout, setSectionVisible } from '../../src/home/layout'

describe('Personalizar inicio', () => {
  test('sin nada guardado, el orden de siempre y todo visible', () => {
    expect(normalizeHomeLayout(undefined)).toEqual(DEFAULT_HOME_LAYOUT)
    expect(DEFAULT_HOME_LAYOUT.sections.map((s) => s.id)).toEqual(['attention', 'transactions', 'spending'])
  })

  test('completa lo que falta al final y descarta lo desconocido o repetido', () => {
    const layout = normalizeHomeLayout({ sections: [{ id: 'spending', visible: false }, { id: 'hero', visible: true }, { id: 'spending', visible: true }] })
    expect(layout.sections).toEqual([
      { id: 'spending', visible: false },
      { id: 'attention', visible: true },
      { id: 'transactions', visible: true },
    ])
  })

  test('arrastrar mueve la sección y corre a las demás', () => {
    expect(moveSection(DEFAULT_HOME_LAYOUT, 'spending', 0).sections.map((s) => s.id)).toEqual(['spending', 'attention', 'transactions'])
    expect(moveSection(DEFAULT_HOME_LAYOUT, 'attention', 5).sections.map((s) => s.id)).toEqual(['transactions', 'spending', 'attention'])
    expect(moveSection(DEFAULT_HOME_LAYOUT, 'transactions', 1)).toBe(DEFAULT_HOME_LAYOUT)
  })

  test('ocultar una sección no la cambia de lugar', () => {
    const hidden = setSectionVisible(DEFAULT_HOME_LAYOUT, 'transactions', false)
    expect(hidden.sections[1]).toEqual({ id: 'transactions', visible: false })
  })
})
