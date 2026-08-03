import { afterEach, beforeEach, expect, mock, test } from 'bun:test'

const getSession = mock(async () => ({ data: { session: { access_token: 'test-access-token' } } }))
const signOut = mock(async () => ({ error: null }))

mock.module('../../src/auth/supabase', () => ({
  supabase: { auth: { getSession, signOut } },
}))

process.env.EXPO_PUBLIC_API_URL = 'https://api.test.fint'

const { financeApi } = await import('../../src/api/finance')

const fetchMock = mock<typeof fetch>()
const originalFetch = globalThis.fetch

beforeEach(() => {
  fetchMock.mockReset()
  getSession.mockClear()
  signOut.mockClear()
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify({ ok: status < 400, data }), { status, headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'test-request-id' } })
}

function expectRequest(path: string, method: string, body?: unknown) {
  const [url, options] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  expect(url).toBe(`https://api.test.fint${path}`)
  expect(options.method).toBe(method === 'GET' ? undefined : method)
  expect(options.headers).toMatchObject({ Authorization: 'Bearer test-access-token', 'Content-Type': 'application/json' })
  if (body !== undefined) expect(JSON.parse(String(options.body))).toEqual(body)
}

test('sends account create, update, and deactivation mutations with their expected contracts', async () => {
  fetchMock.mockResolvedValueOnce(respond({ id: 'account-1' }))
  await financeApi.createAccount({ name: 'Efectivo', accountType: 'cash', currency: 'PEN', openingBalance: 125 })
  expectRequest('/api/accounts', 'POST', { name: 'Efectivo', accountType: 'cash', currency: 'PEN', openingBalance: 125 })

  fetchMock.mockResolvedValueOnce(respond({ id: 'account-1' }))
  await financeApi.updateAccount('account-1', { name: 'Caja', accountType: 'cash', currency: 'PEN' })
  expectRequest('/api/accounts/account-1', 'PATCH', { name: 'Caja', accountType: 'cash', currency: 'PEN' })

  fetchMock.mockResolvedValueOnce(respond({ id: 'account-1' }))
  await financeApi.deleteAccount('account-1')
  expectRequest('/api/accounts/account-1', 'DELETE')
})

test('sends transaction create, update, and delete mutations with the selected account currency', async () => {
  const input = { type: 'expense' as const, amount: 42.5, category: 'Comida', account: 'Efectivo', currency: 'PEN', transactionDate: '2026-08-03', note: 'Mercado' }

  fetchMock.mockResolvedValueOnce(respond({ id: 'transaction-1' }))
  await financeApi.createTransaction(input)
  expectRequest('/api/transactions', 'POST', input)

  fetchMock.mockResolvedValueOnce(respond({ id: 'transaction-1' }))
  await financeApi.updateTransaction('transaction-1', input)
  expectRequest('/api/transactions/transaction-1', 'PATCH', input)

  fetchMock.mockResolvedValueOnce(respond({ id: 'transaction-1' }))
  await financeApi.deleteTransaction('transaction-1')
  expectRequest('/api/transactions/transaction-1', 'DELETE')
})

test('sends recurring payment mutations and assigns an idempotency key to a payment', async () => {
  const input = { title: 'Internet', kind: 'fixed_payment' as const, frequency: 'monthly' as const, fixedAmount: 89.9, categoryId: 'category-1', currency: 'PEN', timezone: 'America/Lima', startDate: '2026-08-01' }

  fetchMock.mockResolvedValueOnce(respond({ id: 'rule-1' }))
  await financeApi.createPaymentRule(input)
  expectRequest('/api/payment-rules', 'POST', input)

  fetchMock.mockResolvedValueOnce(respond({ id: 'rule-1' }))
  await financeApi.updatePaymentRule('rule-1', { title: input.title, frequency: input.frequency, fixedAmount: input.fixedAmount, categoryId: input.categoryId, startDate: input.startDate })
  expectRequest('/api/payment-rules/rule-1', 'PATCH', { title: input.title, frequency: input.frequency, fixedAmount: input.fixedAmount, categoryId: input.categoryId, startDate: input.startDate })

  fetchMock.mockResolvedValueOnce(respond({ id: 'rule-1' }))
  await financeApi.deletePaymentRule('rule-1')
  expectRequest('/api/payment-rules/rule-1', 'DELETE')

  fetchMock.mockResolvedValueOnce(respond({ id: 'occurrence-1', transactionId: 'transaction-2' }))
  await financeApi.payPaymentOccurrence('occurrence-1', { accountId: 'account-1', amount: 89.9, transactionDate: '2026-08-03' })
  expectRequest('/api/payment-occurrences/occurrence-1/pay', 'POST', { accountId: 'account-1', amount: 89.9, transactionDate: '2026-08-03' })
  const [, options] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  expect(options.headers).toMatchObject({ 'Idempotency-Key': expect.any(String) })
})

test('preserves API validation errors for a failed financial mutation', async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: 'account_name_exists', message: 'Nombre duplicado' }), { status: 409, headers: { 'Content-Type': 'application/json' } }))

  await expect(financeApi.createAccount({ name: 'Duplicada', accountType: 'cash', currency: 'PEN', openingBalance: 0 })).rejects.toMatchObject({
    code: 'account_name_exists',
    status: 409,
  })
  expectRequest('/api/accounts', 'POST', { name: 'Duplicada', accountType: 'cash', currency: 'PEN', openingBalance: 0 })
})

test('sends Gmail OAuth, sender configuration, sync, and disconnect contracts', async () => {
  fetchMock.mockResolvedValueOnce(respond({ authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=test' }))
  await financeApi.startGmailOAuth()
  expectRequest('/api/integrations/gmail/oauth/start', 'GET')

  const config = { labelIds: ['INBOX'], senderFilters: ['alerts@bank.example', 'receipts@store.example'] }
  fetchMock.mockResolvedValueOnce(respond({ id: 'source-1', ...config }))
  await financeApi.updateGmailSource('source-1', config)
  expectRequest('/api/integrations/sources/gmail/source-1/config', 'PUT', config)

  fetchMock.mockResolvedValueOnce(respond({ processed: 4, created: 2, skipped: 1 }))
  await financeApi.syncGmailSource('source-1')
  expectRequest('/api/integrations/sources/gmail/source-1/sync', 'POST')

  fetchMock.mockResolvedValueOnce(respond({ id: 'source-1' }))
  await financeApi.disconnectGmailSource('source-1')
  expectRequest('/api/integrations/sources/gmail/source-1', 'DELETE')
})
