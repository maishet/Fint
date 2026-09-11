import { translateApiErrorMessage } from './finance-error-messages'

export function getRequestErrorMessage(status: number, fallback: string | undefined) {
  if (status === 429) return 'Hay demasiadas solicitudes. Espera un momento e intenta nuevamente.'
  if (!fallback) return 'API request failed'
  return translateApiErrorMessage(fallback)
}
