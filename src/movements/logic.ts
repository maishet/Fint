import type { Transaction } from "../api/types";
import { transactionDay } from "../home/spending";

/**
 * Lógica pura del tab Movimientos: juntar las dos patas de una transferencia,
 * filtrar por tipo y armar la lista plana con un encabezado por día (para
 * `FlashList` con encabezados pegajosos). Sin React, para poder probarla.
 */

export type MovementFilter = "all" | "expense" | "income" | "transfer";

export type MovementItem =
  | { kind: "movement"; movement: Transaction }
  | {
      kind: "transfer";
      transferGroupId: string;
      date: string;
      amount: number;
      currency: string;
      origin: Transaction;
      destination: Transaction;
    };

/** Una transferencia llega como dos movimientos (origen y destino); en la lista va una sola fila. */
export function groupTransfers(movements: readonly Transaction[]): MovementItem[] {
  const legs = new Map<string, Transaction[]>();
  for (const m of movements) {
    if (m.type === "transfer" && m.transferGroupId) legs.set(m.transferGroupId, [...(legs.get(m.transferGroupId) ?? []), m]);
  }
  const items: MovementItem[] = [];
  const seen = new Set<string>();
  for (const m of movements) {
    if (m.type === "transfer" && m.transferGroupId) {
      if (seen.has(m.transferGroupId)) continue;
      const group = legs.get(m.transferGroupId) ?? [];
      const origin = group.find((x) => x.transferDirection === "origin");
      const destination = group.find((x) => x.transferDirection === "destination");
      if (origin && destination) {
        seen.add(m.transferGroupId);
        items.push({
          kind: "transfer",
          transferGroupId: m.transferGroupId,
          date: origin.date,
          amount: origin.amount,
          currency: origin.currency,
          origin,
          destination,
        });
        continue;
      }
    }
    items.push({ kind: "movement", movement: m });
  }
  return items;
}

export function itemType(item: MovementItem): "expense" | "income" | "transfer" {
  if (item.kind === "transfer") return "transfer";
  return item.movement.type === "income" ? "income" : item.movement.type === "transfer" ? "transfer" : "expense";
}

export function itemDate(item: MovementItem) {
  return item.kind === "transfer" ? item.date : item.movement.date;
}

export function itemKey(item: MovementItem) {
  return item.kind === "transfer" ? `t-${item.transferGroupId}` : item.movement.id;
}

/** Mientras el backend no filtre por tipo, se filtra sobre las páginas cargadas. */
export function filterItems(items: readonly MovementItem[], filter: MovementFilter): MovementItem[] {
  return filter === "all" ? [...items] : items.filter((item) => itemType(item) === filter);
}

/** Las monedas de una fila: una transferencia entre monedas distintas pertenece a las dos. */
export function itemCurrencies(item: MovementItem): string[] {
  if (item.kind === "movement") return [item.movement.currency];
  return item.origin.currency === item.destination.currency ? [item.origin.currency] : [item.origin.currency, item.destination.currency];
}

/** Solo las filas en la moneda elegida: nunca se mezclan monedas en la lista. */
export function filterByCurrency(items: readonly MovementItem[], currency: string): MovementItem[] {
  return items.filter((item) => itemCurrencies(item).includes(currency));
}

/** Las monedas del mes: las del resumen primero (en su orden) y luego las que solo aparecen en la lista. */
export function monthCurrencies(summaryCurrencies: readonly string[], items: readonly MovementItem[]): string[] {
  return [...new Set([...summaryCurrencies, ...items.flatMap(itemCurrencies)])];
}

/** Los últimos `count` meses hasta el de `today`, del más antiguo al actual (primer día de cada mes). */
export function recentMonths(today: Date, count = 6): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(today.getFullYear(), today.getMonth() - (count - 1 - i), 1));
}

/** "2026-09-18" del día del movimiento (acepta fecha simple o ISO). */
export function dayKey(date: string): string | null {
  const d = transactionDay(date);
  return d ? `${d.y}-${String(d.m + 1).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : null;
}

/**
 * El neto de un día por moneda: ingresos suman, egresos restan, transferencias
 * no cuentan (no cambian el patrimonio). Nunca se mezclan monedas.
 */
export function netByCurrency(items: readonly MovementItem[]): Map<string, number> {
  const net = new Map<string, number>();
  for (const item of items) {
    const type = itemType(item);
    if (type === "transfer" || item.kind !== "movement") continue;
    const { currency, amount } = item.movement;
    const signed = type === "income" ? amount : -amount;
    net.set(currency, Math.round(((net.get(currency) ?? 0) + signed) * 100) / 100);
  }
  return net;
}

export type ListEntry =
  | { type: "day"; key: string; day: string; net: { currency: string; value: number } | null }
  | { type: "row"; key: string; item: MovementItem; first: boolean; last: boolean };

/**
 * La lista plana: un encabezado por día y sus filas, en el orden en que llegan
 * (el servidor ya ordena del más reciente al más antiguo). Cada fila sabe si es
 * la primera o la última de su día, para dibujar el grupo como una tarjeta.
 * El neto del encabezado va en `currency` si el día tiene movimientos en ella;
 * si no, en la primera moneda del día.
 */
export function buildEntries(items: readonly MovementItem[], currency: string): ListEntry[] {
  const days: { day: string; rows: MovementItem[] }[] = [];
  for (const item of items) {
    const day = dayKey(itemDate(item)) ?? "?";
    const last = days[days.length - 1];
    if (last && last.day === day) last.rows.push(item);
    else days.push({ day, rows: [item] });
  }
  const entries: ListEntry[] = [];
  for (const { day, rows } of days) {
    const nets = netByCurrency(rows);
    const pick = nets.has(currency) ? currency : ([...nets.keys()][0] ?? null);
    entries.push({ type: "day", key: `d-${day}`, day, net: pick ? { currency: pick, value: nets.get(pick)! } : null });
    rows.forEach((item, i) => entries.push({ type: "row", key: itemKey(item), item, first: i === 0, last: i === rows.length - 1 }));
  }
  return entries;
}

/** Los índices de los encabezados de día, para dejarlos pegados arriba. */
export function stickyIndices(entries: readonly ListEntry[]): number[] {
  return entries.flatMap((e, i) => (e.type === "day" ? [i] : []));
}
