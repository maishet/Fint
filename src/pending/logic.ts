import type { PaymentOccurrence, PendingMovementCard, TransactionType } from "../api/types";

/**
 * Lógica pura de Por revisar: qué pendientes se confirman desde la lista, los
 * pagos con los que coincide un pendiente y la etiqueta de cuándo se detectó.
 * Sin React, para poder probarla.
 */

/** Tiene todo para registrarse desde la lista (salvo la categoría, que se elige ahí): cuenta, tipo, monto y moneda de la cuenta. */
export function canConfirmFromList(item: PendingMovementCard): boolean {
  return Boolean(
    !item.transfer &&
      item.accountSuggestion &&
      item.type &&
      item.amount !== null &&
      item.currency &&
      !item.requiresReview &&
      item.accountSuggestion.currency === item.currency,
  );
}

/** Una transferencia con las dos cuentas reconocidas se confirma desde la lista. */
export function isMatchedTransfer(item: PendingMovementCard): boolean {
  return Boolean(item.transfer?.originMatch && item.transfer.destinationMatch && item.amount !== null && item.currency);
}

/** Los pagos abiertos a los que se puede aplicar un egreso: misma moneda, monto confirmado y saldo suficiente. */
export function compatibleOccurrences(
  occurrences: readonly PaymentOccurrence[],
  item: { type: TransactionType | null; amount: number | null; currency: string | null },
): PaymentOccurrence[] {
  if (item.type !== "expense" || item.amount === null || !item.currency) return [];
  return occurrences.filter(
    (o) => o.currency === item.currency && o.amountStatus === "confirmed" && (o.remainingAmount ?? 0) >= item.amount!,
  );
}

/**
 * El pago con el que "coincide" un pendiente, para nombrarlo en la tarjeta: el
 * que tiene pendiente exactamente ese monto (si hay varios, el que vence antes).
 * Solo por tener saldo suficiente no coincide: aplicar un egreso a cualquier
 * pago compatible queda en la revisión. No se aplica solo: la persona elige
 * "Aplicar a pago".
 */
export function matchingOccurrence(candidates: readonly PaymentOccurrence[], amount: number | null): PaymentOccurrence | null {
  if (amount === null) return null;
  const exact = candidates.filter((o) => Math.abs((o.remainingAmount ?? 0) - amount) < 0.005);
  return [...exact].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))[0] ?? null;
}

/** Cuándo se detectó: hoy (con la hora), ayer o la fecha. */
export function detectedWhen(detectedAt: string, now: Date): { day: "today" | "yesterday" | "date"; date: Date } {
  const date = new Date(detectedAt);
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((start(now) - start(date)) / 86_400_000);
  return { day: diff === 0 ? "today" : diff === 1 ? "yesterday" : "date", date };
}
