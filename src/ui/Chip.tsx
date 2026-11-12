import type { ReactNode } from "react";
import { Text, View, XStack, type ColorTokens } from "tamagui";
import { COMPACT_FONT_SCALE, radius } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FText } from "./FText";
import { PressableScale } from "./PressableScale";

export interface ChipProps {
  label: string;
  selected?: boolean;
  /**
   * - `filter`: filtros de lista. Elegido = `chipOn`.
   * - `choice`: una opción de formulario (categoría rápida). Elegido = `chipOn`.
   * - `detail`: los chips de fecha, lugar y nota del formulario. Nunca "elegidos"; `empty` los apaga.
   */
  variant?: "filter" | "choice" | "detail";
  /** Color de identidad (categoría) como punto a la izquierda. */
  dotColor?: ColorTokens | string;
  /** El emoji que la persona eligió para la categoría; va en lugar del punto. */
  emoji?: string | null;
  icon?: ReactNode;
  /** Chip de detalle sin valor todavía: contorno `line` y texto en `inkMuted`. */
  empty?: boolean;
  /** Ocupa el ancho disponible (chips de detalle de igual ancho). */
  grow?: boolean;
  /**
   * Opción única de un grupo que no se desmarca al volver a tocarla: se anuncia como radio ("marcado") y no como
   * interruptor. El contenedor lleva `accessibilityRole="radiogroup"`.
   */
  single?: boolean;
  /** Nombre para el lector cuando la etiqueta visible no basta ("Nota: …" en lugar del texto cortado). */
  accessibilityLabel?: string;
  onPress?: () => void;
}

export function Chip({
  label,
  selected = false,
  variant = "filter",
  dotColor,
  emoji,
  icon,
  empty = false,
  grow = false,
  single = false,
  accessibilityLabel,
  onPress,
}: ChipProps) {
  const on = variant !== "detail" && selected;
  const emptyDetail = variant === "detail" && empty;
  const height = variant === "filter" ? 36 : 40;

  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      accessibilityRole={variant === "detail" ? "button" : single ? "radio" : "togglebutton"}
      accessibilityState={single ? { checked: selected } : { selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      // La forma mide 36 o 40; el área de toque llega a 48 (Android) sin cambiar lo que se ve.
      hitSlop={{ top: (48 - height) / 2, bottom: (48 - height) / 2 }}
      style={grow ? { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 } : undefined}
    >
      <XStack
        minH={height}
        px={variant === "filter" ? 16 : 14}
        gap={6}
        items="center"
        justify="center"
        rounded={radius.pill}
        borderWidth={emptyDetail ? 1.5 : 0}
        borderColor="$line"
        bg={on ? "$chipOn" : emptyDetail ? "transparent" : "$surface"}
      >
        {emoji ? (
          <Text style={{ fontSize: 15, lineHeight: 19, includeFontPadding: false }} accessibilityElementsHidden importantForAccessibility="no">
            {emoji}
          </Text>
        ) : dotColor ? (
          <View width={7} height={7} rounded={999} bg={dotColor as ColorTokens} />
        ) : null}
        {icon}
        <FText
          variant="label"
          tone={on ? undefined : variant === "filter" || emptyDetail ? "inkMuted" : "ink"}
          color={on ? "$onChipOn" : undefined}
          style={[{ flexShrink: 1, fontFamily: fontFace.sans[600], fontSize: variant === "filter" ? 14 : 13 }]}
          numberOfLines={1}
          maxFontSizeMultiplier={COMPACT_FONT_SCALE}
        >
          {label}
        </FText>
      </XStack>
    </PressableScale>
  );
}
