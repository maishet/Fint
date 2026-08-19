import { supabase } from '../auth/supabase'
import type { ReceiptExtraction } from '../api/types'

const workerUrl = process.env.EXPO_PUBLIC_VISION_WORKER_URL
const REQUEST_TIMEOUT_MS = 30_000

export const VISION_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct'

export type VisionErrorKind = 'quota_exceeded' | 'unavailable' | 'unauthorized' | 'network'

export class VisionRequestError extends Error {
  constructor(
    public readonly kind: VisionErrorKind,
    message: string,
  ) {
    super(message)
    this.name = 'VisionRequestError'
  }
}

export type ExtractReceiptResult = {
  extraction: ReceiptExtraction
  latencyMs: number
}

async function postExtract(base64Image: string, token: string | undefined, signal: AbortSignal): Promise<Response> {
  if (!workerUrl) throw new VisionRequestError('unavailable', 'Missing EXPO_PUBLIC_VISION_WORKER_URL')
  return fetch(`${workerUrl.replace(/\/$/, '')}/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ image: base64Image }),
    signal,
  })
}

export async function extractReceipt(base64Image: string, retryOn401 = true): Promise<ExtractReceiptResult> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const startedAt = Date.now()
  let response: Response
  try {
    response = await postExtract(base64Image, token, controller.signal)
  } catch (error) {
    if (error instanceof VisionRequestError) throw error
    throw new VisionRequestError('network', error instanceof Error ? error.message : 'network_error')
  } finally {
    clearTimeout(timeout)
  }
  const latencyMs = Date.now() - startedAt

  if (response.status === 401 && retryOn401) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (!refreshError && refreshed.session) return extractReceipt(base64Image, false)
  }

  if (!response.ok) {
    if (response.status === 401) {
      await supabase.auth.signOut()
      throw new VisionRequestError('unauthorized', 'Sesión inválida')
    }
    if (response.status === 429) throw new VisionRequestError('quota_exceeded', 'Cuota diaria de extracción agotada')
    throw new VisionRequestError('unavailable', `Vision worker request failed with status ${response.status}`)
  }

  const extraction = (await response.json()) as ReceiptExtraction
  return { extraction, latencyMs }
}
