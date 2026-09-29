import { describe, expect, it } from "bun:test";
import type { Transaction } from "../../src/api/types";
import { addRecent, amountQuery, applyFilters, fold, highlightParts, matches, NO_FILTERS, summarize, topAccount } from "../../src/search/logic";

const tx = (over: Partial<Transaction>): Transaction => ({
  id: over.id ?? "t",
  date: "2026-09-20",
  type: "expense",
  amount: 10,
  currency: "PEN",
  category: "Alimentación",
  account: "BCP Soles",
  ...over,
});

describe("resaltado", () => {
  it("ignora mayúsculas y tildes y conserva el texto original", () => {
    expect(fold("Alimentación ÑANDÚ")).toBe("alimentacion nandu");
    expect(highlightParts("Tambo y mercado", "tambo")).toEqual([
      { text: "Tambo", match: true },
      { text: " y mercado", match: false },
    ]);
    expect(highlightParts("Alimentación", "ACION")).toEqual([
      { text: "Aliment", match: false },
      { text: "ación", match: true },
    ]);
    expect(highlightParts("sin nada", "")).toEqual([{ text: "sin nada", match: false }]);
    expect(matches("Compras en Tambo", "tambó")).toBe(true);
    expect(matches(undefined, "x")).toBe(false);
  });
});

describe("amountQuery", () => {
  it("reconoce montos con punto, coma o símbolo", () => {
    expect(amountQuery("45.90")).toBe(45.9);
    expect(amountQuery("45,9")).toBe(45.9);
    expect(amountQuery("S/ 12")).toBe(12);
    expect(amountQuery("tambo")).toBeNull();
    expect(amountQuery("4.567")).toBeNull();
  });
});

describe("addRecent", () => {
  it("pone la nueva primero, sin repetir y hasta ocho", () => {
    expect(addRecent(["luz", "Tambo"], "tambó")).toEqual(["tambó", "luz"]);
    expect(addRecent(["a"], "  ")).toEqual(["a"]);
    expect(addRecent(["1", "2", "3", "4", "5", "6", "7", "8"], "9")).toHaveLength(8);
  });
});

describe("filtros y resumen", () => {
  const now = new Date(2026, 8, 27);
  const items = [
    tx({ id: "a", amount: 150, note: "tambo y mercado" }),
    tx({ id: "b", type: "income", amount: 40, account: "Interbank", date: "2026-08-02" }),
    tx({ id: "c", amount: 20, currency: "USD", date: "2026-07-15" }),
    tx({ id: "d", type: "transfer", amount: 99 }),
  ];

  it("filtra por tipo, mes, monto, cuenta y nota", () => {
    expect(applyFilters(items, { ...NO_FILTERS, type: "income" }, now).map((t) => t.id)).toEqual(["b"]);
    expect(applyFilters(items, { ...NO_FILTERS, thisMonth: true }, now).map((t) => t.id)).toEqual(["a", "d"]);
    expect(applyFilters(items, { ...NO_FILTERS, over: 100 }, now).map((t) => t.id)).toEqual(["a"]);
    expect(applyFilters(items, { ...NO_FILTERS, account: "Interbank" }, now).map((t) => t.id)).toEqual(["b"]);
    expect(applyFilters(items, { ...NO_FILTERS, withNote: true }, now).map((t) => t.id)).toEqual(["a"]);
    expect(topAccount(items)).toBe("BCP Soles");
  });

  it("resume sin mezclar monedas y con las barras de tres meses", () => {
    const summary = summarize(items, now);
    expect(summary.count).toBe(4);
    expect(summary.since).toEqual({ y: 2026, m: 6 });
    expect(summary.totals).toEqual([
      { currency: "PEN", value: -110 },
      { currency: "USD", value: -20 },
    ]);
    expect(summary.bars).toEqual([0, 40, 150]);
  });
});
