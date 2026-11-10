import { animated, composition, ease, ellipse, fill, fixed, group, layer, stroke } from "./lib.mjs";

const TOP = { y: 47, size: [40, 18] };
const IMPACT = 20;
const END = 42;

export const segments = { drop: [0, END], rest: [END, END] };

export const slots = { disc: "slab", coin: "slabInk", accent: "brandSlab" };

export function build() {
  const ring = layer("anillo", {
    index: 1,
    position: [60, TOP.y],
    opacity: animated([
      [0, 0, ease.linear],
      [IMPACT, 0, ease.linear],
      [IMPACT + 1, 80, ease.out],
      [IMPACT + 18, 0, ease.linear],
    ]),
    shapes: [
      group("anillo", [
        ellipse("anillo", {
          center: [0, 0],
          size: animated([
            [0, TOP.size, ease.linear],
            [IMPACT, TOP.size, ease.out],
            [IMPACT + 18, [66, 28], ease.linear],
          ]),
        }),
        stroke("anillo", "accent", { width: 1.6, opacity: 100 }),
      ]),
    ],
  });

  const top = layer("moneda", {
    index: 2,
    position: {
      x: fixed(60),
      y: animated([
        [0, 8, ease.in],
        [IMPACT, TOP.y, ease.out],
        [IMPACT + 8, TOP.y - 3.5, ease.inOut],
        [IMPACT + 16, TOP.y, ease.linear],
      ]),
    },
    scale: animated([
      [0, [100, 100], ease.linear],
      [IMPACT - 1, [100, 100], ease.out],
      [IMPACT + 2, [112, 80], ease.out],
      [IMPACT + 8, [97, 106], ease.inOut],
      [IMPACT + 16, [100, 100], ease.linear],
    ]),
    opacity: animated([
      [0, 0, ease.out],
      [8, 100, ease.linear],
    ]),
    shapes: [group("moneda", [ellipse("moneda", { center: [0, 0], size: TOP.size }), fill("moneda", "coin")])],
  });

  const base = layer("pila", {
    index: 3,
    anchor: [60, 89],
    position: [60, 89],
    scale: animated([
      [0, [100, 100], ease.linear],
      [IMPACT, [100, 100], ease.out],
      [IMPACT + 3, [103, 93], ease.inOut],
      [IMPACT + 12, [100, 100], ease.linear],
    ]),
    shapes: [
      group("media", [ellipse("media", { center: [60, 62], size: [56, 20] }), fill("media", "coin", 78)]),
      group("base", [ellipse("base", { center: [60, 78], size: [68, 22] }), fill("base", "coin", 55)]),
    ],
  });

  const disc = layer("disco", {
    index: 4,
    shapes: [group("disco", [ellipse("disco", { center: [60, 60], size: [116, 116] }), fill("disco", "disc")])],
  });

  return composition("coin-drop", { layers: [ring, top, base, disc], segments });
}
