import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'bun:test'
import { getRequestErrorMessage } from '../../src/api/error-message'
import { getInitialRoute } from '../../src/auth/initial-route'

const repoRoot = join(import.meta.dir, '..', '..')

test('returns the login route without a valid session', () => {
  expect(getInitialRoute(false, false, undefined)).toBe('/login')
  expect(getInitialRoute(true, true, true)).toBe('/login')
})

test('returns the dashboard route for an authenticated session', () => {
  expect(getInitialRoute(true, false, true)).toBe('/(tabs)/dashboard')
})

test('returns onboarding for an authenticated incomplete setup', () => {
  expect(getInitialRoute(true, false, false)).toBe('/onboarding')
})

test('maps rate limits to an actionable error', () => {
  expect(getRequestErrorMessage(429, 'ignored')).toContain('demasiadas solicitudes')
  expect(getRequestErrorMessage(500, 'Servicio no disponible')).toBe('Servicio no disponible')
})

function appJson(): { expo: { plugins: unknown[] } } {
  return JSON.parse(readFileSync(join(repoRoot, 'app.json'), 'utf8'))
}

test('app.json declara el plugin de expo-image-picker con los permisos requeridos', () => {
  const plugins = appJson().expo.plugins
  const entry = plugins.find((p) => Array.isArray(p) && p[0] === 'expo-image-picker') as [string, Record<string, unknown>] | undefined
  expect(entry).toBeDefined()
  expect(typeof entry?.[1].photosPermission).toBe('string')
  expect(typeof entry?.[1].cameraPermission).toBe('string')
})

test('app.json declara el plugin de expo-share-intent con los intent filters de imagen', () => {
  const plugins = appJson().expo.plugins
  const entry = plugins.find((p) => Array.isArray(p) && p[0] === 'expo-share-intent') as [string, Record<string, unknown>] | undefined
  expect(entry).toBeDefined()
  expect(entry?.[1].androidIntentFilters).toEqual(['image/*'])
  expect(entry?.[1].androidMultiIntentFilters).toEqual(['image/*'])
})

test('la ruta capture-import existe y está registrada en el stack protegido', () => {
  expect(existsSync(join(repoRoot, 'app', 'capture-import.tsx'))).toBe(true)
  const layout = readFileSync(join(repoRoot, 'app', '_layout.tsx'), 'utf8')
  expect(layout).toContain('name="capture-import"')
})

test('.env.example documenta EXPO_PUBLIC_VISION_WORKER_URL', () => {
  const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8')
  expect(envExample).toContain('EXPO_PUBLIC_VISION_WORKER_URL')
})
