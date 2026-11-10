import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fintPalette } from "../../src/theme/palette";

const dir = join(import.meta.dir, "..", "..", "assets", "lottie");
const MAX_TOTAL_BYTES = 300 * 1024;

type Entry = { file: string; segments: Record<string, number[]>; slots: Record<string, string> };
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as { animations: Record<string, Entry> };
const entries = Object.entries(manifest.animations);
const palettes = fintPalette as unknown as Record<"light" | "dark", Record<string, unknown>>;

function collect(node: unknown, key: string, out: unknown[] = []): unknown[] {
  if (Array.isArray(node)) node.forEach((n) => collect(n, key, out));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === key) out.push(v);
      collect(v, key, out);
    }
  }
  return out;
}

describe("animaciones Lottie", () => {
  test("pesan menos de 300 KB entre todas", () => {
    const total = entries.reduce((sum, [, e]) => sum + statSync(join(dir, e.file)).size, 0);
    expect(total).toBeLessThan(MAX_TOTAL_BYTES);
  });

  for (const [id, entry] of entries) {
    const json = JSON.parse(readFileSync(join(dir, entry.file), "utf8"));

    test(`${id}: los tramos del manifiesto son los markers del archivo`, () => {
      const markers = Object.fromEntries(json.markers.map((m: { cm: string; tm: number; dr: number }) => [m.cm, [m.tm, m.tm + m.dr]]));
      expect(markers).toEqual(entry.segments);
      for (const [from, to] of Object.values(entry.segments)) {
        expect(from).toBeGreaterThanOrEqual(json.ip);
        expect(to).toBeLessThan(json.op);
      }
    });

    test(`${id}: cada color va por un slot que existe en el tema`, () => {
      const sids = new Set(collect(json.layers, "sid") as string[]);
      expect([...sids].sort()).toEqual(Object.keys(entry.slots).sort());
      expect(Object.keys(json.slots).sort()).toEqual(Object.keys(entry.slots).sort());
      for (const token of Object.values(entry.slots)) {
        expect(typeof palettes.light[token]).toBe("string");
        expect(typeof palettes.dark[token]).toBe("string");
      }
      const colors = collect(json.layers, "c") as Array<{ sid?: string }>;
      expect(colors.every((c) => typeof c.sid === "string")).toBe(true);
    });

    test(`${id}: capas y formas llevan nombre`, () => {
      const unnamed = [...json.layers, ...collect(json.layers, "it").flat()].filter((n: { nm?: string }) => !n.nm);
      expect(unnamed).toHaveLength(0);
    });
  }
});
