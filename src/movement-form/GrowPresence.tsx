import { forwardRef, useImperativeHandle, useState, type ReactNode } from "react";
import { useWindowDimensions } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type EntryAnimationsValues,
  type LayoutAnimation,
} from "react-native-reanimated";
import { useTheme } from "tamagui";
import { motion } from "../theme/tokens";
import { getFabOrigin } from "../ui/fabOrigin";

/** Espera antes de crecer, medida en cuadros de la interfaz: deja pasar el primer layout de la pantalla. */
const FIRST_LAYOUT_MS = 32;
/** Lo que tarda el `brand` del más en volverse `canvas` (el primer tramo del crecimiento). */
const BRAND_OUT_MS = 110;

const GROW_SPRING = { ...motion.springSheet, overshootClamping: true };

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
 *
 * La entrada es una animación de entrada de Reanimated (`entering`) y no un valor compartido que se anima desde JS:
 * se registra al crear la vista y arranca en el hilo de la interfaz apenas la vista se monta. Un valor compartido
 * cambiado desde JS recién llega a la interfaz cuando JS termina todo lo que sigue al montaje (los renders del
 * formulario): en desarrollo el círculo se quedaba ~0.5 s quieto sobre el botón y el formulario parecía no responder.
 * La salida sí usa el valor compartido: al cerrar, JS ya está libre.
 */
export const GrowPresence = forwardRef<
  GrowPresenceHandle,
  {
    fromFab: boolean;
    /** Cuando la pantalla terminó de entrar: lo que no hace falta para el primer cuadro se monta recién ahí. */
    onEntered?: () => void;
    children: ReactNode;
  }
>(function GrowPresence({ fromFab, onEntered, children }, ref) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const { width: W, height: H } = useWindowDimensions();
  // Se lee una vez: la barra ya midió el botón antes de que se abriera el formulario.
  const [origin] = useState(() => (fromFab ? getFabOrigin() : null));
  // Parte entera: la entrada la dibujan las animaciones de entrada; este valor solo mueve la salida.
  const p = useSharedValue(1);

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

  // Entradas: se arman una vez, con lo que se sabe al montar.
  const [entering] = useState(() => {
    const entered = (finished: boolean) => {
      "worklet";
      if (finished && onEntered) runOnJS(onEntered)();
    };
    const grow = (to: number) => {
      "worklet";
      return withDelay(FIRST_LAYOUT_MS, withSpring(to, GROW_SPRING));
    };

    if (reduceMotion) {
      const fadeIn = (): LayoutAnimation => {
        "worklet";
        return { initialValues: { opacity: 0 }, animations: { opacity: withTiming(1, motion.fade) }, callback: entered };
      };
      return { outer: fadeIn, inner: undefined, brand: undefined };
    }
    if (!origin) {
      const riseUp = (): LayoutAnimation => {
        "worklet";
        return { initialValues: { transform: [{ translateY: H }] }, animations: { transform: [{ translateY: grow(0) }] }, callback: entered };
      };
      return { outer: riseUp, inner: undefined, brand: undefined };
    }

    // Un círculo centrado en el botón cuyo radio crece hasta cubrir la pantalla: todo lo que se mueve es lineal en el
    // radio y va con el mismo resorte, así que el círculo y el contenido avanzan juntos cuadro a cuadro.
    const r0 = origin.size / 2;
    const outer = (values: EntryAnimationsValues): LayoutAnimation => {
      "worklet";
      const shift = reach - r0;
      return {
        initialValues: {
          originX: values.targetOriginX + shift,
          originY: values.targetOriginY + shift,
          width: r0 * 2,
          height: r0 * 2,
          borderRadius: r0,
        },
        animations: {
          originX: grow(values.targetOriginX),
          originY: grow(values.targetOriginY),
          width: grow(values.targetWidth),
          height: grow(values.targetHeight),
          borderRadius: grow(reach),
        },
        callback: entered,
      };
    };
    // El contenido mide siempre la pantalla completa y se desplaza en sentido contrario: no se reacomoda mientras crece.
    const inner = (): LayoutAnimation => {
      "worklet";
      return {
        initialValues: { opacity: 0, transform: [{ translateX: r0 - origin.x }, { translateY: r0 - origin.y }] },
        animations: {
          opacity: withDelay(FIRST_LAYOUT_MS + 50, withTiming(1, { duration: 140 })),
          transform: [{ translateX: grow(reach - origin.x) }, { translateY: grow(reach - origin.y) }],
        },
      };
    };
    // El más es `brand`: una capa encima que se desvanece en el primer tramo y deja el `canvas`.
    const brandLayer = (): LayoutAnimation => {
      "worklet";
      return {
        initialValues: { opacity: 1 },
        animations: { opacity: withDelay(FIRST_LAYOUT_MS, withTiming(0, { duration: BRAND_OUT_MS })) },
      };
    };
    return { outer, inner, brand: brandLayer };
  });

  // Salida (y el estado final de la entrada, `p` = 1).
  const outerStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { left: 0, top: 0, width: W, height: H, opacity: p.value, backgroundColor: canvas };
    if (!origin) {
      return { left: 0, top: 0, width: W, height: H, backgroundColor: canvas, transform: [{ translateY: (1 - p.value) * H }] };
    }
    const r = interpolate(p.value, [0, 1], [origin.size / 2, reach], Extrapolation.CLAMP);
    return {
      left: origin.x - r,
      top: origin.y - r,
      width: r * 2,
      height: r * 2,
      borderRadius: r,
      // Al encogerse vuelve a ser el más: `canvas` pasa a `brand` en el último tramo.
      backgroundColor: interpolateColor(p.value, [0, 0.3], [brand, canvas]),
    };
  });

  const innerStyle = useAnimatedStyle(() => {
    if (reduceMotion || !origin) return { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }] };
    const r = interpolate(p.value, [0, 1], [origin.size / 2, reach], Extrapolation.CLAMP);
    return {
      opacity: interpolate(p.value, [0.15, 0.5], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateX: r - origin.x }, { translateY: r - origin.y }],
    };
  });

  return (
    <Animated.View entering={entering.outer} style={[{ position: "absolute", overflow: "hidden" }, outerStyle]}>
      <Animated.View entering={entering.inner} style={[{ position: "absolute", left: 0, top: 0, width: W, height: H }, innerStyle]}>
        {children}
      </Animated.View>
      {entering.brand ? (
        <Animated.View
          entering={entering.brand}
          pointerEvents="none"
          style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: brand, opacity: 0 }}
        />
      ) : null}
    </Animated.View>
  );
});
