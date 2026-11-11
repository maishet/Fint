import { animated, composition, ease, ellipse, fill, fixed, group, layer, stroke } from "./lib.mjs";

export const segments = { build: [0, 54], shine: [54, 90], breathe: [90, 210] };

export const slots = { disc: "slab", discLine: "slabLine", coin: "slabInk", signal: "slabMuted" };

function coin(nm, index, { size, opacity, y, show }) {
  return layer(nm, {
    index,
    position: { x: fixed(60), y: animated(y) },
    opacity: animated(show),
    shapes: [group(nm, [ellipse(nm, { center: [0, 0], size }), fill(nm, "coin", opacity)])],
  });
}

function sparkle(nm, index, [x, y], start) {
  return layer(nm, {
    index,
    position: [x, y],
    scale: animated([
      [0, [0, 0], ease.linear],
      [start, [0, 0], ease.out],
      [start + 8, [100, 100], ease.inOut],
      [start + 18, [0, 0], ease.linear],
    ]),
    shapes: [group(nm, [ellipse(nm, { center: [0, 0], size: [7, 7] }), fill(nm, "signal")])],
  });
}

export function build() {
  const glint = layer("brillo", {
    index: 1,
    position: [60, 47],
    opacity: animated([
      [0, 0, ease.linear],
      [54, 0, ease.out],
      [62, 85, ease.inOut],
      [78, 0, ease.linear],
    ]),
    shapes: [group("brillo", [ellipse("brillo", { center: [0, 0], size: [40, 18] }), fill("brillo", "signal")])],
  });

  const top = coin("moneda", 4, {
    size: [40, 18],
    opacity: 100,
    y: [
      [0, 8, ease.in],
      [26, 8, ease.in],
      [42, 47, ease.out],
      [48, 44.5, ease.inOut],
      [54, 47, ease.linear],
      [90, 47, ease.inOut],
      [150, 44, ease.inOut],
      [210, 47],
    ],
    show: [
      [0, 0, ease.linear],
      [26, 0, ease.out],
      [32, 100],
    ],
  });

  const mid = coin("media", 5, {
    size: [56, 20],
    opacity: 78,
    y: [
      [0, 32, ease.in],
      [12, 32, ease.in],
      [28, 62, ease.out],
      [34, 59.5, ease.inOut],
      [40, 62, ease.linear],
      [90, 62, ease.inOut],
      [150, 60.5, ease.inOut],
      [210, 62],
    ],
    show: [
      [0, 0, ease.linear],
      [12, 0, ease.out],
      [18, 100],
    ],
  });

  const base = coin("base", 6, {
    size: [68, 22],
    opacity: 55,
    y: [
      [0, 48, ease.in],
      [14, 78, ease.out],
      [20, 76, ease.inOut],
      [26, 78, ease.linear],
      [90, 78, ease.inOut],
      [150, 77.4, ease.inOut],
      [210, 78],
    ],
    show: [
      [0, 0, ease.out],
      [6, 100],
    ],
  });

  const disc = layer("disco", {
    index: 7,
    shapes: [group("disco", [ellipse("disco", { center: [60, 60], size: [116, 116] }), fill("disco", "disc"), stroke("disco-borde", "discLine", { width: 2, opacity: 100 })])],
  });

  return composition("coin-stack", {
    layers: [
      glint,
      sparkle("chispa-1", 2, [33, 40], 58),
      sparkle("chispa-2", 3, [88, 33], 62),
      top,
      mid,
      base,
      sparkle("chispa-3", 8, [92, 57], 66),
      disc,
    ].map((l, i) => ({ ...l, ind: i + 1 })),
    segments,
  });
}
