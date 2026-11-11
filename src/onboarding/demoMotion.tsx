import { useEffect, useRef, useState, type ReactNode } from "react";
import Animated, { Easing, FadeOut, useReducedMotion, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { motion } from "../theme/tokens";

/**
 * Herramientas para que las ilustraciones del onboarding se lean como una demostración y no como datos de la persona:
 * cada una cuenta una historia corta en bucle (el saldo que sube desde cero, la compra que descuenta la cuenta, el
 * pago que pasa a "Pagado", los montos que se ocultan). La gente mira las imágenes y no lee: una cifra quieta se
 * confundía con el saldo propio. Con "reducir movimiento" todo queda en su estado final, sin bucle.
 */

/**
 * La vuelta actual de la demostración: sube en uno cada `period` ms mientras la pantalla está a la vista y también al
 * volver a ella, para que la historia empiece de nuevo. Fuera de la vista se congela.
 */
export function useDemoCycle(active: boolean, period: number) {
  const reduceMotion = useReducedMotion();
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (!active || reduceMotion) return;
    setCycle((c) => c + 1);
    const id = setInterval(() => setCycle((c) => c + 1), period);
    return () => clearInterval(id);
  }, [active, period, reduceMotion]);
  return reduceMotion ? 0 : cycle;
}

/** Un número que va de `from` a `to` con `ease-out` cada vez que cambia `run`. Con "reducir movimiento", `to` directo. */
export function useTween(to: number, { from, duration, delay = 0, run }: { from: number; duration: number; delay?: number; run: number }) {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(reduceMotion || run === 0 ? to : from);
  const frame = useRef<number | null>(null);
  useEffect(() => {
    if (reduceMotion || run === 0) {
      setValue(to);
      return;
    }
    setValue(from);
    let start: number | null = null;
    const timeout = setTimeout(() => {
      const step = (now: number) => {
        start ??= now;
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(from + (to - from) * eased);
        if (t < 1) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timeout);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [run, from, to, duration, delay, reduceMotion]);
  return value;
}

/** `true` desde `delay` ms después de que cambia `run`. Con "reducir movimiento" (o antes de la primera vuelta), `true`. */
export function useAfter(delay: number, run: number) {
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(reduceMotion || run === 0);
  useEffect(() => {
    if (reduceMotion || run === 0) {
      setDone(true);
      return;
    }
    setDone(false);
    const id = setTimeout(() => setDone(true), delay);
    return () => clearTimeout(id);
  }, [delay, run, reduceMotion]);
  return done;
}

type From = "down" | "up" | "left" | "right" | "pop";

/**
 * Una pieza que entra al montarse: sube, baja o se desliza 24 px con `spring-ui`, o crece desde 0.6 (`pop`), tras
 * `delay` ms. Para repetir la entrada, quien la usa la vuelve a montar (cambiando `key`).
 */
export function Enter({ from = "down", delay = 0, children }: { from?: From; delay?: number; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const spring = motion.springUi;
  const entering = () => {
    "worklet";
    const dx = from === "left" ? -24 : from === "right" ? 24 : 0;
    const dy = from === "down" ? 24 : from === "up" ? -24 : 0;
    const scale = from === "pop" ? 0.6 : 1;
    return {
      initialValues: { opacity: 0, transform: [{ translateX: dx }, { translateY: dy }, { scale }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })),
        transform: [
          { translateX: withDelay(delay, withSpring(0, spring)) },
          { translateY: withDelay(delay, withSpring(0, spring)) },
          { scale: withDelay(delay, withSpring(1, spring)) },
        ],
      },
    };
  };
  return <Animated.View entering={reduceMotion ? undefined : entering}>{children}</Animated.View>;
}

/** El contenedor de una vuelta: al cambiar `cycle` la vuelta anterior se desvanece y la nueva vuelve a entrar. */
export function DemoRound({ cycle, children, style }: { cycle: number; children: ReactNode; style?: object }) {
  return (
    <Animated.View key={cycle} exiting={FadeOut.duration(200)} style={[{ flex: 1, justifyContent: "center" }, style]}>
      {children}
    </Animated.View>
  );
}
