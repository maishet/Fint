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
