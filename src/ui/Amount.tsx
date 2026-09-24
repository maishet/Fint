import { useTranslation } from "react-i18next";
import { Text, type ColorTokens, type TextProps } from "tamagui";
import { amountParts, THIN_SPACE, type SignMode } from "../finance/formatAmount";
import { useSensitiveAmounts } from "../privacy/SensitiveAmountsProvider";
import { textStyles } from "../theme/typography";
import type { FTextTone } from "./FText";

type AmountVariant = "amount-input" | "amount-hero" | "amount-lg" | "amount" | "amount-sm" | "figure-caption";

/**
 * Qué representa el monto. Decide signo y color según las reglas del sistema:
 * - `expense`: `−` y `ink`. En una lista casi todo es egreso; pintarlo de color la vuelve una pared.
 * - `income`: `+` y `flowIn`.
 * - `transfer`: sin signo y `inkMuted`, porque no suma ni resta al patrimonio.
 * - `neutral`: el signo que traiga el valor y `ink`. Saldos y totales.
 */
export type AmountKind = "expense" | "income" | "transfer" | "neutral";

export interface AmountProps extends Omit<TextProps, "children"> {
  value: number;
  currency?: string;
  variant?: AmountVariant;
  kind?: AmountKind;
  /** Fuerza el color. Por defecto lo decide `kind`. */
  tone?: FTextTone;
  /** Sobre la losa: color por defecto `slabInk`. */
  onSlab?: boolean;
  /** Muestra el símbolo de moneda. Por defecto sí. */
  showSymbol?: boolean;
  /** Los decimales a menor tamaño, como en el saldo del hero. */
  smallCents?: boolean;
  /** Respeta "Ocultar montos". Por defecto sí; apágalo solo en campos de edición. */
  sensitive?: boolean;
}

const hidden = "••••••";

/**
 * Toda cifra de la app pasa por aquí: Geist Mono con cifras tabulares, signo
 * menos tipográfico, espacio fino de miles y el símbolo un poco más chico.
 * El símbolo va del mismo color que la cifra (`+S/ 4 200.00` entero en
 * `flowIn`), como en los previews; el único símbolo apagado es el del saldo
 * grande del hero, que no pasa por aquí.
 */
export function Amount({
  value,
  currency = "PEN",
  variant = "amount",
  kind = "neutral",
  tone,
  onSlab = false,
  showSymbol = true,
  smallCents = false,
  sensitive = true,
  style,
  ...props
}: AmountProps) {
  const { t } = useTranslation();
  const { amountsVisible, isHydrated } = useSensitiveAmounts();
  const base = textStyles[variant];

  const signMode: SignMode = kind === "expense" || kind === "income" ? "always" : kind === "transfer" ? "never" : "auto";
  const signedValue = kind === "expense" ? -Math.abs(value) : kind === "income" ? Math.abs(value) : value;
  const parts = amountParts(signedValue, currency, { sign: signMode });

  const resolvedTone: FTextTone =
    tone ?? (onSlab ? "slabInk" : kind === "income" ? "flowIn" : kind === "transfer" ? "inkMuted" : "ink");
  const minor = Math.round(base.fontSize * (variant === "amount-hero" ? 26 / 48 : variant === "amount-input" ? 30 / 64 : 0.82));

  const isHidden = sensitive && !(isHydrated && amountsVisible);
  const label = isHidden
    ? t("privacy.amounts.hiddenLabel")
    : `${parts.sign}${parts.symbol} ${parts.integer.replaceAll(THIN_SPACE, "")}.${parts.fraction}`;

  if (isHidden) {
    // Mientras se lee la preferencia (`!isHydrated`) el marcador ocupa su lugar pero no se ve: si no, cada
    // arranque mostraba puntos un instante y luego saltaba a la cifra.
    return (
      <Text
        color={`$${resolvedTone}` as ColorTokens}
        style={[base, style, sensitive && !isHydrated ? { opacity: 0 } : null]}
        aria-label={label}
        {...props}
      >
        {hidden}
      </Text>
    );
  }

  // Un Text anidado de Tamagui no hereda el color del padre (toma el del tema), así que cada tramo lo lleva explícito.
  const color = `$${resolvedTone}` as ColorTokens;

  return (
    <Text color={color} style={[base, style]} aria-label={label} numberOfLines={1} {...props}>
      {parts.sign}
      {showSymbol ? (
        <Text color={color} style={{ fontSize: minor, letterSpacing: 0 }}>
          {parts.symbol}
          {THIN_SPACE}
        </Text>
      ) : null}
      {parts.integer}
      {smallCents ? (
        <Text color={color} style={{ fontSize: minor }}>.{parts.fraction}</Text>
      ) : parts.fraction ? (
        `.${parts.fraction}`
      ) : null}
    </Text>
  );
}
