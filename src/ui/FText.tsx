import { Text, type ColorTokens, type TextProps } from "tamagui";
import { textStyles, type TextStyleName } from "../theme/typography";

export type FTextTone =
  | "ink"
  | "inkMuted"
  | "inkFaint"
  | "brand"
  | "onBrand"
  | "flowIn"
  | "flowOut"
  | "dangerHard"
  | "signal"
  | "slabInk"
  | "slabMuted"
  | "flowInSlab"
  | "flowOutSlab";

export interface FTextProps extends Omit<TextProps, "variant"> {
  /** Estilo de texto del sistema. Por defecto `body`. */
  variant?: TextStyleName;
  /** Color del texto. Por defecto `ink`. Sobre la losa usa `slabInk` o `slabMuted`. */
  tone?: FTextTone;
}

/**
 * Texto del sistema de diseño. Usa los mismos nombres que el design system
 * (`title`, `body`, `caption`, `overline`...). Para cifras usa `Amount`.
 */
export function FText({ variant = "body", tone = "ink", style, ...props }: FTextProps) {
  return <Text color={`$${tone}` as ColorTokens} style={[textStyles[variant], style]} {...props} />;
}
