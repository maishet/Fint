import { describe, expect, test } from "bun:test";
import { ACCENT_MIN_CONTRAST, categoryAccent, categoryAccentLightness, contrastRatio, hslToRgb } from "../../src/finance/categoryTint";

const WHITE: [number, number, number] = [1, 1, 1];
const DARK_CANVAS: [number, number, number] = [15 / 255, 15 / 255, 13 / 255];

describe("categoryAccent", () => {
  test("parte de hsl(H 72% 46%) en claro cuando ya llega a 3:1 (azul 220)", () => {
    expect(categoryAccent(220, "light")).toBe("hsl(220, 72%, 46%)");
  });

  test("parte de hsl(H 70% 62%) en oscuro", () => {
    expect(categoryAccent(12, "dark")).toBe("hsl(12, 70%, 62%)");
  });

  test("oscurece el amarillo en claro hasta llegar a 3:1", () => {
    expect(categoryAccentLightness(60, "light")).toBeLessThan(46);
  });

  test("todos los tonos llegan a 3:1 contra el canvas en claro y en oscuro", () => {
    for (let hue = 0; hue < 360; hue++) {
      const light = hslToRgb(hue, 72, categoryAccentLightness(hue, "light"));
      const dark = hslToRgb(hue, 70, categoryAccentLightness(hue, "dark"));
      expect(contrastRatio(light, WHITE)).toBeGreaterThanOrEqual(ACCENT_MIN_CONTRAST);
      expect(contrastRatio(dark, DARK_CANVAS)).toBeGreaterThanOrEqual(ACCENT_MIN_CONTRAST);
    }
  });
});
