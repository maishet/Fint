import { describe, expect, it } from "bun:test";
import type { GmailSource } from "../../src/api/types";
import { activeGmailCount, addSenders, gmailCardState, gmailSummary, initials, sameSenders, syncAgo, syncDay, visibleGmailSources } from "../../src/settings/logic";

const source = (over: Partial<GmailSource>): GmailSource => ({
  id: "s",
  emailAddress: "a@b.com",
  labelIds: ["INBOX"],
  senderFilters: ["alertas@bcp.com.pe"],
  status: "active",
  ...over,
});

describe("initials", () => {
  it("toma la primera y la última palabra", () => {
    expect(initials("Cristhofer Ventura")).toBe("CV");
    expect(initials("  maría josé  pérez ")).toBe("MP");
    expect(initials("Ana")).toBe("A");
    expect(initials("")).toBe("·");
  });
});

describe("Gmail", () => {
  it("muestra activos, con error y sin remitentes; cuenta solo los activos", () => {
    const list = [
      source({ id: "1" }),
      source({ id: "2", status: "error" }),
      source({ id: "3", status: "needs_senders" }),
      source({ id: "4", status: "disconnected" }),
    ];
    expect(visibleGmailSources(list).map((s) => s.id)).toEqual(["1", "2", "3"]);
    expect(activeGmailCount(list)).toBe(1);
  });

  it("decide el estado de la tarjeta", () => {
    expect(gmailCardState(source({}))).toBe("active");
    expect(gmailCardState(source({ status: "error" }))).toBe("reconnect");
    expect(gmailCardState(source({ status: "needs_senders" }))).toBe("needsSenders");
    expect(gmailCardState(source({ senderFilters: [] }))).toBe("needsSenders");
  });

  it("agrega remitentes en minúsculas, varios a la vez y sin repetir", () => {
    expect(addSenders([], " Alertas@BCP.com.pe ")).toEqual({ senders: ["alertas@bcp.com.pe"] });
    expect(addSenders(["a@b.com"], "c@d.com, e@f.com; c@d.com")).toEqual({ senders: ["a@b.com", "c@d.com", "e@f.com"] });
    expect(addSenders(["a@b.com"], "a@b.com")).toEqual({ error: "duplicate" });
    expect(addSenders([], "no-es-correo")).toEqual({ error: "invalid" });
    expect(addSenders([], "   ")).toEqual({ error: "invalid" });
  });

  it("compara listas sin importar el orden", () => {
    expect(sameSenders(["a@b.com", "c@d.com"], ["c@d.com", "a@b.com"])).toBe(true);
    expect(sameSenders(["a@b.com"], ["a@b.com", "c@d.com"])).toBe(false);
  });

  it("dice si la última sincronización fue hoy, ayer u otro día", () => {
    const now = new Date(2026, 8, 25, 10, 0);
    expect(syncDay(new Date(2026, 8, 25, 8, 0).toISOString(), now)).toBe("today");
    expect(syncDay(new Date(2026, 8, 24, 23, 0).toISOString(), now)).toBe("yesterday");
    expect(syncDay(new Date(2026, 8, 20).toISOString(), now)).toBe("date");
  });
});

describe("syncAgo", () => {
  const now = new Date(2026, 8, 27, 14, 30);
  it("minutos y horas del mismo día", () => {
    expect(syncAgo(new Date(2026, 8, 27, 14, 30, 20).toISOString(), now)).toEqual({ unit: "now" });
    expect(syncAgo(new Date(2026, 8, 27, 14, 18).toISOString(), now)).toEqual({ unit: "minutes", count: 12 });
    expect(syncAgo(new Date(2026, 8, 27, 9, 10).toISOString(), now)).toEqual({ unit: "hours", count: 5 });
  });
  it("ayer y antes", () => {
    expect(syncAgo(new Date(2026, 8, 26, 22, 0).toISOString(), now)).toEqual({ unit: "yesterday" });
    expect(syncAgo(new Date(2026, 8, 20, 22, 0).toISOString(), now)).toEqual({ unit: "date" });
  });
});

describe("gmailSummary", () => {
  it("sin correos visibles", () => {
    expect(gmailSummary([])).toEqual({ state: "none" });
    expect(gmailSummary([source({ status: "disconnected" })])).toEqual({ state: "none" });
  });
  it("uno que pide permiso gana", () => {
    expect(gmailSummary([source({ lastSyncAt: "2026-09-27T10:00:00Z" }), source({ id: "e", status: "error" })])).toEqual({ state: "reconnect" });
  });
  it("conectado con la lectura más reciente", () => {
    expect(
      gmailSummary([source({ lastSyncAt: "2026-09-27T10:00:00Z" }), source({ id: "b", lastSyncAt: "2026-09-27T12:00:00Z" }), source({ id: "c" })]),
    ).toEqual({ state: "connected", lastSyncAt: "2026-09-27T12:00:00Z" });
  });
});
