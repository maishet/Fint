import { afterEach, beforeEach, expect, mock, test } from 'bun:test'

const getSession = mock(async () => ({ data: { session: { access_token: 'access-1' } } }))
const signOut = mock(async () => ({ error: null }))
const refreshSession = mock(async () => ({ data: { session: { access_token: 'access-2' } }, error: null }))

mock.module('../../src/auth/supabase', () => ({
  supabase: { auth: { getSession, signOut, refreshSession } },
}))

const captureMessage = mock((_message: string, _context?: unknown) => undefined)

mock.module('@sentry/react-native', () => ({ captureMessage }))

process.env.EXPO_PUBLIC_API_URL = 'https://api.test.fint'

const { financeApi } = await import('../../src/api/finance')

const fetchMock = mock<typeof fetch>()
const originalFetch = globalThis.fetch

const ACCOUNT_ID = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  fetchMock.mockReset()
  getSession.mockClear()
  captureMessage.mockClear()
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function respond(data: unknown) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

test('does not report when the response matches its schema', async () => {
  const account = { id: ACCOUNT_ID, name: 'Efectivo', accountType: 'cash', currency: 'PEN', balance: 125.5 }
  fetchMock.mockResolvedValueOnce(respond(account))

  const result = await financeApi.getAccount(ACCOUNT_ID)

  expect(result).toEqual(account)
  expect(captureMessage).not.toHaveBeenCalled()
})

test('reports a schema mismatch to Sentry but still returns the raw data', async () => {
  // `balance` llega como string: el contrato cambió y debemos detectarlo.
  const malformed = { id: ACCOUNT_ID, name: 'Efectivo', accountType: 'cash', currency: 'PEN', balance: '125.5' }
  fetchMock.mockResolvedValueOnce(respond(malformed))

  const result = await financeApi.getAccount(ACCOUNT_ID)

  // Degradación con gracia: la UI recibe el dato crudo, no crashea.
  expect(result).toEqual(malformed as never)
  expect(captureMessage).toHaveBeenCalledTimes(1)

  const [message, context] = captureMessage.mock.calls[0] as [string, { level: string; tags: { endpoint: string } }]
  expect(message).toBe('api_response_schema_mismatch')
  expect(context.level).toBe('warning')
  // El id se normaliza a :id para no filtrar datos ni inflar cardinalidad.
  expect(context.tags.endpoint).toBe('/api/accounts/:id')
})
