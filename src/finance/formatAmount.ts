import { getCurrencySymbol } from "./currencies";

/** Signo menos tipográfico. Nunca el guion. */
export const MINUS = "−";
/** Espacio fino que no corta línea: separa los miles y el símbolo del número. */
export const THIN_SPACE = " ";

export interface AmountParts {
  /** "−", "+" o "". */
  sign: string;
  /** "S/", "$", "€"... */
  symbol: string;
  /** Parte entera con los miles separados por espacio fino: "18 420". */
  integer: string;
  /** Decimales sin el punto: "65". Vacío si `fractionDigits` es 0. */
  fraction: string;
}

export type SignMode = "auto" | "always" | "never";

/**
 * Parte un monto en sus piezas para que cada una se pueda pintar con su propio
 * tamaño y color. El formato es el del sistema: `−S/ 18 420.65`, con signo
 * tipográfico, espacio fino de miles y punto decimal, en cualquier idioma.
 */
export function amountParts(
  value: number,
  currency = "PEN",
  { sign = "auto", fractionDigits = 2 }: { sign?: SignMode; fractionDigits?: number } = {},
): AmountParts {
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  const fixed = abs.toFixed(fractionDigits);
  const [int, frac = ""] = fixed.split(".");
  const integer = int.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);
  const isZero = Number(fixed) === 0;
  let s = "";
  if (sign === "always" && !isZero) s = safe < 0 ? MINUS : "+";
  if (sign === "auto" && safe < 0 && !isZero) s = MINUS;
  return { sign: s, symbol: getCurrencySymbol(currency), integer, fraction: frac };
}

/** El monto completo en una sola cadena: `−S/ 1 280.40`. */
export function formatAmount(
  value: number,
  currency = "PEN",
  options?: { sign?: SignMode; fractionDigits?: number },
): string {
  const p = amountParts(value, currency, options);
  return `${p.sign}${p.symbol}${THIN_SPACE}${p.integer}${p.fraction ? `.${p.fraction}` : ""}`;
}
