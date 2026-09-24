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
  /** Sobre la losa: símbolo en `slabMuted` y color por defecto `slabInk`. */
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
 * menos tipográfico, espacio fino de miles y el símbolo más chico y apagado.
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
  const symbolTone: FTextTone = onSlab ? "slabMuted" : "inkFaint";
  const minor = Math.round(base.fontSize * (variant === "amount-hero" ? 26 / 48 : variant === "amount-input" ? 30 / 64 : 0.82));

  const isHidden = sensitive && !(isHydrated && amountsVisible);
  const label = isHidden
    ? t("privacy.amounts.hiddenLabel")
    : `${parts.sign}${parts.symbol} ${parts.integer.replaceAll(THIN_SPACE, "")}.${parts.fraction}`;

  if (isHidden) {
    return (
      <Text color={`$${resolvedTone}` as ColorTokens} style={[base, style]} aria-label={label} {...props}>
        {hidden}
      </Text>
    );
  }

  return (
    <Text color={`$${resolvedTone}` as ColorTokens} style={[base, style]} aria-label={label} numberOfLines={1} {...props}>
      {parts.sign}
      {showSymbol ? (
        <Text color={`$${symbolTone}` as ColorTokens} style={{ fontSize: minor, letterSpacing: 0 }}>
          {parts.symbol}
          {THIN_SPACE}
        </Text>
      ) : null}
      {parts.integer}
      {smallCents ? (
        <Text style={{ fontSize: minor }}>.{parts.fraction}</Text>
      ) : parts.fraction ? (
        `.${parts.fraction}`
      ) : null}
    </Text>
  );
}
