import type { AccountOption, Category, Transaction } from "../api/types";
import { toDateString } from "../finance/dates";
import { transactionDay } from "../home/spending";

/**
 * Lógica pura del formulario de movimiento: categorías frecuentes, notas
 * recientes, el saldo que queda, la grilla del calendario y las monedas de
 * una transferencia. Sin React, para poder probarla.
 */

export type MovementKind = "expense" | "income" | "transfer";

/** Rango de los últimos 30 días, con `to` exclusivo (mañana) como pide `/api/transactions`. */
export function last30DaysRange(today = new Date()) {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  return { from: toDateString(from), to: toDateString(to) };
}

/**
 * Las categorías más usadas del tipo en los movimientos dados (los últimos 30
 * días). Empate: la usada más recientemente. Si no alcanzan `max`, se completan
 * con las demás categorías en el orden en que llegan.
 */
export function frequentCategories(
  transactions: readonly Transaction[],
  type: "expense" | "income",
  categories: readonly Category[],
  max = 4,
): Category[] {
  const byName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]));
  const stats = new Map<string, { count: number; last: string }>();
  for (const tx of transactions) {
    if (tx.type !== type) continue;
    const key = tx.category.trim().toLowerCase();
    if (!byName.has(key)) continue;
    const prev = stats.get(key);
    stats.set(key, { count: (prev?.count ?? 0) + 1, last: prev && prev.last > tx.date ? prev.last : tx.date });
  }
  const ranked = [...stats.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].last.localeCompare(a[1].last))
    .map(([key]) => byName.get(key)!)
    .slice(0, max);
  for (const c of categories) {
    if (ranked.length >= max) break;
    if (!ranked.includes(c)) ranked.push(c);
  }
  return ranked;
}

/** Notas distintas de los movimientos, de la más reciente a la más antigua. */
export function recentNotes(transactions: readonly Transaction[], max = 6): string[] {
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  const seen = new Set<string>();
  const notes: string[] = [];
  for (const tx of sorted) {
    const note = tx.note?.trim();
    if (!note) continue;
    const key = note.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    notes.push(note);
    if (notes.length >= max) break;
  }
  return notes;
}

/** Cómo queda el saldo después del movimiento. Una transferencia se mira desde la cuenta de origen. */
export function balanceAfter(balance: number, amount: number, kind: MovementKind): number {
  const next = kind === "income" ? balance + amount : balance - amount;
  return Math.round(next * 100) / 100;
}

/** Las monedas que puede afectar una cuenta: sus saldos, o su moneda principal. */
export function accountCurrencies(account: AccountOption): string[] {
  return account.balances && account.balances.length > 0 ? account.balances.map((b) => b.currency) : [account.currency];
}

/** El saldo de una cuenta en una moneda. `null` si no se conoce. */
export function accountBalance(account: AccountOption, currency: string): number | null {
  const line = account.balances?.find((b) => b.currency === currency);
  if (line) return line.balance;
  if (account.currency === currency && typeof account.balance === "number") return account.balance;
  return null;
}

/** Las monedas que comparten dos cuentas, en el orden de la de origen. */
export function sharedCurrencies(origin: AccountOption | undefined, destination: AccountOption | undefined): string[] {
  if (!origin || !destination) return [];
  const dest = new Set(accountCurrencies(destination));
  return accountCurrencies(origin).filter((c) => dest.has(c));
}

/**
 * La grilla de un mes que empieza en lunes: `null` para los huecos antes del
 * día 1. `month` va de 0 a 11.
 */
export function monthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1).getDay(); // 0 = domingo
  const lead = (first + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  return [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)];
}

/** Los días del mes que tienen al menos un movimiento. */
export function daysWithMovements(transactions: readonly Transaction[], year: number, month: number): Set<number> {
  const days = new Set<number>();
  for (const tx of transactions) {
    const day = transactionDay(tx.date);
    if (day && day.y === year && day.m === month) days.add(day.d);
  }
  return days;
}

/** Rango `[from, to)` de un mes, para pedir sus movimientos. */
export function monthRange(year: number, month: number) {
  return { from: toDateString(new Date(year, month, 1)), to: toDateString(new Date(year, month + 1, 1)) };
}

/** "Metro Larco, Av. José Larco 1250, Miraflores" -> nombre arriba, dirección abajo. */
export function splitAddress(formattedAddress: string | null | undefined) {
  if (!formattedAddress) return { primary: null, secondary: null };
  const [primary, ...rest] = formattedAddress.split(", ");
  return { primary: primary || null, secondary: rest.join(", ") || null };
}
