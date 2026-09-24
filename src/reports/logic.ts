import type { Transaction } from "../api/types";
import { distinctCategoryColors, transactionDay } from "../home/spending";

/**
 * Lógica pura del tab Reportes: el rango de cada periodo (Semana, Mes, Año) y
 * cómo moverse entre ellos, la variación contra el periodo anterior, el flujo
 * por día de una semana y las filas del donut de categorías. Sin React, para
 * poder probarla.
 */

export type PeriodKind = "week" | "month" | "year";

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** El primer día del periodo que contiene `date` (la semana empieza el lunes). */
export function periodStart(kind: PeriodKind, date: Date): Date {
  if (kind === "year") return new Date(date.getFullYear(), 0, 1);
  if (kind === "month") return new Date(date.getFullYear(), date.getMonth(), 1);
  const monday = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - monday);
}

/** El periodo `delta` pasos antes (negativo) o después (positivo), por su primer día. */
export function shiftPeriod(kind: PeriodKind, start: Date, delta: number): Date {
  if (kind === "year") return new Date(start.getFullYear() + delta, 0, 1);
  if (kind === "month") return new Date(start.getFullYear(), start.getMonth() + delta, 1);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7 * delta);
}

/** `from` incluido y `to` excluido, como los pide el backend. */
export function periodRange(kind: PeriodKind, start: Date): { from: string; to: string } {
  return { from: iso(start), to: iso(shiftPeriod(kind, start, 1)) };
}

/** El periodo que contiene hoy: no se puede avanzar más allá. */
export function isCurrentPeriod(kind: PeriodKind, start: Date, today: Date): boolean {
  return periodStart(kind, today).getTime() === start.getTime();
}

/** Columnas del flujo: por semana en un mes, por mes en un año. La semana se arma por día en la app. */
export function periodGrouping(kind: PeriodKind): "week" | "month" {
  return kind === "year" ? "month" : "week";
}

/**
 * Variación contra el periodo anterior, en % con un decimal. `null` si antes
 * era cero y ahora no (se dice "nueva", no un porcentaje infinito); 0 si no cambió.
 */
export function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export interface FlowColumn {
  /** Primer día de la columna (fecha simple). */
  start: string;
  income: number;
  expenses: number;
}

/**
 * Los siete días de la semana que empieza en `monday`, con lo que entró y salió
 * en `currency`. Las transferencias no cuentan: no son ingreso ni gasto.
 */
export function dailyFlow(transactions: readonly Transaction[], monday: Date, currency: string): FlowColumn[] {
  const days = Array.from({ length: 7 }, (_, i) => ({
    start: iso(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)),
    income: 0,
    expenses: 0,
  }));
  for (const tx of transactions) {
    if (tx.currency !== currency || (tx.type !== "income" && tx.type !== "expense")) continue;
    const d = transactionDay(tx.date);
    if (!d) continue;
    const day = days.find((x) => x.start === iso(new Date(d.y, d.m, d.d)));
    if (!day) continue;
    if (tx.type === "income") day.income += tx.amount;
    else day.expenses += tx.amount;
  }
  return days.map((d) => ({ ...d, income: Math.round(d.income * 100) / 100, expenses: Math.round(d.expenses * 100) / 100 }));
}

/**
 * Las columnas del flujo de un mes (semanas que empiezan el lunes) o de un año
 * (meses), con las que el backend no manda en cero: una semana sin movimientos
 * también es una columna. En el periodo actual llegan hasta la de hoy. Si el
 * backend agrupara con otro inicio de semana, se usa su serie tal cual.
 */
export function fillSeries(
  kind: "month" | "year",
  start: Date,
  series: readonly { period: string; income: number; expenses: number }[],
  today: Date,
): FlowColumn[] {
  const end = shiftPeriod(kind, start, 1);
  const limit = isCurrentPeriod(kind, start, today) ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1) : end;
  const buckets: string[] = [];
  for (let d = kind === "year" ? start : periodStart("week", start); d < limit; d = kind === "year" ? shiftPeriod("month", d, 1) : shiftPeriod("week", d, 1)) {
    buckets.push(iso(d));
  }
  const byKey = new Map(series.map((s) => [s.period.slice(0, 10), s]));
  if ([...byKey.keys()].some((key) => !buckets.includes(key))) {
    return series.map((s) => ({ start: s.period.slice(0, 10), income: s.income, expenses: s.expenses }));
  }
  return buckets.map((key) => ({ start: key, income: byKey.get(key)?.income ?? 0, expenses: byKey.get(key)?.expenses ?? 0 }));
}

export interface CategoryRow {
  /** Nombre guardado (para buscar sus movimientos); en "Otros", `null`. */
  key: string | null;
  label: string;
  amount: number;
  /** El porcentaje que manda el servidor (en "Otros", la suma de los agrupados). */
  percentage: number;
  change: number | null;
  /** Índice de color 1..6, en el mismo orden siempre para la misma lista; "Otros" es 6. */
  color: number;
}

/**
 * Las filas del donut: todas las categorías con su porcentaje y su variación;
 * a partir de la séptima, el resto se agrupa en "Otros". Los colores salen del
 * nombre, igual que en el Inicio, para que una categoría tenga siempre el mismo.
 */
export function categoryRows(
  categories: readonly { name: string; label: string; amount: number; percentage: number; previousAmount: number; changePercentage: number | null }[],
  otherLabel: string,
): CategoryRow[] {
  const sorted = [...categories].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const head = sorted.length > 6 ? sorted.slice(0, 5) : sorted;
  const rest = sorted.length > 6 ? sorted.slice(5) : [];
  // Los nombres dan cinco colores; con seis categorías la sexta (la que repetiría) toma `chart-6`.
  const colors = distinctCategoryColors(head.map((c) => c.label)).map((color, i, all) => (all.indexOf(color) < i ? 6 : color));
  const rows: CategoryRow[] = head.map((c, i) => ({
    key: c.name,
    label: c.label,
    amount: c.amount,
    percentage: c.percentage,
    change: c.changePercentage,
    color: colors[i],
  }));
  if (rest.length > 0) {
    const amount = Math.round(rest.reduce((a, c) => a + c.amount, 0) * 100) / 100;
    const previous = rest.reduce((a, c) => a + c.previousAmount, 0);
    rows.push({
      key: null,
      label: otherLabel,
      amount,
      percentage: Math.round(rest.reduce((a, c) => a + c.percentage, 0) * 10) / 10,
      change: changePercent(amount, previous),
      color: 6,
    });
  }
  return rows;
}
