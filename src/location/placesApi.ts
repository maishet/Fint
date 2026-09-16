import { apiRequest, ApiRequestError } from '../api/client'

export type PlaceCategory = 'food' | 'shopping' | 'transport' | 'outdoors' | 'place'

export type PlaceSuggestion = {
  placeId: string
  primaryText: string
  secondaryText: string | null
  category: PlaceCategory
}

export type PlaceDetails = {
  latitude: number
  longitude: number
  name: string | null
  formattedAddress: string | null
  category: PlaceCategory
}

/**
 * Session token de Places (patrón de facturación de Google): agrupa las llamadas de autocompletado
 * y la única llamada de detalles que las cierra bajo una sola sesión facturable.
 */
export function createPlacesSession(): string {
  return `fint-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** La key de Google vive solo en `finanzas-api` (nunca en el bundle de la app); esto llama a nuestro backend, no a Google directo. */
export async function autocompletePlaces(query: string, sessionToken: string, limit = 5): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []
  try {
    const result = await apiRequest<{ suggestions: PlaceSuggestion[] }>('/api/places/autocomplete', {
      method: 'POST',
      body: JSON.stringify({ input: trimmed, sessionToken }),
    })
    return result.suggestions.slice(0, limit)
  } catch (error) {
    console.warn('[My Fint Location] places autocomplete failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getPlaceDetails(placeId: string, sessionToken: string): Promise<PlaceDetails | null> {
  try {
    return await apiRequest<PlaceDetails>(`/api/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`)
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null
    console.warn('[My Fint Location] place details failed', error instanceof Error ? error.message : String(error))
    return null
  }
}
