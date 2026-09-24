import { forwardRef, useEffect, useImperativeHandle, useState, type ReactNode } from "react";
import { useWindowDimensions } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "tamagui";
import { motion } from "../theme/tokens";
import { getFabOrigin } from "../ui/fabOrigin";

export interface GrowPresenceHandle {
  /** Encoge la pantalla por el mismo camino por el que entró y después llama a `done`. */
  close: (done: () => void) => void;
}

/**
 * La entrada y salida del formulario de movimiento. Desde el botón central, el
 * más se expande hasta ocupar la pantalla con `spring-sheet` (un círculo
 * `brand` que crece y se vuelve `canvas`) y al cerrar vuelve a encogerse hacia
 * el botón. Desde otro lugar (editar, duplicar) sube desde abajo, como una
 * hoja. Con movimiento reducido, un `fade`.
 *
 * La pantalla se presenta como modal transparente sin animación propia: el
 * movimiento lo dibuja este componente.
 */
export const GrowPresence = forwardRef<GrowPresenceHandle, { fromFab: boolean; children: ReactNode }>(function GrowPresence(
  { fromFab, children },
  ref,
) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const { width: W, height: H } = useWindowDimensions();
  // Se lee una vez: la barra ya midió el botón antes de que se abriera el formulario.
  const [origin] = useState(() => (fromFab ? getFabOrigin() : null));
  const p = useSharedValue(0);

  useEffect(() => {
    // Dos cuadros de espera: el primer layout de la pantalla es pesado y se comía el inicio del crecimiento.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        p.value = reduceMotion ? withTiming(1, motion.fade) : withSpring(1, { ...motion.springSheet, overshootClamping: true });
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [p, reduceMotion]);

  useImperativeHandle(
    ref,
    () => ({
      close: (done) => {
        const finish = (finished?: boolean) => {
          "worklet";
          if (finished) runOnJS(done)();
        };
        p.value = reduceMotion
          ? withTiming(0, motion.fade, finish)
          : withSpring(0, { ...motion.springSheet, stiffness: 240, overshootClamping: true }, finish);
      },
    }),
    [p, reduceMotion],
  );

  const brand = theme.brand.val;
  const canvas = theme.canvas.val;
  // Radio final: hasta la esquina más lejana desde el botón, para que el círculo cubra toda la pantalla.
  const reach = origin
    ? Math.max(
        Math.hypot(origin.x, origin.y),
        Math.hypot(W - origin.x, origin.y),
        Math.hypot(origin.x, H - origin.y),
        Math.hypot(W - origin.x, H - origin.y),
      )
    : 0;

  const outerStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { left: 0, top: 0, width: W, height: H, opacity: p.value, backgroundColor: canvas };
    if (!origin) {
      return { left: 0, top: 0, width: W, height: H, backgroundColor: canvas, transform: [{ translateY: (1 - p.value) * H }] };
    }
    // Un círculo centrado en el botón cuyo radio crece hasta cubrir la pantalla (y al cerrar, vuelve).
    const r = interpolate(p.value, [0, 1], [origin.size / 2, reach], Extrapolation.CLAMP);
    return {
      left: origin.x - r,
      top: origin.y - r,
      width: r * 2,
      height: r * 2,
      borderRadius: r,
      // El más es `brand`: se vuelve `canvas` en el primer tramo del crecimiento.
      backgroundColor: interpolateColor(p.value, [0, 0.3], [brand, canvas]),
    };
  });

  // El contenido mide siempre la pantalla completa y se desplaza en sentido contrario: no se reacomoda mientras crece.
  const innerStyle = useAnimatedStyle(() => {
    if (reduceMotion || !origin) return { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }] };
    const r = interpolate(p.value, [0, 1], [origin.size / 2, reach], Extrapolation.CLAMP);
    return {
      opacity: interpolate(p.value, [0.15, 0.5], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateX: r - origin.x }, { translateY: r - origin.y }],
    };
  });

  return (
    <Animated.View style={[{ position: "absolute", overflow: "hidden" }, outerStyle]}>
      <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: W, height: H }, innerStyle]}>{children}</Animated.View>
    </Animated.View>
  );
});
