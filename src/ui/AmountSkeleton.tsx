import { useEffect } from "react";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "tamagui";
import { radius } from "../theme/tokens";

export interface AmountSkeletonProps {
  width: number;
  height: number;
  /** Sobre la losa del hero: `glassSlab` en lugar de `surfaceSunken`. */
  onSlab?: boolean;
}

/**
 * Esqueleto de una cifra mientras carga: una píldora del ancho y alto que va a
 * ocupar el monto, con un pulso lento de opacidad. Copia la forma del
 * contenido, nunca un spinner. Con movimiento reducido se queda quieta.
 */
export function AmountSkeleton({ width, height, onSlab = false }: AmountSkeletonProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius.pill, backgroundColor: onSlab ? theme.glassSlab.val : theme.surfaceSunken.val },
        style,
      ]}
    />
  );
}
