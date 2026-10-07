import type { Transaction } from "../api/types";

/**
 * Los parámetros con que se abre el detalle de un movimiento (el detalle no pide nada al backend). Con el backend
 * nuevo viajan también la descripción detectada (`sourceTitle`), la nota sola (`userNote`) y la hora (`occurredAt`).
 */
export function detailParams(tx: Transaction) {
  return {
    id: tx.id,
    type: tx.type as "income" | "expense",
    amount: String(tx.amount),
    currency: tx.currency,
    category: tx.category,
    account: tx.account,
    note: tx.note ?? "",
    date: tx.date,
    ...(tx.userNote != null ? { userNote: tx.userNote } : {}),
    ...(tx.sourceTitle ? { sourceTitle: tx.sourceTitle } : {}),
    ...(tx.occurredAt ? { occurredAt: tx.occurredAt } : {}),
    ...(tx.latitude != null && tx.longitude != null
      ? { latitude: String(tx.latitude), longitude: String(tx.longitude), formattedAddress: tx.formattedAddress ?? "" }
      : {}),
  };
}
