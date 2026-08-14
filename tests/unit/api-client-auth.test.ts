import { afterEach, beforeEach, expect, mock, test } from 'bun:test'

type RefreshResult = {
  data: { session: { access_token: string } | null }
  error: { message: string } | null
}

const getSession = mock(async () => ({ data: { session: { access_token: 'access-1' } } }))
const refreshSession = mock(
  async (): Promise<RefreshResult> => ({ data: { session: { access_token: 'access-2' } }, error: null }),
)
const signOut = mock(async () => ({ error: null }))

mock.module('../../src/auth/supabase', () => ({
  supabase: { auth: { getSession, refreshSession, signOut } },
}))

process.env.EXPO_PUBLIC_API_URL = 'https://api.test.fint'

const { apiRequest } = await import('../../src/api/client')

const fetchMock = mock<typeof fetch>()
const originalFetch = globalThis.fetch

beforeEach(() => {
  fetchMock.mockReset()
  getSession.mockClear()
  refreshSession.mockClear()
  signOut.mockClear()
  refreshSession.mockResolvedValue({ data: { session: { access_token: 'access-2' } }, error: null })
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function ok(data: unknown) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function unauthorized() {
  return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

test('refreshes the session and retries once when a request returns 401', async () => {
  fetchMock.mockResolvedValueOnce(unauthorized())
  fetchMock.mockResolvedValueOnce(ok({ id: 'me-1' }))

  const result = await apiRequest<{ id: string }>('/api/me')

  expect(result).toEqual({ id: 'me-1' })
  expect(refreshSession).toHaveBeenCalledTimes(1)
  expect(signOut).not.toHaveBeenCalled()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('signs out when the 401 refresh fails', async () => {
  fetchMock.mockResolvedValueOnce(unauthorized())
  refreshSession.mockResolvedValueOnce({ data: { session: null }, error: { message: 'invalid_grant' } })

  await expect(apiRequest('/api/me')).rejects.toMatchObject({ status: 401 })
  expect(refreshSession).toHaveBeenCalledTimes(1)
  expect(signOut).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('does not loop when the retried request also returns 401', async () => {
  // Una Response nueva por llamada: su body sólo puede leerse una vez.
  fetchMock.mockResolvedValueOnce(unauthorized())
  fetchMock.mockResolvedValueOnce(unauthorized())

  await expect(apiRequest('/api/me')).rejects.toMatchObject({ status: 401 })
  expect(refreshSession).toHaveBeenCalledTimes(1)
  expect(signOut).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
