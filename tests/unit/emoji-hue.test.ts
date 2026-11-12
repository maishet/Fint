import { describe, expect, test } from "bun:test";
import { categoryTint, dominantHue, EMOJI_HUE_CANVAS } from "../../src/finance/categoryTint";

function solid(r: number, g: number, b: number, a = 255): Uint8Array {
  const pixels = new Uint8Array(EMOJI_HUE_CANVAS * EMOJI_HUE_CANVAS * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = a;
  }
  return pixels;
}

describe("dominantHue", () => {
  test("naranja rgb(255,140,0) ⇒ 33", () => {
    expect(dominantHue(solid(255, 140, 0))).toBe(33);
  });

  test("rojo rgb(220,30,60) ⇒ 351", () => {
    expect(dominantHue(solid(220, 30, 60))).toBe(351);
  });

  test("azul rgb(40,90,220) ⇒ 223", () => {
    expect(dominantHue(solid(40, 90, 220))).toBe(223);
  });

  test("gris ⇒ null", () => {
    expect(dominantHue(solid(128, 128, 128))).toBeNull();
  });

  test("transparente ⇒ null", () => {
    expect(dominantHue(solid(255, 140, 0, 0))).toBeNull();
  });
});

describe("categoryTint", () => {
  test("claro ⇒ hsl(H, 90%, 93%)", () => {
    expect(categoryTint(33, "light")).toBe("hsl(33, 90%, 93%)");
  });

  test("oscuro ⇒ hsl(H, 32%, 17%)", () => {
    expect(categoryTint(223, "dark")).toBe("hsl(223, 32%, 17%)");
  });
});
