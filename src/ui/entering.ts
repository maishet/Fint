import { withDelay, withSpring, withTiming } from "react-native-reanimated";
import { motion } from "../theme/tokens";

interface RiseInOptions {
  /** Cuánto sube, en px. `0` para solo `fade`. */
  distance?: number;
  /** Desfase en ms, para las entradas escalonadas. */
  delay?: number;
  /** Con "reducir movimiento": `fade` de 180ms sin desplazamiento y sin desfase, todo a la vez. */
  reduceMotion?: boolean;
}

/**
 * Entrada de Reanimated (`entering`): aparece con `fade` y sube `distance` px
 * con `spring-ui`. Se usa para las entradas escalonadas del Inicio: acciones
 * del hero (12px, 40ms), la hoja (40px) y las filas de movimientos (30ms).
 */
export function riseIn({ distance = 12, delay = 0, reduceMotion = false }: RiseInOptions = {}) {
  const duration = motion.fade.duration;
  const spring = motion.springUi;
  return () => {
    "worklet";
    if (reduceMotion) {
      return {
        initialValues: { opacity: 0 },
        animations: { opacity: withTiming(1, { duration }) },
      };
    }
    return {
      initialValues: { opacity: 0, transform: [{ translateY: distance }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, { duration })),
        transform: [{ translateY: withDelay(delay, withSpring(0, spring)) }],
      },
    };
  };
}
