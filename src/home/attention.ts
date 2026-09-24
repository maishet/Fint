import type { PaymentOccurrence } from "../api/types";
import { transactionDay } from "./spending";

export type AttentionKind = "overdue" | "due_today" | "due_soon" | "review";

/** Un aviso del Inicio. Mismo formato que `attention[]` del contrato v2. */
export interface AttentionItem {
  key: string;
  kind: AttentionKind;
  title: string;
  amount: number | null;
  currency: string | null;
  dueDate: string | null;
  /** Días hasta el vencimiento (negativo si ya venció). */
  days: number | null;
  /** Solo para `review`. */
  count: number | null;
  occurrenceId: string | null;
}

const SOON_DAYS = 7;
const RANK: Record<AttentionKind, number> = { overdue: 0, due_today: 1, due_soon: 2, review: 3 };

function daysUntil(value: string | null, now: Date): number | null {
  const day = value ? transactionDay(value) : null;
  if (!day) return null;
  const due = new Date(day.y, day.m, day.d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((due - today) / 86_400_000);
}

/**
 * Arma los avisos en el cliente mientras el backend no mande `attention[]`:
 * lo vencido primero, después lo que vence hoy, después los próximos siete
 * días, y los movimientos por revisar al final. Los pagos con débito
 * automático no entran: no hay nada que hacer con ellos.
 */
export function buildAttention(
  occurrences: readonly PaymentOccurrence[],
  pendingCount: number,
  now = new Date(),
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const o of occurrences) {
    if (o.paymentStatus === "paid" || o.autoPayEnabled || o.kind !== "fixed_payment") continue;
    const days = daysUntil(o.dueDate, now);
    let kind: AttentionKind | null = null;
    if (o.temporalStatus === "overdue" || (days !== null && days < 0)) kind = "overdue";
    else if (o.temporalStatus === "due_today" || days === 0) kind = "due_today";
    else if (days !== null && days <= SOON_DAYS) kind = "due_soon";
    if (!kind) continue;
    items.push({
      key: `occ-${o.id}`,
      kind,
      title: o.title,
      amount: o.remainingAmount ?? o.totalAmount,
      currency: o.currency,
      dueDate: o.dueDate,
      days,
      count: null,
      occurrenceId: o.id,
    });
  }

  items.sort((a, b) => RANK[a.kind] - RANK[b.kind] || (a.days ?? 0) - (b.days ?? 0));

  if (pendingCount > 0) {
    items.push({
      key: "review",
      kind: "review",
      title: "",
      amount: null,
      currency: null,
      dueDate: null,
      days: null,
      count: pendingCount,
      occurrenceId: null,
    });
  }

  return items;
}

/** El próximo vencimiento que no entra en los avisos, para la línea tranquila de "todo al día". */
export function nextDue(occurrences: readonly PaymentOccurrence[], now = new Date()): PaymentOccurrence | null {
  return (
    [...occurrences]
      .filter((o) => o.paymentStatus !== "paid" && o.kind === "fixed_payment" && (daysUntil(o.dueDate, now) ?? -1) >= 0)
      .sort((a, b) => (daysUntil(a.dueDate, now) ?? 0) - (daysUntil(b.dueDate, now) ?? 0))[0] ?? null
  );
}
