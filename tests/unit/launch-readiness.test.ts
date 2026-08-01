import { expect, test } from 'bun:test'
import { getRequestErrorMessage } from '../../src/api/error-message'
import { getInitialRoute } from '../../src/auth/initial-route'

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
