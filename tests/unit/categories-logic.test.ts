import { describe, expect, it } from "bun:test";
import type { Transaction } from "../../src/api/types";
import { isSystemCategory, sortByUsage, usageByName, usageFromTransactions } from "../../src/categories/logic";

describe("categorías", () => {
  it("reconoce la categoría del sistema sin importar mayúsculas", () => {
    expect(isSystemCategory({ name: "Debt payment" })).toBe(true);
    expect(isSystemCategory({ name: " debt PAYMENT " })).toBe(true);
    expect(isSystemCategory({ name: "Alimentación" })).toBe(false);
  });

  it("arma el uso del mes por nombre", () => {
    const map = usageByName([{ name: "Alimentación", amount: 120, transactionCount: 4 }]);
    expect(map.get("alimentación")).toEqual({ amount: 120, count: 4 });
    expect(map.get("otros")).toBeUndefined();
  });

  it("ordena por uso del mes y deja al final las sin uso, por nombre", () => {
    const items = [
      { label: "Cine", usage: null },
      { label: "Alquiler", usage: { amount: 1450, count: 1 } },
      { label: "Bebidas", usage: null },
      { label: "Supermercado", usage: { amount: 612.4, count: 14 } },
    ];
    expect(sortByUsage(items).map((i) => i.label)).toEqual(["Alquiler", "Supermercado", "Bebidas", "Cine"]);
  });
});

describe("usageFromTransactions", () => {
  const tx = (over: Partial<Transaction>): Transaction => ({
    id: "t",
    date: "2026-09-10",
    type: "expense",
    amount: 10,
    currency: "PEN",
    category: "Educación",
    account: "A",
    ...over,
  });

  it("suma solo egresos del mes y de la moneda dada", () => {
    const map = usageFromTransactions(
      [
        tx({ amount: 65 }),
        tx({ amount: 65.5, category: "educación" }),
        tx({ amount: 20, date: "2026-08-30" }),
        tx({ amount: 40, currency: "USD" }),
        tx({ amount: 500, type: "income", category: "Sueldo" }),
      ],
      "PEN",
      "2026-09",
    );
    expect(map.get("educación")).toEqual({ amount: 130.5, count: 2 });
    expect(map.get("sueldo")).toBeUndefined();
  });

  it("suma ingresos cuando se le pide ese tipo", () => {
    const map = usageFromTransactions(
      [tx({ amount: 3000, type: "income", category: "Sueldo" }), tx({ amount: 150, type: "income", category: "sueldo" }), tx({ amount: 65 })],
      "PEN",
      "2026-09",
      "income",
    );
    expect(map.get("sueldo")).toEqual({ amount: 3150, count: 2 });
    expect(map.get("educación")).toBeUndefined();
  });
});
