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

const KNOWN_KINDS = new Set<string>(["gmail_imported", "payment_recorded", "unusual_spend", "new_login"]);

/** Solo los tipos que esta versión sabe mostrar: un aviso nuevo del backend no rompe la lista de una app vieja. */
export function knownNotifications(items: readonly UserNotification[]): UserNotification[] {
  return items.filter((item) => KNOWN_KINDS.has(item.kind) && typeof item.data === "object" && item.data !== null);
}

/** "Comida va 60% arriba de lo usual": cuánto supera lo del mes al promedio. */
export function growthPercent(amount: number, average: number): number {
  return average > 0 ? Math.round((amount / average - 1) * 100) : 0;
}

/** "Gastaste 7 veces lo usual": cuántas veces la mediana, sin decimales (el aviso sale desde 3). */
export function timesUsual(amount: number, typical: number): number {
  return typical > 0 ? Math.floor(amount / typical) : 0;
}

type Route = { pathname: string; params?: Record<string, string> };

/** Adónde lleva tocar un aviso de lo informativo. */
export function notificationRoute(item: UserNotification, now = new Date()): Route {
  switch (item.kind) {
    case "gmail_imported":
      return { pathname: "/pending-movements" };
    case "payment_recorded":
      return { pathname: "/(tabs)/debts" };
    case "new_login":
      return { pathname: "/profile" };
    case "unusual_spend": {
      const data = item.data;
      if (data.scope === "category") return { pathname: "/(tabs)/movements", params: { q: data.category, qt: String(now.getTime()) } };
      // El detalle se abre con lo que trae el aviso (el detalle no pide nada al backend), como desde Movimientos.
      return {
        pathname: "/transaction-detail",
        params: {
          id: data.transactionId,
          type: "expense",
          amount: String(data.amount),
          currency: data.currency,
          category: data.category ?? "",
          account: data.account ?? "",
          note: data.title,
          userNote: data.userNote ?? "",
          ...(data.sourceTitle ? { sourceTitle: data.sourceTitle } : {}),
          date: data.date,
        },
      };
    }
  }
}
