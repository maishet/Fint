import { autocompletePlaces, createPlacesSession, getPlaceDetails, type PlaceCategory } from './placesApi'

export type LocationPermissionState = 'granted' | 'denied' | 'undetermined'

export type CapturedLocation = {
  latitude: number
  longitude: number
  formattedAddress: string | null
}

/** Lugar donde el usuario ya registró movimientos antes — viene del propio historial, no de Google. */
export type FrequentLocation = {
  latitude: number
  longitude: number
  formattedAddress: string | null
  usageCount: number
  lastUsedAt: string
}

export type { PlaceCategory }
export { createPlacesSession }

/** Sugerencia de búsqueda. Con Places configurado, llega sin coordenadas hasta que se resuelve (ver {@link resolveSuggestion}). */
export type LocationSuggestion = {
  placeId: string | null
  latitude: number | null
  longitude: number | null
  primaryText: string
  secondaryText: string | null
  category: PlaceCategory | null
}

type LocationModule = typeof import('expo-location')

let locationModulePromise: Promise<LocationModule | null> | null = null

async function loadLocation() {
  locationModulePromise ??= import('expo-location').catch(() => null)
  return locationModulePromise
}

export async function getLocationPermissionState(): Promise<LocationPermissionState> {
  const Location = await loadLocation()
  if (!Location) return 'undetermined'
  const permissions = await Location.getForegroundPermissionsAsync()
  if (permissions.granted) return 'granted'
  return permissions.status === 'denied' && !permissions.canAskAgain ? 'denied' : 'undetermined'
}

export async function requestAndCaptureLocation(): Promise<CapturedLocation | null> {
  const Location = await loadLocation()
  if (!Location) return null
  try {
    const permissions = await Location.getForegroundPermissionsAsync()
    if (!permissions.granted) {
      const requested = await Location.requestForegroundPermissionsAsync()
      if (!requested.granted) return null
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    const { latitude, longitude } = position.coords
    const formattedAddress = await reverseGeocode(Location, latitude, longitude)
    return { latitude, longitude, formattedAddress }
  } catch (error) {
    console.warn('[My Fint Location] capture failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

/** Última posición cacheada por el sistema (sin pedir un nuevo fix de GPS). Solo si ya hay permiso concedido. */
export async function getLastKnownPosition(): Promise<{ latitude: number; longitude: number } | null> {
  const Location = await loadLocation()
  if (!Location) return null
  try {
    const permissions = await Location.getForegroundPermissionsAsync()
    if (!permissions.granted) return null
    const position = await Location.getLastKnownPositionAsync()
    if (!position) return null
    return { latitude: position.coords.latitude, longitude: position.coords.longitude }
  } catch {
    return null
  }
}

async function reverseGeocode(Location: LocationModule, latitude: number, longitude: number): Promise<string | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude })
    if (!place) return null
    const parts = [place.name && place.name !== place.street ? place.name : place.street, place.district, place.city].filter(Boolean)
    return parts.length ? parts.join(', ') : null
  } catch {
    return null
  }
}

/** Dirección legible para un punto ya elegido (arrastre en el mapa, resultado de búsqueda). Nunca lanza. */
export async function describeLocation(latitude: number, longitude: number): Promise<string | null> {
  const Location = await loadLocation()
  if (!Location) return null
  return reverseGeocode(Location, latitude, longitude)
}

async function searchSuggestionsFallback(query: string, limit: number): Promise<LocationSuggestion[]> {
  const Location = await loadLocation()
  if (!Location) return []
  try {
    const matches = await Location.geocodeAsync(query)
    const results = await Promise.all(
      matches.slice(0, limit).map(async (match) => {
        const address = await reverseGeocode(Location, match.latitude, match.longitude)
        const [primaryText, ...rest] = (address ?? '').split(', ')
        return {
          placeId: null,
          latitude: match.latitude,
          longitude: match.longitude,
          primaryText: primaryText || address || query,
          secondaryText: rest.length ? rest.join(', ') : null,
          category: null,
        } satisfies LocationSuggestion
      }),
    )
    const seen = new Set<string>()
    return results.filter((item) => {
      const key = `${item.latitude?.toFixed(4)},${item.longitude?.toFixed(4)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  } catch (error) {
    console.warn('[My Fint Location] suggestions failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function searchLocationSuggestions(query: string, sessionToken: string, limit = 5): Promise<LocationSuggestion[]> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  const predictions = await autocompletePlaces(trimmed, sessionToken, limit)
  if (predictions.length) {
    return predictions.map((prediction) => ({
      placeId: prediction.placeId,
      latitude: null,
      longitude: null,
      primaryText: prediction.primaryText,
      secondaryText: prediction.secondaryText,
      category: prediction.category,
    }))
  }

  return searchSuggestionsFallback(trimmed, limit)
}

/** Resuelve una sugerencia a coordenadas concretas. Para Places, dispara la única llamada de detalles de la sesión. */
export async function resolveSuggestion(suggestion: LocationSuggestion, sessionToken: string): Promise<CapturedLocation | null> {
  if (suggestion.latitude != null && suggestion.longitude != null) {
    const formattedAddress = suggestion.secondaryText ? `${suggestion.primaryText}, ${suggestion.secondaryText}` : suggestion.primaryText
    return { latitude: suggestion.latitude, longitude: suggestion.longitude, formattedAddress: formattedAddress || null }
  }
  if (!suggestion.placeId) return null
  const details = await getPlaceDetails(suggestion.placeId, sessionToken)
  if (!details) return null
  const formattedAddress = details.name ? [details.name, details.formattedAddress].filter(Boolean).join(', ') : details.formattedAddress
  return { latitude: details.latitude, longitude: details.longitude, formattedAddress: formattedAddress ?? null }
}

/** Primer resultado de {@link searchLocationSuggestions} ya resuelto, para un buscar-y-usar directo (Enter/botón). */
export async function searchLocation(query: string): Promise<CapturedLocation | null> {
  const sessionToken = createPlacesSession()
  const [first] = await searchLocationSuggestions(query, sessionToken, 1)
  if (!first) return null
  return resolveSuggestion(first, sessionToken)
}
