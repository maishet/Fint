import { forwardRef } from "react";
import { Pressable, type PressableProps, type View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { motion, opacity, pressScale } from "../theme/tokens";
import { haptics } from "./haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends PressableProps {
  /** Escala al presionar. `1` para no escalar (filas de lista). */
  scaleTo?: number;
  /** Baja a `opacity.press` al presionar. */
  dim?: boolean;
  /** Háptico en el mismo frame que el cambio visual, al presionar. */
  haptic?: "tap" | "select" | "none";
}

/**
 * Todo lo tocable responde al presionar, no al soltar: baja a `scale(0.97)` y a
 * `opacity-press` con la curva `press`, y vuelve con `spring-ui`. Nada bloquea
 * la entrada mientras anima.
 */
export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  { scaleTo = pressScale, dim = true, haptic = "none", disabled, onPressIn, onPressOut, style, ...props },
  ref,
) {
  const pressed = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: disabled ? opacity.disabled : dim ? interpolate(pressed.value, [0, 1], [1, opacity.press]) : 1,
    transform: [{ scale: reduceMotion ? 1 : interpolate(pressed.value, [0, 1], [1, scaleTo]) }],
  }));

  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      onPressIn={(event) => {
        pressed.value = withTiming(1, motion.press);
        if (haptic !== "none") haptics[haptic]();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withSpring(0, motion.springUi);
        onPressOut?.(event);
      }}
      style={[style as object, animatedStyle]}
      {...props}
    />
  );
});
