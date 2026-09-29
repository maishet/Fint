import { AMOUNT_MAX_DECIMALS } from "./validation";

/**
 * Lógica pura del teclado de monto. El monto se guarda como la cadena que la
 * persona escribió ("84.5", "0.") para que el cursor y los ceros no salten, y
 * se convierte a número solo al enviar.
 */
export type AmountKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "del";

export const MAX_INTEGER_DIGITS = 9;
/** Los mismos decimales que acepta la validación del formulario. */
export const MAX_FRACTION_DIGITS = AMOUNT_MAX_DECIMALS;

export function applyAmountKey(current: string, key: AmountKey): string {
  if (key === "del") return current.slice(0, -1);

  if (key === ".") {
    if (current.includes(".")) return current;
    return current === "" ? "0." : `${current}.`;
  }

  const [int = "", frac] = current.split(".");
  if (frac !== undefined) {
    if (frac.length >= MAX_FRACTION_DIGITS) return current;
    return `${current}${key}`;
  }
  if (int === "0") return key; // "0" + "5" = "5", sin ceros a la izquierda
  if (int.length >= MAX_INTEGER_DIGITS) return current;
  return `${current}${key}`;
}

/** El valor numérico de lo escrito. "" y "0." valen 0. */
export function amountInputValue(input: string): number {
  const n = Number.parseFloat(input);
  return Number.isFinite(n) ? n : 0;
}

/** Lo que se muestra: la parte entera con espacio fino de miles y los decimales tal cual se escribieron. */
export function displayAmountInput(input: string): string {
  if (input === "") return "0";
  const [int, frac] = input.split(".");
  const grouped = (int || "0").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return frac === undefined ? grouped : `${grouped}.${frac}`;
}
