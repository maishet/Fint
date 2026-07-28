import { supabase } from '../auth/supabase'
import type { ApiEnvelope } from './types'
import { getRequestErrorMessage } from './error-message'
import { setLastRequestId } from '../support/diagnostics'

const apiUrl = process.env.EXPO_PUBLIC_API_URL
const requestTimeoutMs = 30_000

export class ApiRequestError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}) {
  if (!apiUrl) throw new Error('Missing EXPO_PUBLIC_API_URL')

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const url = `${apiUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`

  const controller = new AbortController()
  let timedOut = false
  const abortFromCaller = () => controller.abort()
  if (options.signal?.aborted) controller.abort()
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = setTimeout(() => { timedOut = true; controller.abort() }, requestTimeoutMs)
  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      signal: controller.signal,
    })
    setLastRequestId(response.headers.get('X-Request-Id'))
  } catch (error) {
    if (options.signal?.aborted) throw error
    if (timedOut) throw new ApiRequestError('La conexión tardó demasiado. Intenta nuevamente.', 0, 'request_timeout')
    throw new ApiRequestError('No se pudo conectar al servidor. Revisa tu conexión e intenta nuevamente.', 0, 'network_error')
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abortFromCaller)
  }

  const envelope = await parseEnvelope<T>(response)

  if (!response.ok || !envelope.ok) {
    if (response.status === 401) await supabase.auth.signOut()
    const message = getRequestErrorMessage(response.status, envelope.message ?? envelope.error)
    throw new ApiRequestError(message, response.status, envelope.error)
  }

  if (envelope.data === undefined) {
    throw new ApiRequestError('API response did not include data', response.status, 'missing_data')
  }

  return envelope.data
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  const text = await response.text()
  if (!text) return { ok: response.ok, data: undefined as T }

  try {
    return JSON.parse(text) as ApiEnvelope<T>
  } catch {
    return {
      ok: false,
      error: 'invalid_json',
      message: response.ok ? 'API returned an invalid JSON response' : `API request failed with status ${response.status}`,
    }
  }
}
