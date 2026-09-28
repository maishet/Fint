import type { UserNotification } from "../api/types";

export type FeedGroupKey = "today" | "week" | "earlier";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Lo informativo agrupado por día: Hoy, Esta semana (los seis días anteriores) y Antes. Grupos vacíos no salen. */
export function feedGroups(items: readonly UserNotification[], now = new Date()): Array<{ key: FeedGroupKey; items: UserNotification[] }> {
  const today = startOfDay(now);
  const weekStart = today - 6 * 86_400_000;
  const groups: Record<FeedGroupKey, UserNotification[]> = { today: [], week: [], earlier: [] };
  for (const item of items) {
    const day = startOfDay(new Date(item.createdAt));
    groups[day >= today ? "today" : day >= weekStart ? "week" : "earlier"].push(item);
  }
  return (["today", "week", "earlier"] as const).filter((key) => groups[key].length).map((key) => ({ key, items: groups[key] }));
}

/** La hora a la derecha de la fila: "10:24" hoy, "lun" esta semana, "16 set" antes. */
export function feedTime(createdAt: string, now: Date, locale: string) {
  const date = new Date(createdAt);
  const day = startOfDay(date);
  const today = startOfDay(now);
  if (day >= today) return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  const lower = (text: string) => (locale.startsWith("en") ? text : text.toLocaleLowerCase(locale));
  if (day >= today - 6 * 86_400_000) return lower(new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date).replace(".", ""));
  return lower(new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date).replace(".", ""));
}

/** "Tambo+, Uber y 3 más": hasta dos nombres y cuántos quedan. */
export function namesSummary(titles: readonly string[], count: number): { shown: string[]; rest: number } {
  const shown = titles.slice(0, 2);
  return { shown, rest: Math.max(0, count - shown.length) };
}

/** La campana: un número con lo que hay por hacer; si no hay nada, un punto si hay informativos sin leer. */
export function bellState(todo: number, unread: number): { count: number; dot: boolean } {
  return { count: todo, dot: todo === 0 && unread > 0 };
}
