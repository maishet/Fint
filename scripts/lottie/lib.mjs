export const FPS = 60;
export const CANVAS = 120;

export const SLOT_DEFAULTS = {
  disc: "#14172B",
  coin: "#F5F6FB",
  accent: "#8C9CFF",
  signal: "#F5BC3F",
};

export function rgba(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1].map((v) => Math.round(v * 1000) / 1000);
}

export const ease = {
  linear: { o: [0, 0], i: [1, 1] },
  in: { o: [0.55, 0], i: [0.9, 0.6] },
  out: { o: [0.2, 0.6], i: [0.4, 1] },
  inOut: { o: [0.45, 0], i: [0.35, 1] },
};

export function fixed(k) {
  return { a: 0, k };
}

export function animated(keys) {
  return {
    a: 1,
    k: keys.map(([t, value, curve = ease.inOut], idx) => {
      const s = Array.isArray(value) ? value : [value];
      if (idx === keys.length - 1) return { t, s };
      const dims = s.length;
      return {
        t,
        s,
        o: { x: Array(dims).fill(curve.o[0]), y: Array(dims).fill(curve.o[1]) },
        i: { x: Array(dims).fill(curve.i[0]), y: Array(dims).fill(curve.i[1]) },
      };
    }),
  };
}

export function slotColor(sid) {
  return { a: 0, k: rgba(SLOT_DEFAULTS[sid]), sid };
}

export function ellipse(nm, { center, size }) {
  return { ty: "el", nm, d: 1, p: center.a !== undefined ? center : fixed(center), s: size.a !== undefined ? size : fixed(size) };
}

export function fill(nm, sid, opacity = 100) {
  return { ty: "fl", nm, c: slotColor(sid), o: typeof opacity === "number" ? fixed(opacity) : opacity, r: 1, bm: 0 };
}

export function stroke(nm, sid, { width, opacity }) {
  return { ty: "st", nm, c: slotColor(sid), o: typeof opacity === "number" ? fixed(opacity) : opacity, w: fixed(width), lc: 2, lj: 2, bm: 0 };
}

function groupTransform() {
  return { ty: "tr", nm: "transform", p: fixed([0, 0]), a: fixed([0, 0]), s: fixed([100, 100]), r: fixed(0), o: fixed(100) };
}

export function group(nm, items) {
  return { ty: "gr", nm, it: [...items, groupTransform()] };
}

export function layer(nm, { index, shapes, op, anchor = [0, 0], position = [0, 0], scale = [100, 100], opacity = 100 }) {
  const pos = position.x ? { s: true, x: position.x, y: position.y } : fixed(position);
  return {
    ddd: 0,
    ind: index,
    ty: 4,
    nm,
    sr: 1,
    ks: {
      o: typeof opacity === "number" ? fixed(opacity) : opacity,
      r: fixed(0),
      p: pos,
      a: fixed(anchor),
      s: Array.isArray(scale) ? fixed(scale) : scale,
    },
    ao: 0,
    shapes,
    ip: 0,
    op,
    st: 0,
    bm: 0,
  };
}

export function composition(nm, { layers, segments }) {
  const op = Math.max(...Object.values(segments).map(([, to]) => to)) + 1;
  const sids = new Set();
  JSON.stringify(layers, (key, value) => {
    if (key === "sid") sids.add(value);
    return value;
  });
  return {
    v: "5.12.0",
    fr: FPS,
    ip: 0,
    op,
    w: CANVAS,
    h: CANVAS,
    nm,
    ddd: 0,
    assets: [],
    layers: layers.map((l) => ({ ...l, op })),
    markers: Object.entries(segments).map(([cm, [from, to]]) => ({ tm: from, cm, dr: to - from })),
    slots: Object.fromEntries([...sids].map((sid) => [sid, { p: slotColor(sid) }])),
  };
}
