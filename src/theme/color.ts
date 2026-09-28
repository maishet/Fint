/** Un color `#RRGGBB` con transparencia, para los tintes al 14 % de iconos y fondos. Otros formatos pasan igual. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) return hex;
  const int = Number.parseInt(value, 16);
  return `rgba(${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},${alpha})`;
}
