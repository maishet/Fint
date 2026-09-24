import type { ReactNode } from "react";
import { View, XStack, type ColorTokens } from "tamagui";
import { radius } from "../theme/tokens";
import { fontFace } from "../theme/typography";
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
      style={grow ? { flex: 1 } : undefined}
    >
      <XStack
        height={32}
        px={13}
        gap={6}
        items="center"
        justify="center"
        rounded={radius.pill}
        borderWidth={1}
        borderStyle={dashed ? "dashed" : "solid"}
        bg={filterOn ? "$ink" : choiceOn ? "$brandWash" : "$surface"}
        borderColor={filterOn ? "$ink" : choiceOn ? "$brand" : "$lineStrong"}
      >
        {dotColor ? <View width={7} height={7} rounded={999} bg={dotColor as ColorTokens} /> : null}
        {icon}
        <FText
          variant="label"
          tone={tone === "canvas" ? undefined : (tone as "ink" | "inkMuted")}
          color={tone === "canvas" ? "$canvas" : undefined}
          style={selected ? { fontFamily: fontFace.sans[600] } : undefined}
          numberOfLines={1}
        >
          {label}
        </FText>
      </XStack>
    </PressableScale>
  );
}
