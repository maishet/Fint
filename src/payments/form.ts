import type { PaymentRule } from "../api/types";

/**
 * Lógica pura del formulario de pago recurrente: las próximas fechas que se
 * muestran debajo de la primera fecha. Sin React, para poder probarla.
 */

export type Frequency = PaymentRule["frequency"];

function parse(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return { y, m: m - 1, d };
}

function format(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function lastDay(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

/**
 * El vencimiento que sigue a `due`, como lo calcula el backend (`nextDueDate`
 * en finanzas-api): semanal y quincenal suman 7 y 14 días; mensual y anual
 * vuelven al día de la primera fecha y, si el mes no lo tiene, al último día
 * (un pago del 31 vence el 30 de abril y el 28 de febrero).
 */
export function nextDue(frequency: Frequency, due: string, anchor: string): string {
  const { y, m, d } = parse(due);
  const a = parse(anchor);
  if (frequency === "weekly" || frequency === "biweekly") {
    const next = new Date(y, m, d + (frequency === "weekly" ? 7 : 14));
    return format(next.getFullYear(), next.getMonth(), next.getDate());
  }
  if (frequency === "monthly") {
    const ny = m === 11 ? y + 1 : y;
    const nm = (m + 1) % 12;
    return format(ny, nm, Math.min(a.d, lastDay(ny, nm)));
  }
  return format(y + 1, a.m, Math.min(a.d, lastDay(y + 1, a.m)));
}

/**
 * Las `count` primeras fechas del pago a partir de `start` (incluida), sin las
 * anteriores a `from` si se da. Al crear se muestran desde la primera fecha; al
 * editar un pago que empezó hace meses, desde hoy.
 */
export function upcomingDates(start: string, frequency: Frequency, count = 3, from?: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return [];
  const dates: string[] = [];
  let due = start;
  // Tope por si `from` queda muy lejos (un pago semanal de hace años): no más de mil pasos.
  for (let i = 0; i < 1000 && dates.length < count; i++) {
    if (!from || due >= from) dates.push(due);
    due = nextDue(frequency, due, start);
  }
  return dates;
}

/** El monto guardado como texto del campo: con dos decimales ("258.00"), o los que tenga si son más. */
export function amountText(value: number | null | undefined): string {
  if (value == null) return "";
  const text = String(value);
  const decimals = text.split(".")[1]?.length ?? 0;
  return decimals > 2 ? text : value.toFixed(2);
}
