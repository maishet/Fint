import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'bun:test'

const ROOTS = ['app', 'src']
const CONFIG = 'tamagui.config.ts'

/** Claves declaradas a mano en el bloque `light` de la config. */
function explicitThemeKeys(): Set<string> {
  const source = readFileSync(CONFIG, 'utf8')
  const start = source.indexOf('  light: {')
  const end = source.indexOf('\n  dark: {', start)
  expect(start, 'no se encontro el bloque `light` en tamagui.config.ts').toBeGreaterThan(-1)
  expect(end, 'no se encontro el bloque `dark` en tamagui.config.ts').toBeGreaterThan(-1)
  const block = source.slice(start, end)
  return new Set([...block.matchAll(/^\s{4}([A-Za-z][A-Za-z0-9]*):/gm)].map((match) => match[1]))
}

/** Rampas generadas por `createThemes` (color1..12, accent1..12, red9...). */
const GENERATED_RAMP = /^[a-z]+\d{1,2}$/

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) collectSourceFiles(full, out)
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) out.push(full)
  }
  return out
}

test('el bloque `light` declara las claves que se leen desde codigo', () => {
  const keys = explicitThemeKeys()
  expect(keys.has('primary')).toBe(true)
  expect(keys.has('headerBackground')).toBe(true)
  expect(keys.has('subtle')).toBe(false)
})

test('todo `theme.x` apunta a una clave que existe en el tema', () => {
  const allowed = explicitThemeKeys()
  const offenders: string[] = []

  for (const root of ROOTS) {
    for (const file of collectSourceFiles(root)) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/\btheme\.([A-Za-z][A-Za-z0-9]*)/g)) {
        const key = match[1]
        if (allowed.has(key) || GENERATED_RAMP.test(key)) continue
        offenders.push(`${file} usa theme.${key}, que no es una clave del tema`)
      }
    }
  }

  expect([...new Set(offenders)]).toEqual([])
})
