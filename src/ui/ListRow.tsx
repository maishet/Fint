import type { ReactNode } from "react";
import { Pressable, useWindowDimensions } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { View, XStack, YStack, useTheme } from "tamagui";
import { COMPACT_FONT_SCALE, motion, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FText } from "./FText";

export interface ListRowProps {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  /** Normalmente un `Amount`, un valor en `caption` o un chevron. */
  trailing?: ReactNode;
  /** Filete `line` arriba, para filas apiladas en una lista o dentro de una tarjeta. */
  divider?: boolean;
  /**
   * Sin margen lateral propio: la fila va directo sobre `canvas` y el contenedor pone el margen de la pantalla, así
   * el filete empieza donde empieza el contenido (marca D).
   */
  flush?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * Fila de lista: cuadro, título 16, subtítulo 13 y lo que va a la derecha. Al
 * presionar el fondo pasa a `surfaceSunken` con la curva `press`, sin escala.
 * Desde `COMPACT_FONT_SCALE` el título y el subtítulo pueden partirse en varias
 * líneas y lo de la derecha baja debajo del detalle, para no cortar el monto.
 */
export function ListRow({ leading, title, subtitle, trailing, divider, flush = false, onPress, onLongPress, accessibilityLabel }: ListRowProps) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= COMPACT_FONT_SCALE;
  const pressed = useSharedValue(0);
  const from = "rgba(0,0,0,0)";
  const to = theme.surfaceSunken.val;
  const bgStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(pressed.value, [0, 1], [from, to]) }));

  const text = (
    <YStack flex={1} minW={0} gap={2}>
      <FText numberOfLines={stacked ? undefined : 1} style={{ fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21, letterSpacing: -0.15 }}>
        {title}
      </FText>
      {subtitle ? (
        <FText tone="inkFaint" numberOfLines={stacked ? undefined : 1} style={{ fontSize: 13, lineHeight: 18 }}>
          {subtitle}
        </FText>
      ) : null}
      {stacked && trailing ? <View self="flex-start" mt={2}>{trailing}</View> : null}
    </YStack>
  );

  const content = (
    <XStack items={stacked ? "flex-start" : "center"} gap={space[3]} px={flush ? 0 : space[4]} py={space[3]}>
      {leading}
      {text}
      {!stacked && trailing ? <View shrink={0}>{trailing}</View> : null}
    </XStack>
  );

  return (
    <View borderTopWidth={divider ? 1 : 0} borderColor="$line">
      {onPress || onLongPress ? (
        <Pressable
          onPress={onPress}
          onLongPress={onLongPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPressIn={() => {
            pressed.value = withTiming(1, motion.press);
          }}
          onPressOut={() => {
            pressed.value = withTiming(0, motion.fade);
          }}
        >
          <Animated.View style={bgStyle}>{content}</Animated.View>
        </Pressable>
      ) : (
        content
      )}
    </View>
  );
}
