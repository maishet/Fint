import { fintPalette } from "../theme/palette";

export type TintScheme = "light" | "dark";

const EMOJI_HUE: Record<string, number> = {
  "🍔": 32, "🍕": 28, "🍽️": 30, "🍴": 30, "🥗": 100, "🍎": 0, "☕": 25, "🍺": 40, "🍷": 345,
  "🛒": 210, "🛍️": 330, "👕": 210, "👟": 0, "💄": 340,
  "🚕": 48, "🚗": 0, "🚌": 45, "⛽": 0, "🚇": 210, "✈️": 205, "🛵": 0,
  "🏠": 12, "🏡": 120, "💡": 50, "💧": 200, "🔥": 20, "📱": 220, "🌐": 205, "📺": 220,
  "💊": 350, "🏥": 0, "🩺": 210, "🦷": 200, "🏋️": 210, "🧘": 280,
  "🎮": 265, "🎬": 0, "🎵": 280, "📚": 25, "🎓": 230, "🎁": 340, "🎉": 320,
  "🐶": 35, "🐱": 35, "👶": 30, "💼": 30, "💰": 48, "💵": 120, "🏦": 210, "💳": 220, "📈": 140,
  "✂️": 0, "🧾": 40, "🔧": 210, "🧹": 30, "⚽": 0,
};

function hueFromName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function categoryHue(emoji: string | null | undefined, name: string): number {
  const key = emoji?.trim();
  if (key && EMOJI_HUE[key] !== undefined) return EMOJI_HUE[key];
  return hueFromName(name);
}

export function categoryTint(hue: number, scheme: TintScheme): string {
  return scheme === "light" ? `hsl(${hue}, 90%, 93%)` : `hsl(${hue}, 32%, 17%)`;
}

export function categoryStrong(hue: number, scheme: TintScheme): string {
  return scheme === "light" ? `hsl(${hue}, 80%, 62%)` : `hsl(${hue}, 55%, 55%)`;
}

/** Fondo de la app en cada tema: contra él se mide el contraste de `categoryAccent`. */
const ACCENT_CANVAS: Record<TintScheme, string> = { light: fintPalette.light.canvas, dark: fintPalette.dark.canvas };
/** Contraste mínimo de una porción del donut contra el fondo (WCAG 1.4.11, elementos gráficos). */
export const ACCENT_MIN_CONTRAST = 3;

/** `hsl(h, s%, l%)` a RGB entre 0 y 1. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const c = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

/** Contraste WCAG entre dos colores RGB (0 a 1). */
export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Saturación y luminosidad de partida del color fuerte: `hsl(H 72% 46%)` en claro y `hsl(H 70% 62%)` en oscuro. */
const ACCENT_BASE: Record<TintScheme, { s: number; l: number }> = { light: { s: 72, l: 46 }, dark: { s: 70, l: 62 } };

/** La luminosidad de `categoryAccent` para un tono: la de partida, corrida lo justo para llegar a 3:1 contra el fondo. */
export function categoryAccentLightness(hue: number, scheme: TintScheme): number {
  const { s, l: start } = ACCENT_BASE[scheme];
  const canvas = hexToRgb(ACCENT_CANVAS[scheme]);
  const step = scheme === "light" ? -1 : 1;
  let l = start;
  // En claro, los amarillos, verdes y cian a 46 % no llegan a 3:1 contra el blanco: se oscurecen de a un punto.
  while (l > 5 && l < 95 && contrastRatio(hslToRgb(hue, s, l), canvas) < ACCENT_MIN_CONTRAST) l += step;
  return l;
}

/**
 * El color de una categoría en el donut de Reportes: el tono de su emoji con saturación alta, legible como elemento
 * gráfico (≥ 3:1) contra el fondo de cada tema. El pastel (`categoryTint`) queda para el cuadro del emoji.
 */
export function categoryAccent(hue: number, scheme: TintScheme): string {
  return `hsl(${hue}, ${ACCENT_BASE[scheme].s}%, ${categoryAccentLightness(hue, scheme)}%)`;
}

export const EMOJI_HUE_CANVAS = 48;

export function dominantHue(rgba: Uint8Array, canvasSize = EMOJI_HUE_CANVAS): number | null {
  let sx = 0;
  let sy = 0;
  let weight = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3]! / 255;
    if (a < 0.5) continue;
    const r = rgba[i]! / 255;
    const g = rgba[i + 1]! / 255;
    const b = rgba[i + 2]! / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0 || l < 0.12 || l > 0.92) continue;
    const s = d / (1 - Math.abs(2 * l - 1));
    if (s < 0.25) continue;
    let h: number;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    const rad = (h * 60 * Math.PI) / 180;
    const w = s * a;
    sx += Math.cos(rad) * w;
    sy += Math.sin(rad) * w;
    weight += w;
  }
  if (weight < canvasSize * canvasSize * 0.04) return null;
  const deg = (Math.atan2(sy, sx) * 180) / Math.PI;
  return Math.round((deg + 360) % 360);
}
