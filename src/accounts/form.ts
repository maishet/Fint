import type { AccountType } from "../api/types";

/**
 * Lógica pura del formulario de cuenta: las palabras clave de correo, el
 * buscador de monedas y qué tipos se pueden elegir al editar. Sin React, para
 * poder probarla.
 */

/** Lo que acepta el backend: hasta cinco palabras de hasta 60 caracteres. */
export const MAX_KEYWORDS = 5;
export const MAX_KEYWORD_LENGTH = 60;

/**
 * Agrega lo escrito como palabra clave: sin espacios de más, sin repetir (sin
 * importar mayúsculas) y sin pasar de cinco. Si no entra, devuelve la misma lista.
 */
export function addKeyword(list: readonly string[], draft: string): string[] {
  const word = draft.trim().replace(/\s+/g, " ").slice(0, MAX_KEYWORD_LENGTH);
  if (!word || list.length >= MAX_KEYWORDS) return [...list];
  if (list.some((k) => k.toLowerCase() === word.toLowerCase())) return [...list];
  return [...list, word];
}

export function sameKeywords(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

/** Sin tildes ni mayúsculas, para que "dolar" encuentre "Dólar". */
function fold(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Las monedas cuyo código o nombre (en el idioma de la app o en inglés) contienen lo buscado. */
export function filterCurrencies<T extends { code: string; name: string; englishName?: string }>(options: readonly T[], query: string): T[] {
  const needle = fold(query.trim());
  if (!needle) return [...options];
  return options.filter((o) => [o.code, o.name, o.englishName ?? ""].some((text) => fold(text).includes(needle)));
}

const ALL_TYPES: AccountType[] = ["cash", "checking_account", "savings_account", "credit_card"];

/**
 * Los tipos que se pueden elegir. Al crear, los cuatro. Al editar, Efectivo,
 * Corriente y Ahorros se intercambian, pero entrar o salir de Tarjeta no: una
 * tarjeta lleva deuda y hasta dos monedas, y cambiarla cambia el sentido de su
 * saldo. Una tarjeta en edición no elige tipo (`[]`: fila bloqueada).
 */
export function selectableTypes(editing: boolean, currentType: string | null): AccountType[] {
  if (!editing) return ALL_TYPES;
  if (currentType === "credit_card") return [];
  return ALL_TYPES.filter((type) => type !== "credit_card");
}

/** Lo que muestra la vista previa como saldo mientras se crea: lo escrito, o cero. */
export function previewAmount(input: string): number {
  const value = Number(input.trim().replace(",", "."));
  return Number.isFinite(value) ? value : 0;
}
