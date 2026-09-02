import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'bun:test'

const ROOTS = ['app', 'src']
const ANIMATED_COLOR_PROPS = ['bg', 'backgroundColor', 'borderColor'] as const

const PROVIDES_OWN_BASE: Record<string, string> = {
  FintCard: 'src/ui/FintCard.tsx',
  FintButton: 'src/ui/FintButton.tsx',
}

function collectTsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) collectTsxFiles(full, out)
    else if (entry.endsWith('.tsx')) out.push(full)
  }
  return out
}

/** Divide el archivo en aperturas de etiqueta JSX (`<Foo ... >`). */
function splitJsxOpeningTags(source: string): string[] {
  return source.match(/<[A-Z][A-Za-z0-9_.]*\s[^<]*?(?:\/>|>)/gs) ?? []
}

function stateStyleSetsColor(tag: string, prop: string): boolean {
  const stateStyle = tag.match(/(?:pressStyle|hoverStyle|focusStyle)=\{[\s\S]*?\}\}/g)
  return (stateStyle ?? []).some((block) => new RegExp(`\\b${prop}\\s*:`).test(block))
}

function hasBaseColor(tag: string, prop: string): boolean {
  // El color base va como prop directa, fuera de cualquier *Style.
  const withoutStateStyles = tag.replace(/(?:pressStyle|hoverStyle|focusStyle)=\{[\s\S]*?\}\}/g, '')
  return new RegExp(`\\b${prop}=`).test(withoutStateStyles)
}

test('los componentes exentos siguen fijando su color base', () => {
  for (const [name, path] of Object.entries(PROVIDES_OWN_BASE)) {
    const source = readFileSync(path, 'utf8')
    expect(source, `${name} ya no fija bg base: quitalo de PROVIDES_OWN_BASE`).toContain('bg=')
  }
})

test('todo elemento con transition que anima un color tiene valor base', () => {
  const offenders: string[] = []

  for (const root of ROOTS) {
    for (const file of collectTsxFiles(root)) {
      const source = readFileSync(file, 'utf8')
      if (!source.includes('transition=')) continue

      for (const tag of splitJsxOpeningTags(source)) {
        if (!/\btransition=/.test(tag)) continue
        const name = tag.match(/^<([A-Za-z0-9_.]+)/)?.[1] ?? '?'
        if (name in PROVIDES_OWN_BASE) continue
        for (const prop of ANIMATED_COLOR_PROPS) {
          if (stateStyleSetsColor(tag, prop) && !hasBaseColor(tag, prop)) {
            offenders.push(`${file} <${name}> anima ${prop} sin valor base`)
          }
        }
      }
    }
  }

  expect(offenders).toEqual([])
})
