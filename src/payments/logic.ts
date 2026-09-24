import type { PaymentOccurrence } from "../api/types";
import { parseDateString } from "../finance/dates";

/**
 * Lógica pura del tab Pagos: juntar los períodos atrasados de una misma regla,
 * repartir los pendientes en Vencido / Esta semana / Más adelante, el resumen
 * del mes por moneda y el texto de cada vencimiento. Sin React, para poder
 * probarla.
 */

export type PendingItem =
  | { kind: "single"; occurrence: PaymentOccurrence }
  | { kind: "group"; ruleId: string; periods: PaymentOccurrence[] };

/** El pago que representa la fila: el único o el período más antiguo del grupo. */
export function leadOccurrence(item: PendingItem): PaymentOccurrence {
  return item.kind === "group" ? item.periods[0] : item.occurrence;
}

/**
 * Los pendientes de una misma regla con más de un período abierto van en una
 * sola fila (el más antiguo primero). Todo ordenado por vencimiento; sin fecha, al final.
 */
export function buildPendingItems(occurrences: readonly PaymentOccurrence[]): PendingItem[] {
  const byRule = new Map<string, PaymentOccurrence[]>();
  const standalone: PaymentOccurrence[] = [];
  for (const occurrence of occurrences) {
    if (!occurrence.ruleId) {
      standalone.push(occurrence);
      continue;
    }
    byRule.set(occurrence.ruleId, [...(byRule.get(occurrence.ruleId) ?? []), occurrence]);
  }
  const items: PendingItem[] = [];
  for (const [ruleId, periods] of byRule) {
    const sorted = [...periods].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
    items.push(sorted.length > 1 ? { kind: "group", ruleId, periods: sorted } : { kind: "single", occurrence: sorted[0] });
  }
  for (const occurrence of standalone) items.push({ kind: "single", occurrence });
  return items.sort((a, b) => {
    const dueA = leadOccurrence(a).dueDate;
    const dueB = leadOccurrence(b).dueDate;
    if (!dueA) return 1;
    if (!dueB) return -1;
    return dueA.localeCompare(dueB);
  });
}

export type PendingGroupKey = "overdue" | "week" | "later";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Días desde hoy hasta la fecha (negativo si ya pasó); `null` sin fecha. */
export function daysUntil(dueDate: string | null | undefined, today: Date): number | null {
  const due = parseDateString(dueDate);
  if (!due) return null;
  return Math.round((startOfDay(due).getTime() - startOfDay(today).getTime()) / 86_400_000);
}

/** Días que faltan para el domingo de esta semana (la semana empieza el lunes). */
function daysToSunday(today: Date) {
  return (7 - today.getDay()) % 7;
}

/**
 * Vencido (antes de hoy), Esta semana (de hoy al domingo) y Más adelante (el
 * resto, también lo que no tiene fecha). Un grupo vacío no aparece.
 */
export function groupPending(items: readonly PendingItem[], today: Date): { key: PendingGroupKey; items: PendingItem[] }[] {
  const groups: Record<PendingGroupKey, PendingItem[]> = { overdue: [], week: [], later: [] };
  const weekEnd = daysToSunday(today);
  for (const item of items) {
    const days = daysUntil(leadOccurrence(item).dueDate, today);
    if (days !== null && days < 0) groups.overdue.push(item);
    else if (days !== null && days <= weekEnd) groups.week.push(item);
    else groups.later.push(item);
  }
  return (["overdue", "week", "later"] as const).filter((key) => groups[key].length > 0).map((key) => ({ key, items: groups[key] }));
}

export type DueText =
  | { kind: "none" }
  | { kind: "overdue"; days: number }
  | { kind: "today" }
  | { kind: "tomorrow" }
  /** Dentro de esta semana: "Viernes 20". */
  | { kind: "weekday"; date: Date }
  /** Más adelante: "28 set". */
  | { kind: "date"; date: Date };

export function dueText(dueDate: string | null | undefined, today: Date): DueText {
  const days = daysUntil(dueDate, today);
  const date = parseDateString(dueDate);
  if (days === null || !date) return { kind: "none" };
  if (days < 0) return { kind: "overdue", days: -days };
  if (days === 0) return { kind: "today" };
  if (days === 1) return { kind: "tomorrow" };
  if (days <= daysToSunday(today)) return { kind: "weekday", date };
  return { kind: "date", date };
}

/** Lo pagado de un pendiente con pago parcial, de 0 a 1; `null` si no hay pago parcial. */
export function partialProgress(occurrence: PaymentOccurrence): number | null {
  const remaining = occurrence.remainingAmount ?? 0;
  if (occurrence.paidAmount <= 0 || remaining <= 0) return null;
  return occurrence.paidAmount / (occurrence.paidAmount + remaining);
}

export interface MonthSummary {
  currency: string;
  /** Lo que falta pagar del mes, incluidos los atrasos de meses anteriores. */
  remaining: number;
  /** Lo pagado de esos mismos pagos. */
  paid: number;
  total: number;
}

function sameMonth(date: Date | null, today: Date) {
  return date !== null && date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * El resumen del mes por moneda (nunca se suman monedas distintas). Entran los
 * pendientes que vencen hasta fin de mes (los atrasados también) y los pagados
 * que vencían este mes o que se pagaron este mes; un pago parcial reparte su
 * monto entre pagado y falta. Ordenado por la moneda del primer pendiente.
 */
export function monthSummaries(open: readonly PaymentOccurrence[], paid: readonly PaymentOccurrence[], today: Date): MonthSummary[] {
  const byCurrency = new Map<string, MonthSummary>();
  const entry = (currency: string) => {
    let summary = byCurrency.get(currency);
    if (!summary) {
      summary = { currency, remaining: 0, paid: 0, total: 0 };
      byCurrency.set(currency, summary);
    }
    return summary;
  };
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const sortedOpen = [...open].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  for (const occurrence of sortedOpen) {
    const due = parseDateString(occurrence.dueDate);
    if (!due || startOfDay(due) > monthEnd) continue;
    const summary = entry(occurrence.currency);
    summary.remaining += occurrence.remainingAmount ?? 0;
    summary.paid += occurrence.paidAmount;
  }
  for (const occurrence of paid) {
    if (!sameMonth(parseDateString(occurrence.dueDate), today) && !sameMonth(parseDateString(occurrence.paidAt), today)) continue;
    entry(occurrence.currency).paid += occurrence.totalAmount ?? occurrence.paidAmount;
  }
  return [...byCurrency.values()].map((s) => ({ ...s, remaining: round(s.remaining), paid: round(s.paid), total: round(s.remaining + s.paid) }));
}

export interface HistoryGroup {
  key: string;
  date: Date | null;
  items: PaymentOccurrence[];
}

/** El historial por mes de pago, del más reciente al más antiguo. */
export function groupHistory(occurrences: readonly PaymentOccurrence[]): HistoryGroup[] {
  const sorted = [...occurrences].sort((a, b) => (b.paidAt ?? b.dueDate ?? "").localeCompare(a.paidAt ?? a.dueDate ?? ""));
  const groups: HistoryGroup[] = [];
  for (const occurrence of sorted) {
    const date = parseDateString(occurrence.paidAt ?? occurrence.dueDate);
    const key = date ? `${date.getFullYear()}-${date.getMonth()}` : "unknown";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(occurrence);
    else groups.push({ key, date: date ? new Date(date.getFullYear(), date.getMonth(), 1) : null, items: [occurrence] });
  }
  return groups;
}
