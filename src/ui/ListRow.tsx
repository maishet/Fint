import type { ReactNode } from "react";
import { Pressable } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { View, XStack, YStack, useTheme } from "tamagui";
import { motion, space } from "../theme/tokens";
import { FText } from "./FText";

export interface ListRowProps {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  /** Normalmente un `Amount`, un valor en `caption` o un chevron. */
  trailing?: ReactNode;
  /** Filete `line` arriba, para filas apiladas dentro de una tarjeta. */
  divider?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * Fila de lista: avatar, título, subtítulo y lo que va a la derecha. Al
 * presionar el fondo pasa a `surfaceSunken` con la curva `press`, sin escala.
 */
export function ListRow({ leading, title, subtitle, trailing, divider, onPress, onLongPress, accessibilityLabel }: ListRowProps) {
  const theme = useTheme();
  const pressed = useSharedValue(0);
  const from = "rgba(0,0,0,0)";
  const to = theme.surfaceSunken.val;
  const bgStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(pressed.value, [0, 1], [from, to]) }));

  const content = (
    <XStack items="center" gap={space[3]} px={space[4]} py={space[3]}>
      {leading}
      <YStack flex={1} minW={0}>
        <FText variant="body-strong" numberOfLines={1} style={{ letterSpacing: -0.15 }}>
          {title}
        </FText>
        {subtitle ? (
          <FText variant="caption" tone="inkFaint" numberOfLines={1} style={{ marginTop: 1 }}>
            {subtitle}
          </FText>
        ) : null}
      </YStack>
      {trailing ? <View shrink={0}>{trailing}</View> : null}
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
