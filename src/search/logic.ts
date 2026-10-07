import type { Transaction } from "../api/types";
import { transactionDay } from "../home/spending";

/**
 * Lógica pura de la búsqueda global: el resaltado de la coincidencia (sin mayúsculas ni tildes), el monto escrito,
 * las búsquedas recientes, los filtros rápidos y el resumen de los resultados. Sin React, para poder probarla.
 */

/** Un carácter sin tilde y en minúscula; "Ñ" queda "n". Siempre un carácter por carácter, para ubicar el tramo. */
function foldChar(c: string): string {
  const folded = c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return folded.length === 1 ? folded : c.toLowerCase().slice(0, 1) || c;
}

export function fold(text: string): string {
  return [...text].map(foldChar).join("");
}

/** El texto partido en tramos, con `match` en los que coinciden con la búsqueda (ignora mayúsculas y tildes). */
export function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  const needle = fold(query.trim());
  const chars = [...text];
  if (!needle) return [{ text, match: false }];
  const hay = chars.map(foldChar).join("");
  const parts: { text: string; match: boolean }[] = [];
  let from = 0;
  let at = hay.indexOf(needle);
  while (at !== -1) {
    if (at > from) parts.push({ text: chars.slice(from, at).join(""), match: false });
    parts.push({ text: chars.slice(at, at + needle.length).join(""), match: true });
    from = at + needle.length;
    at = hay.indexOf(needle, from);
  }
  if (from < chars.length) parts.push({ text: chars.slice(from).join(""), match: false });
  return parts.length ? parts : [{ text, match: false }];
}

export function matches(text: string | null | undefined, query: string): boolean {
  const needle = fold(query.trim());
  return Boolean(text && needle && fold(text).includes(needle));
}

/** "45.90", "45,9" o "S/ 45.90": el monto que se busca, o `null` si el texto no es un número. */
export function amountQuery(query: string): number | null {
  const clean = query.trim().replace(/^[^\d-]*/, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Number(clean);
}

export const MAX_RECENT = 8;

/** Agrega una búsqueda a las recientes: primero la nueva, sin repetir (sin tildes ni mayúsculas), hasta 8. */
export function addRecent(recent: readonly string[], query: string): string[] {
  const text = query.trim();
  if (!text) return [...recent];
  const key = fold(text);
  return [text, ...recent.filter((r) => fold(r) !== key)].slice(0, MAX_RECENT);
}

export interface SearchFilters {
  type: "expense" | "income" | null;
  thisMonth: boolean;
  /** Más de este monto (en la moneda de cada movimiento). */
  over: number | null;
  account: string | null;
  withNote: boolean;
}

export const NO_FILTERS: SearchFilters = { type: null, thisMonth: false, over: null, account: null, withNote: false };

export function applyFilters(items: readonly Transaction[], filters: SearchFilters, now = new Date()): Transaction[] {
  return items.filter((tx) => {
    if (filters.type && tx.type !== filters.type) return false;
    if (filters.over != null && tx.amount <= filters.over) return false;
    if (filters.account && tx.account !== filters.account) return false;
    if (filters.withNote && !tx.note?.trim()) return false;
    if (filters.thisMonth) {
      const day = transactionDay(tx.date);
      if (!day || day.y !== now.getFullYear() || day.m !== now.getMonth()) return false;
    }
    return true;
  });
}

/** La cuenta que más aparece en los resultados: el filtro rápido por cuenta. */
export function topAccount(items: readonly Transaction[]): string | null {
  const counts = new Map<string, number>();
  for (const tx of items) counts.set(tx.account, (counts.get(tx.account) ?? 0) + 1);
  let best: string | null = null;
  for (const [account, count] of counts) if (best === null || count > counts.get(best)!) best = account;
  return best;
}

export interface SearchSummary {
  count: number;
  /** El día más antiguo de los resultados. */
  since: { y: number; m: number } | null;
  /** El neto por moneda (ingresos suman, egresos restan, transferencias no cuentan), sin mezclar monedas. */
  totals: { currency: string; value: number }[];
  /** Lo de los últimos tres meses en la moneda principal, del más antiguo al actual, en valor absoluto. */
  bars: number[];
}

export function summarize(items: readonly Transaction[], now = new Date()): SearchSummary {
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  let since: { y: number; m: number } | null = null;
  for (const tx of items) {
    const day = transactionDay(tx.date);
    if (day && (!since || day.y < since.y || (day.y === since.y && day.m < since.m))) since = { y: day.y, m: day.m };
    counts.set(tx.currency, (counts.get(tx.currency) ?? 0) + 1);
    if (tx.type === "transfer") continue;
    const signed = tx.type === "income" ? tx.amount : -tx.amount;
    totals.set(tx.currency, Math.round(((totals.get(tx.currency) ?? 0) + signed) * 100) / 100);
  }
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([currency]) => currency);
  const main = ordered[0] ?? null;
  const bars = [2, 1, 0].map((back) => {
    const month = new Date(now.getFullYear(), now.getMonth() - back, 1);
    let sum = 0;
    for (const tx of items) {
      if (tx.currency !== main || tx.type === "transfer") continue;
      const day = transactionDay(tx.date);
      if (day && day.y === month.getFullYear() && day.m === month.getMonth()) sum += tx.amount;
    }
    return Math.round(sum * 100) / 100;
  });
  return {
    count: items.length,
    since,
    totals: ordered.filter((c) => totals.has(c)).map((currency) => ({ currency, value: totals.get(currency)! })),
    bars,
  };
}
