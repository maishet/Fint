/**
 * Funciones que se ven pero todavía no se pueden usar: el botón sale deshabilitado con "Pronto". Se eligen con
 * `EXPO_PUBLIC_COMING_SOON` (separadas por coma) en el perfil de build de la tienda (`eas.json`); en desarrollo, sin
 * la variable, todo está disponible. Para destapar una en la tienda, se quita de la lista.
 */
export type ComingSoonFeature = "photoCapture" | "gmail" | "reportExport" | "emailKeywords";

export function parseComingSoon(value: string | undefined): ReadonlySet<ComingSoonFeature> {
  const known: readonly string[] = ["photoCapture", "gmail", "reportExport", "emailKeywords"];
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item): item is ComingSoonFeature => known.includes(item)),
  );
}

const comingSoon = parseComingSoon(process.env.EXPO_PUBLIC_COMING_SOON);

export function isComingSoon(feature: ComingSoonFeature): boolean {
  return comingSoon.has(feature);
}

/**
 * Lo que en la tienda no se muestra en absoluto, ni como "Pronto" (`EXPO_PUBLIC_HIDDEN_FEATURES`): importar movimientos
 * desde un CSV, por decisión de Cristhofer (junto con exportar todos los datos, que ya está oculto en Ajustes).
 */
export type HiddenFeature = "csvImport";

export function parseHidden(value: string | undefined): ReadonlySet<HiddenFeature> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item): item is HiddenFeature => item === "csvImport"),
  );
}

const hidden = parseHidden(process.env.EXPO_PUBLIC_HIDDEN_FEATURES);

export function isHidden(feature: HiddenFeature): boolean {
  return hidden.has(feature);
}
