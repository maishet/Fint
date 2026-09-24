import type { Transaction } from "../api/types";

/** Lo que dibuja la tarjeta Gasto del mes. Mismo formato que `spending` del contrato v2. */
export interface SpendingSeries {
  /** Día del mes de hoy (1..31). */
  today: number;
  /** Días del mes en curso: el eje x del gráfico. */
  daysInMonth: number;
  /** Gasto de cada día del mes en curso, hasta hoy inclusive. No acumulado. */
  currentDaily: number[];
  /** Gasto de cada día del mes anterior completo. No acumulado. */
  previousDaily: number[];
  /** Gastado este mes hasta hoy. */
  current: number;
  /** Gastado el mes anterior hasta el mismo día (o hasta su último día si fue más corto). */
  previousToDate: number;
  /** El mes anterior tuvo algún gasto: sin eso no hay línea punteada ni comparación. */
  hasPrevious: boolean;
}

function daysIn(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Año, mes (0-11) y día de la fecha de un movimiento, en hora local. "2026-09-18" no se corre de día. */
export function transactionDay(value: string): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (plain) return { y: Number(plain[1]), m: Number(plain[2]) - 1, d: Number(plain[3]) };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { y: date.getFullYear(), m: date.getMonth(), d: date.getDate() };
}

/** Primer día del mes anterior y hoy, en `YYYY-MM-DD`, para pedir los movimientos que alimentan la serie. */
export function spendingRange(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    from: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-01`,
    to: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  };
}

/**
 * Arma la serie de gasto diario a partir de los movimientos. Es el respaldo
 * mientras el backend no mande `spending`: solo egresos (las transferencias
 * no cuentan), solo en la moneda del resumen y, si se pasa, solo de una cuenta.
 */
export function buildSpendingSeries(
  transactions: readonly Transaction[],
  { currency, account, now = new Date() }: { currency: string; account?: string | null; now?: Date },
): SpendingSeries {
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const daysInMonth = daysIn(year, month);
  const prevDays = daysIn(prevYear, prevMonth);

  const currentDaily = new Array<number>(today).fill(0);
  const previousDaily = new Array<number>(prevDays).fill(0);

  for (const tx of transactions) {
    if (tx.type !== "expense" || tx.currency !== currency) continue;
    if (account && tx.account !== account) continue;
    const day = transactionDay(tx.date);
    if (!day) continue;
    const amount = Math.abs(Number(tx.amount) || 0);
    if (day.y === year && day.m === month && day.d <= today) currentDaily[day.d - 1] += amount;
    else if (day.y === prevYear && day.m === prevMonth) previousDaily[day.d - 1] += amount;
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const current = round(currentDaily.reduce((a, b) => a + b, 0));
  const previousToDate = round(previousDaily.slice(0, Math.min(today, prevDays)).reduce((a, b) => a + b, 0));

  return {
    today,
    daysInMonth,
    currentDaily: currentDaily.map(round),
    previousDaily: previousDaily.map(round),
    current,
    previousToDate,
    hasPrevious: previousDaily.some((v) => v > 0),
  };
}

/** Suma acumulada: el gráfico de Ritmo dibuja cuánto llevas gastado cada día, no cuánto gastaste ese día. */
export function cumulative(values: readonly number[]): number[] {
  let total = 0;
  return values.map((v) => (total = Math.round((total + v) * 100) / 100));
}

export interface CategoryShare {
  name: string;
  amount: number;
  /** Entero; los de la lista suman 100. */
  percentage: number;
  /** Índice de color 1..6. "Otros" siempre es 6. */
  color: number;
  isOther: boolean;
}

/**
 * Las cuatro categorías más grandes y el resto en "Otros". Los porcentajes se
 * reparten por el método del mayor resto, para que sumen exactamente 100.
 */
export function topCategories(
  categories: readonly { name: string; amount: number }[],
  otherLabel: string,
  max = 4,
): CategoryShare[] {
  const sorted = [...categories].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((a, c) => a + c.amount, 0);
  if (total <= 0) return [];
  const head = sorted.slice(0, max);
  const rest = sorted.slice(max).reduce((a, c) => a + c.amount, 0);
  const rows = head.map((c) => ({ name: c.name, amount: c.amount, isOther: false }));
  if (rest > 0) rows.push({ name: otherLabel, amount: rest, isOther: true });

  const exact = rows.map((r) => (r.amount / total) * 100);
  const floors = exact.map(Math.floor);
  let missing = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r);
  for (const { i } of order) {
    if (missing <= 0) break;
    floors[i] += 1;
    missing -= 1;
  }

  const colors = distinctCategoryColors(rows.filter((r) => !r.isOther).map((r) => r.name));
  return rows.map((r, i) => ({
    ...r,
    percentage: floors[i],
    color: r.isOther ? 6 : colors[i],
  }));
}

/** Color fijo de una categoría (1..5): la misma categoría tiene el mismo color en toda la app. */
export function categoryColorIndex(name: string): number {
  let hash = 0;
  for (const ch of name.trim().toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (hash % 5) + 1;
}

/** Como `categoryColorIndex`, pero sin repetir color dentro de una misma lista (porciones vecinas del donut). */
export function distinctCategoryColors(names: readonly string[]): number[] {
  const used = new Set<number>();
  return names.map((name) => {
    let color = categoryColorIndex(name);
    for (let tries = 0; used.has(color) && tries < 5; tries++) color = (color % 5) + 1;
    used.add(color);
    return color;
  });
}
