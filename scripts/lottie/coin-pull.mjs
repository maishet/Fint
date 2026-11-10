import { animated, composition, ease, ellipse, fill, fixed, group, layer } from "./lib.mjs";

export const segments = { pull: [0, 40], spin: [40, 80] };

export const slots = { coin: "slabInk" };

function coin(nm, index, { size, opacity, y, scale }) {
  return layer(nm, {
    index,
    position: { x: fixed(60), y: Array.isArray(y) ? animated(y) : fixed(y) },
    opacity: animated([
      [0, 0, ease.linear],
      [12, 100],
    ]),
    scale: scale ? animated(scale) : [100, 100],
    shapes: [group(nm, [ellipse(nm, { center: [0, 0], size }), fill(nm, "coin", opacity)])],
  });
}

export function build() {
  const top = coin("moneda", 1, {
    size: [40, 18],
    opacity: 100,
    y: [
      [0, 47, ease.linear],
      [40, 28],
    ],
    scale: [
      [0, [100, 100], ease.linear],
      [40, [100, 100], ease.inOut],
      [50, [6, 100], ease.inOut],
      [60, [100, 100], ease.inOut],
      [70, [6, 100], ease.inOut],
      [80, [100, 100]],
    ],
  });
  const mid = coin("media", 2, {
    size: [56, 20],
    opacity: 78,
    y: [
      [0, 62, ease.linear],
      [40, 56],
    ],
  });
  const base = coin("base", 3, { size: [68, 22], opacity: 55, y: 78 });
  return composition("coin-pull", { layers: [top, mid, base], segments });
}
