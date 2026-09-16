export type LocationPermissionState = 'granted' | 'denied' | 'undetermined'

export type CapturedLocation = {
  latitude: number
  longitude: number
  formattedAddress: string | null
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

export async function searchLocationSuggestions(query: string, limit = 5): Promise<CapturedLocation[]> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []
  const Location = await loadLocation()
  if (!Location) return []
  try {
    const matches = await Location.geocodeAsync(trimmed)
    const results = await Promise.all(
      matches.slice(0, limit).map(async (match) => ({
        latitude: match.latitude,
        longitude: match.longitude,
        formattedAddress: await reverseGeocode(Location, match.latitude, match.longitude),
      })),
    )
    const seen = new Set<string>()
    return results.filter((item) => {
      const key = `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  } catch (error) {
    console.warn('[My Fint Location] suggestions failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

/** Primer resultado de {@link searchLocationSuggestions}, para un buscar-y-usar directo (Enter/botón). */
export async function searchLocation(query: string): Promise<CapturedLocation | null> {
  const [first] = await searchLocationSuggestions(query, 1)
  return first ?? null
}
