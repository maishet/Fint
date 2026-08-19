import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import type { ReceiptExtraction } from '../../src/api/types'

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

process.env.EXPO_PUBLIC_VISION_WORKER_URL = 'https://vision.test.fint'

const { extractReceipt, VisionRequestError } = await import('../../src/capture/visionClient')

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

const VALID_EXTRACTION: ReceiptExtraction = {
  bank: 'yape',
  documentKind: 'payment_receipt',
  amount: 99.2,
  currency: 'PEN',
  occurredAt: '2026-08-16T14:24:00-05:00',
  operationNumber: '16469700',
  recipientName: 'Cristhofer Ven*',
  senderName: null,
  originAccountLabel: null,
  directionHint: 'outgoing',
  confidence: 1,
}

function ok() {
  return new Response(JSON.stringify(VALID_EXTRACTION), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function status(code: number) {
  return new Response(JSON.stringify({ error: 'x' }), { status: code, headers: { 'Content-Type': 'application/json' } })
}

test('extracción exitosa devuelve la extracción y una latencia medida', async () => {
  fetchMock.mockResolvedValueOnce(ok())
  const result = await extractReceipt('base64-image')
  expect(result.extraction).toEqual(VALID_EXTRACTION)
  expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, init] = fetchMock.mock.calls[0]!
  expect(url).toBe('https://vision.test.fint/extract')
  expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer access-1' })
})

test('refresca la sesión y reintenta una vez cuando el Worker devuelve 401', async () => {
  fetchMock.mockResolvedValueOnce(status(401))
  fetchMock.mockResolvedValueOnce(ok())

  const result = await extractReceipt('base64-image')

  expect(result.extraction).toEqual(VALID_EXTRACTION)
  expect(refreshSession).toHaveBeenCalledTimes(1)
  expect(signOut).not.toHaveBeenCalled()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('cierra la sesión y lanza unauthorized cuando el refresh falla', async () => {
  fetchMock.mockResolvedValueOnce(status(401))
  refreshSession.mockResolvedValueOnce({ data: { session: null }, error: { message: 'invalid_grant' } })

  await expect(extractReceipt('base64-image')).rejects.toMatchObject({ kind: 'unauthorized' })
  expect(signOut).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('no reintenta en bucle si el segundo intento también da 401', async () => {
  fetchMock.mockResolvedValueOnce(status(401))
  fetchMock.mockResolvedValueOnce(status(401))

  await expect(extractReceipt('base64-image')).rejects.toMatchObject({ kind: 'unauthorized' })
  expect(refreshSession).toHaveBeenCalledTimes(1)
  expect(signOut).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('429 se mapea a quota_exceeded, sin refrescar sesión', async () => {
  fetchMock.mockResolvedValueOnce(status(429))
  await expect(extractReceipt('base64-image')).rejects.toMatchObject({ kind: 'quota_exceeded' })
  expect(refreshSession).not.toHaveBeenCalled()
})

test('cualquier otro error HTTP se mapea a unavailable', async () => {
  fetchMock.mockResolvedValueOnce(status(503))
  await expect(extractReceipt('base64-image')).rejects.toMatchObject({ kind: 'unavailable' })
})

test('un fetch que rechaza (red caída o timeout via AbortController) se mapea a network', async () => {
  fetchMock.mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'))
  await expect(extractReceipt('base64-image')).rejects.toMatchObject({ kind: 'network' })
})

test('VisionRequestError es instancia de Error de verdad, no un objeto plano', async () => {
  fetchMock.mockResolvedValueOnce(status(429))
  try {
    await extractReceipt('base64-image')
    throw new Error('no debería llegar aquí')
  } catch (error) {
    expect(error).toBeInstanceOf(VisionRequestError)
    expect(error).toBeInstanceOf(Error)
  }
})
