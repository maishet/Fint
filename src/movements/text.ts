import type { Transaction } from "../api/types";

/**
 * El texto de un movimiento en una fila: la nota de la persona y la descripción que trajo el correo, las dos si
 * existen ("Para el cumple · Yapeo enviado - Tienda Don Pepe"). Con el backend anterior, `note` (una o la otra).
 */
export function movementText(tx: Pick<Transaction, "note" | "userNote" | "sourceTitle">): string {
  if (tx.userNote === undefined && !tx.sourceTitle) return tx.note ?? "";
  const note = (tx.userNote ?? "").trim();
  const source = (tx.sourceTitle ?? "").trim();
  return [note, source && source !== note ? source : ""].filter(Boolean).join(" · ");
}
