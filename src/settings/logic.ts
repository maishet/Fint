import type { GmailSource } from "../api/types";

/** Hasta dos iniciales del nombre para el avatar sin foto: "Cristhofer Ventura" → "CV". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "·";
  const letters = words.length === 1 ? words[0].slice(0, 1) : words[0].slice(0, 1) + words[words.length - 1].slice(0, 1);
  return letters.toLocaleUpperCase();
}

export const GMAIL_MAX_SOURCES = 3;

/** Los correos que se muestran: activos, que piden reconectar o que esperan remitentes. Los desconectados no. */
export function visibleGmailSources(sources: GmailSource[]): GmailSource[] {
  return sources.filter((s) => s.status === "active" || s.status === "error" || s.status === "needs_senders");
}

export function activeGmailCount(sources: GmailSource[]): number {
  return sources.filter((s) => s.status === "active").length;
}

export type GmailCardState = "active" | "needsSenders" | "reconnect";

export function gmailCardState(source: GmailSource): GmailCardState {
  if (source.status === "error") return "reconnect";
  if (source.status === "needs_senders" || source.senderFilters.length === 0) return "needsSenders";
  return "active";
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Agrega un remitente escrito por la persona: en minúsculas y sin espacios. Si
 * pega varios separados por coma, punto y coma o salto de línea, los agrega
 * todos. Devuelve la lista nueva o el motivo por el que no se agregó.
 */
export function addSenders(current: string[], raw: string): { senders: string[] } | { error: "invalid" | "duplicate" } {
  const tokens = raw
    .split(/[\n,;\s]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length || tokens.some((token) => !EMAIL.test(token))) return { error: "invalid" };
  const fresh = tokens.filter((token, i) => !current.includes(token) && tokens.indexOf(token) === i);
  if (!fresh.length) return { error: "duplicate" };
  return { senders: [...current, ...fresh] };
}

export function sameSenders(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((s) => set.has(s));
}

/** "hoy" o "ayer" según la fecha local de la última sincronización; si es más vieja, `date`. */
export function syncDay(iso: string, now: Date): "today" | "yesterday" | "date" {
  const at = new Date(iso);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = (start.getTime() - new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime()) / 86_400_000;
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  return "date";
}

/** Hace cuánto fue la última lectura del correo, en la unidad que se lee mejor ("hace 12 min", "hace 3 h", "ayer"). */
export type SyncAgo = { unit: "now" } | { unit: "minutes" | "hours"; count: number } | { unit: "yesterday" } | { unit: "date" };

export function syncAgo(iso: string, now: Date): SyncAgo {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return { unit: "now" };
  if (minutes < 60) return { unit: "minutes", count: minutes };
  const day = syncDay(iso, now);
  if (day === "today") return { unit: "hours", count: Math.floor(minutes / 60) };
  return day === "yesterday" ? { unit: "yesterday" } : { unit: "date" };
}

/**
 * El estado de Gmail que resume la hoja Más: sin correos conectados, alguno que pide volver a dar permiso, o
 * conectado con la lectura más reciente de todos.
 */
export type GmailSummary = { state: "none" } | { state: "reconnect" } | { state: "connected"; lastSyncAt: string | null };

export function gmailSummary(sources: GmailSource[]): GmailSummary {
  const visible = visibleGmailSources(sources);
  if (!visible.length) return { state: "none" };
  if (visible.some((s) => s.status === "error")) return { state: "reconnect" };
  const last = visible
    .map((s) => s.lastSyncAt)
    .filter((at): at is string => Boolean(at))
    .sort()
    .pop();
  return { state: "connected", lastSyncAt: last ?? null };
}
