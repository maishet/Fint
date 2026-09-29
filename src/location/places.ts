/**
 * Lógica pura de la ubicación: la dirección en tres niveles, la distancia entre dos puntos y los lugares que la
 * persona nombró ("Casa", "Trabajo"). Sin React ni módulos nativos, para poder probarla.
 */

export interface AddressParts {
  /** La línea principal: "Mz 171 - Lt 12", "Av. Grau 450" o el nombre del comercio. */
  primary: string | null;
  /** El barrio o la calle: "Huaycán Zona M". */
  secondary: string | null;
  /** El distrito y la ciudad: "Ate · Lima Metropolitana". */
  tertiary: string | null;
}

/** Lo que devuelve `reverseGeocodeAsync` de `expo-location` (solo lo que se usa). */
export interface GeocodedPlace {
  name?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  district?: string | null;
  subregion?: string | null;
  city?: string | null;
  region?: string | null;
}

/** La dirección en tres niveles a partir de la respuesta del geocodificador. */
export function addressParts(place: GeocodedPlace): AddressParts {
  const street = [place.street, place.streetNumber].filter(Boolean).join(" ") || null;
  const primary = place.name && place.name !== place.street && place.name !== place.streetNumber ? place.name : street;
  const secondary = place.district && place.district !== primary ? place.district : primary !== street ? street : null;
  const area = place.subregion || place.city || null;
  const tertiary = [area, place.region && place.region !== area ? place.region : null].filter(Boolean).join(" · ") || null;
  return { primary: primary || null, secondary: secondary || null, tertiary };
}

/** La dirección de una línea que se guarda con el movimiento (`formattedAddress`), igual que antes. */
export function formatAddress(place: GeocodedPlace): string | null {
  const parts = [place.name && place.name !== place.street ? place.name : place.street, place.district, place.city].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/**
 * Las líneas que se muestran de una ubicación: las partes si se conocen; si no (lo guardado antes), la dirección de
 * una línea partida en la primera coma. La segunda línea junta el barrio con el distrito: "Huaycán Zona M, Ate".
 */
export function locationLines(location: { formattedAddress?: string | null; parts?: AddressParts | null }): { primary: string | null; secondary: string | null } {
  const parts = location.parts;
  if (parts && parts.primary) {
    const district = parts.tertiary?.split(" · ")[0] ?? null;
    return { primary: parts.primary, secondary: [parts.secondary, district].filter(Boolean).join(", ") || null };
  }
  const address = location.formattedAddress;
  if (!address) return { primary: null, secondary: null };
  const [primary, ...rest] = address.split(", ");
  return { primary: primary || null, secondary: rest.join(", ") || null };
}

/** Distancia en metros entre dos puntos (haversine). */
export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "12 m", "850 m", "1.2 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(1, Math.round(meters))} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

export type SavedPlaceKind = "home" | "work" | "other";

export interface SavedPlace {
  id: string;
  name: string;
  kind: SavedPlaceKind;
  latitude: number;
  longitude: number;
  formattedAddress: string | null;
}

/** Un lugar guardado se reconoce a menos de esta distancia. */
export const SAVED_PLACE_RADIUS_M = 50;

/** El lugar guardado más cercano a menos de 50 m, o `null`. */
export function findSavedPlace(places: readonly SavedPlace[], point: { latitude: number; longitude: number }): SavedPlace | null {
  let best: SavedPlace | null = null;
  let bestDistance = SAVED_PLACE_RADIUS_M;
  for (const place of places) {
    const d = distanceMeters(place, point);
    if (d <= bestDistance) {
      best = place;
      bestDistance = d;
    }
  }
  return best;
}

/** Guarda (o renombra) un lugar: reemplaza el que ya estaba a menos de 50 m; "Casa" y "Trabajo" son únicos. */
export function upsertSavedPlace(places: readonly SavedPlace[], next: SavedPlace): SavedPlace[] {
  const near = findSavedPlace(places, next);
  return [
    next,
    ...places.filter((p) => p.id !== near?.id && p.id !== next.id && (next.kind === "other" || p.kind !== next.kind)),
  ];
}
