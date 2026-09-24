import { Canvas, Circle, RadialGradient, vec } from "@shopify/react-native-skia";
import { useIsFocused } from "expo-router";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useTheme } from "tamagui";

interface HeroMeshProps {
  width: number;
  height: number;
  /** Scroll del Inicio: la malla se desplaza a la mitad de su velocidad, lo que da profundidad. */
  scrollY?: SharedValue<number>;
}

/**
 * La malla del hero: dos resplandores (`heroGlow` arriba a la derecha,
 * `heroGlowSoft` abajo a la izquierda) cuyos centros recorren una elipse lenta,
 * desfasados entre sí. Es atmósfera: nunca se acerca al saldo, no se toca, y se
 * detiene cuando la pantalla no está enfocada o se pide movimiento reducido.
 */
export function HeroMesh({ width, height, scrollY }: HeroMeshProps) {
  const theme = useTheme();
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const phase = useSharedValue(0);

  useEffect(() => {
    if (!focused || reduceMotion) {
      cancelAnimation(phase);
      return;
    }
    // Una vuelta cada 20 s, siempre a la misma velocidad: ni se detiene ni acelera.
    phase.value = withRepeat(withTiming(phase.value + Math.PI * 2, { duration: 20000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(phase);
  }, [focused, phase, reduceMotion]);

  const r1 = Math.max(width, height) * 0.62;
  const r2 = Math.max(width, height) * 0.55;

  const c1 = useDerivedValue(() => vec(width * 0.86 + Math.cos(phase.value) * width * 0.08, height * 0.08 + Math.sin(phase.value) * height * 0.07));
  const c2 = useDerivedValue(() =>
    vec(width * 0.08 + Math.cos(phase.value * 0.8 + 2.1) * width * 0.07, height * 0.92 + Math.sin(phase.value * 0.8 + 2.1) * height * 0.06),
  );

  const parallax = useAnimatedStyle(() => ({ transform: [{ translateY: scrollY ? Math.max(0, scrollY.value) * 0.5 : 0 }] }));

  if (width === 0 || height === 0) return null;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, parallax]}>
      <Canvas style={{ width, height }}>
        <Circle c={c1} r={r1}>
          <RadialGradient c={c1} r={r1} colors={[theme.heroGlow.val, "rgba(0,0,0,0)"]} />
        </Circle>
        <Circle c={c2} r={r2}>
          <RadialGradient c={c2} r={r2} colors={[theme.heroGlowSoft.val, "rgba(0,0,0,0)"]} />
        </Circle>
      </Canvas>
    </Animated.View>
  );
}
