import type { Category, Transaction, TransactionType } from "../api/types";

export type CategoryUsage = { amount: number; count: number };

/** Las categorías del sistema (hoy solo "Debt payment", la de los pagos de deudas) no se eliminan. */
export function isSystemCategory(category: Pick<Category, "name">): boolean {
  return category.name.trim().toLowerCase() === "debt payment";
}

/**
 * El uso del mes por categoría, por nombre (así lo manda
 * `getDashboardExpenseCategories`). La comparación no distingue mayúsculas.
 */
export function usageByName(rows: { name: string; amount: number; transactionCount: number }[]): Map<string, CategoryUsage> {
  const map = new Map<string, CategoryUsage>();
  for (const row of rows) map.set(row.name.trim().toLowerCase(), { amount: row.amount, count: row.transactionCount });
  return map;
}

/**
 * Orden de la lista: por lo que movió en el mes, de mayor a menor; las que no
 * se usaron van al final, por nombre. `label` es el nombre visible (traducido).
 */
export function sortByUsage<T extends { label: string; usage: CategoryUsage | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ua = a.usage?.amount ?? 0;
    const ub = b.usage?.amount ?? 0;
    if (ua !== ub) return ub - ua;
    return a.label.localeCompare(b.label);
  });
}

/**
 * El uso del mes por categoría, sumado desde los movimientos: `getDashboardExpenseCategories` trae solo las seis
 * de más gasto (y nada de ingresos), así que desde la séptima diría "Sin movimientos" aunque los tenga. Solo el
 * tipo dado (egresos o ingresos), solo la moneda dada (no se suman monedas) y solo el mes `YYYY-MM`. La clave es
 * el nombre en minúsculas.
 */
export function usageFromTransactions(
  transactions: Transaction[],
  currency: string,
  month: string,
  type: TransactionType = "expense",
): Map<string, CategoryUsage> {
  const map = new Map<string, CategoryUsage>();
  for (const tx of transactions) {
    if (tx.type !== type || tx.currency !== currency || !tx.date.startsWith(month)) continue;
    const key = tx.category.trim().toLowerCase();
    const current = map.get(key) ?? { amount: 0, count: 0 };
    map.set(key, { amount: Math.round((current.amount + Math.abs(tx.amount)) * 100) / 100, count: current.count + 1 });
  }
  return map;
}
