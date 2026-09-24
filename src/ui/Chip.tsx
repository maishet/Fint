import type { ReactNode } from "react";
import { Text, View, XStack, type ColorTokens } from "tamagui";
import { radius } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { DashedOutline } from "./DashedOutline";
import { FText } from "./FText";
import { PressableScale } from "./PressableScale";

export interface ChipProps {
  label: string;
  selected?: boolean;
  /**
   * - `filter`: filtros de lista. Elegido = relleno `ink`.
   * - `choice`: una opción de formulario (categoría rápida). Elegido = `brandWash` con filete `brand`.
   * - `detail`: los chips de fecha, lugar y nota del formulario. Nunca "elegidos"; `empty` los apaga.
   */
  variant?: "filter" | "choice" | "detail";
  /** Color de identidad (categoría) como punto a la izquierda. */
  dotColor?: ColorTokens | string;
  /** El emoji que la persona eligió para la categoría; va en lugar del punto. */
  emoji?: string | null;
  icon?: ReactNode;
  /** Borde punteado para "Más" o "Nueva". */
  dashed?: boolean;
  /** Chip de detalle sin valor todavía: texto en `inkMuted`. */
  empty?: boolean;
  /** Ocupa el ancho disponible (chips de detalle de igual ancho). */
  grow?: boolean;
  onPress?: () => void;
}

export function Chip({
  label,
  selected = false,
  variant = "filter",
  dotColor,
  emoji,
  icon,
  dashed = false,
  empty = false,
  grow = false,
  onPress,
}: ChipProps) {
  const filterOn = variant === "filter" && selected;
  const choiceOn = variant === "choice" && selected;
  const tone = filterOn ? "canvas" : choiceOn || variant === "detail" ? (empty ? "inkMuted" : "ink") : "inkMuted";

  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      accessibilityRole={variant === "detail" ? "button" : "togglebutton"}
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={grow ? { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 } : undefined}
    >
      <XStack
        height={32}
        px={13}
        gap={6}
        items="center"
        justify="center"
        rounded={radius.pill}
        borderWidth={dashed ? 0 : 1}
        bg={filterOn ? "$ink" : choiceOn ? "$brandWash" : "$surface"}
        borderColor={filterOn ? "$ink" : choiceOn ? "$brand" : "$lineStrong"}
      >
        {dashed ? <DashedOutline radius={radius.pill} strokeWidth={1} /> : null}
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
          tone={tone === "canvas" ? undefined : (tone as "ink" | "inkMuted")}
          color={tone === "canvas" ? "$canvas" : undefined}
          style={[{ flexShrink: 1 }, selected ? { fontFamily: fontFace.sans[600] } : null]}
          numberOfLines={1}
        >
          {label}
        </FText>
      </XStack>
    </PressableScale>
  );
}
