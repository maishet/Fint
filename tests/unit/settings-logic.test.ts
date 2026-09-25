import { describe, expect, it } from "bun:test";
import type { GmailSource } from "../../src/api/types";
import { activeGmailCount, addSenders, gmailCardState, initials, sameSenders, syncDay, visibleGmailSources } from "../../src/settings/logic";

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
