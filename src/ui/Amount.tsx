import { useTranslation } from "react-i18next";
import { StyleSheet, type StyleProp, type TextStyle } from "react-native";
import { Text, View, type ColorTokens, type TextProps } from "tamagui";
import { amountParts, THIN_SPACE, type SignMode } from "../finance/formatAmount";
import { useSensitiveAmounts } from "../privacy/SensitiveAmountsProvider";
import { fontFace, textStyles } from "../theme/typography";
import { AmountSkeleton } from "./AmountSkeleton";
import type { FTextTone } from "./FText";

type AmountVariant = "amount-input" | "amount-hero" | "amount-lg" | "amount" | "amount-sm" | "figure-caption";

/**
 * Qué representa el monto. Decide signo y color según las reglas del sistema:
 * - `expense`: `−` y `flowOut`.
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
/** Montos en filas y tarjetas: crecen con la letra del sistema hasta 1.5 y siempre en una línea. */
const ROW_FONT_SCALE = 1.5;
/** Los montos grandes (boleta y formulario) no escalan: ya son grandes y cambiarían de línea. */
const FIXED_VARIANTS: readonly AmountVariant[] = ["amount-input", "amount-hero"];

export function minorScale(fontSize: number): { symbol: number; cents: number } {
  if (fontSize >= 22) return { symbol: 0.52, cents: 0.6 };
  if (fontSize >= 15) return { symbol: 0.72, cents: 0.8 };
  return { symbol: 0.85, cents: 1 };
}

/**
 * Toda cifra de la app pasa por aquí: IBM Plex Sans con cifras tabulares, signo
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
  smallCents,
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
    tone ?? (onSlab ? "slabInk" : kind === "income" ? "flowIn" : kind === "expense" ? "flowOut" : kind === "transfer" ? "inkMuted" : "ink");
  const size = (StyleSheet.flatten(style as StyleProp<TextStyle>)?.fontSize as number | undefined) ?? base.fontSize;
  const scale = minorScale(size);
  const symbolSize = Math.round(size * scale.symbol);
  const centsSize = smallCents === false ? size : Math.round(size * scale.cents);

  const isHidden = sensitive && !(isHydrated && amountsVisible);
  const scaling = FIXED_VARIANTS.includes(variant) ? { allowFontScaling: false } : { maxFontSizeMultiplier: ROW_FONT_SCALE };
  const label = isHidden
    ? t("privacy.amounts.hiddenLabel")
    : `${parts.sign}${parts.symbol} ${parts.integer.replaceAll(THIN_SPACE, "")}.${parts.fraction}`;

  // Mientras se lee la preferencia de montos, un esqueleto con la forma de la cifra (mismo ancho aproximado y
  // mismo alto de línea): ni puntos que luego saltan a la cifra ni un hueco vacío.
  if (sensitive && !isHydrated) {
    const chars = parts.sign.length + (showSymbol ? parts.symbol.length + 1 : 0) + parts.integer.length + parts.fraction.length + 1;
    return (
      <View height={base.lineHeight} justify="center" accessible accessibilityRole="progressbar" accessibilityLabel={t("states.loading")}>
        <AmountSkeleton width={Math.round(chars * base.fontSize * 0.6)} height={Math.round(base.fontSize * 0.75)} onSlab={onSlab} />
      </View>
    );
  }

  // Oculto: el símbolo se queda ("S/ ••••••"), así se sigue sabiendo en qué moneda está.
  if (isHidden) {
    return (
      <Text color={`$${resolvedTone}` as ColorTokens} style={[base, style]} aria-label={label} numberOfLines={1} {...scaling} {...props}>
        {showSymbol ? (
          <Text color={`$${resolvedTone}` as ColorTokens} style={{ fontSize: symbolSize, letterSpacing: 0 }}>
            {parts.symbol}
            {THIN_SPACE}
          </Text>
        ) : null}
        {hidden}
      </Text>
    );
  }

  // Un Text anidado de Tamagui no hereda el color del padre (toma el del tema), así que cada tramo lo lleva explícito.
  const color = `$${resolvedTone}` as ColorTokens;

  return (
    <Text color={color} style={[base, style]} aria-label={label} numberOfLines={1} {...scaling} {...props}>
      {parts.sign}
      {showSymbol ? (
        <Text color={color} style={{ fontSize: symbolSize, letterSpacing: 0 }}>
          {parts.symbol}
          {THIN_SPACE}
        </Text>
      ) : null}
      {parts.integer}
      {parts.fraction ? (
        centsSize < size ? (
          <Text color={color} style={{ fontSize: centsSize, letterSpacing: 0 }}>.{parts.fraction}</Text>
        ) : (
          `.${parts.fraction}`
        )
      ) : null}
    </Text>
  );
}

/** El monto de una fila de movimiento (marca D): 16/600 en Plex, con signo y color según `kind`. */
export function RowAmount(props: Omit<AmountProps, "variant">) {
  return <Amount variant="amount" {...props} style={[{ fontFamily: fontFace.mono[600], fontSize: 16, lineHeight: 21 }, props.style]} />;
}
