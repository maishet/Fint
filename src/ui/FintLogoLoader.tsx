import { useEffect } from "react";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Ellipse, G, Path, Rect } from "react-native-svg";
import { useTheme } from "tamagui";
import { BRAND_COIN_EDGE, BRAND_COINS, BRAND_TILE, BRAND_TILE_SCALE, coinEdgePath } from "./BrandSymbol";

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Tiempos del ciclo en ms. Marca D: sin el aro ni el disco, las monedas empiezan a caer enseguida; la respiración,
 * la salida y el ciclo de 4.1 s quedan como estaban.
 */
const T = {
  drop: 120,
  stagger: 190,
  dropDur: 560,
  breatheStart: 2700,
  breatheEnd: 3580,
  outEnd: 4060,
  total: 4100,
};
/** El logo queda completo cuando termina de caer la tercera moneda. */
const LOGO_DONE = T.drop + 2 * T.stagger + T.dropDur;
/** Lo que falta del armado corre a este múltiplo de velocidad cuando llegan los datos. */
const FAST = 2.2;
const EXIT_MS = 220;
/**
 * Al relevar a la pantalla nativa (`startComplete`) el ciclo corre más rápido y empieza respirando: la espera del
 * arranque suele durar 1-2 s y a velocidad normal el logo se quedaba quieto (respiraba recién a los 0.4 s y se
 * desvanecía a los 1.3 s), así que la animación no se llegaba a ver.
 */
const START_TEMPO = 1.8;

// El reloj del ciclo es tiempo, no movimiento: cada pieza aplica su curva encima. Con movimiento reducido
// no corre (ver abajo), así que no debe saltar al final por la opción del sistema.
const clock = (duration: number) => ({ duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never });

function clamp01(x: number) {
  "worklet";
  return Math.max(0, Math.min(1, x));
}
/** Un rebote corto, el equivalente a `spring-gesture` en función del tiempo. */
function springGesture(u: number) {
  "worklet";
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return 1 - Math.exp(-6 * u) * Math.cos(10 * u);
}

/** Cada moneda (cara y canto) cae desde 34 unidades más arriba, escalonada, y aparece con opacidad 1. */
function useCoinProps(t: SharedValue<number>, k: 0 | 1 | 2) {
  const c = BRAND_COINS[k];
  const face = useAnimatedProps(() => {
    const u = (t.value - T.drop - k * T.stagger) / T.dropDur;
    return { cy: c.cy - 34 * (1 - springGesture(clamp01(u))), opacity: clamp01(u * 3) };
  });
  const edge = useAnimatedProps(() => {
    const u = (t.value - T.drop - k * T.stagger) / T.dropDur;
    return { d: coinEdgePath(c.cy - 34 * (1 - springGesture(clamp01(u))), c.rx, c.ry), opacity: clamp01(u * 3) };
  });
  return { face, edge };
}

export interface FintLogoLoaderProps {
  size: number;
  /**
   * `slab`: pantalla completa sobre `launchBg` (la losa amarilla en claro, casi negro en oscuro). `canvas`: dentro de
   * una pantalla. Si el fondo no es amarillo, el logo va en su cuadrado amarillo.
   */
  surface?: "slab" | "canvas";
  /**
   * Arranca desde el logo completo (respira y se desvanece) en lugar de armarlo desde vacío. Empieza por la
   * respiración y corre a `START_TEMPO`: es la espera corta del arranque.
   */
  startComplete?: boolean;
  /** Llegaron los datos: termina de armar el logo (rápido), sale y llama `onDone`. */
  ready?: boolean;
  /**
   * Con `false`, al llegar los datos se llama `onDone` enseguida y el logo sigue con su ciclo (sin salir): lo que
   * viene después lo tapa con su propia transición cuando termina de montar. Por defecto sale con `fade`.
   */
  exitOnReady?: boolean;
  /** Empieza la salida (el logo ya está completo): para que la frase salga junto con él. */
  onLeave?: () => void;
  onDone?: () => void;
}

/**
 * El logo D que se arma mientras se espera: las tres monedas caen una sobre
 * otra con un rebote corto, respiran una vez y el ciclo vuelve a empezar
 * (4.1 s). Donde el fondo no es amarillo, el cuadrado amarillo queda quieto y
 * solo las monedas se arman. Cuando llega `ready` nunca se corta a la mitad:
 * completa el logo al doble de velocidad y recién ahí sale con `fade` y escala
 * 0.96. Con movimiento reducido, el logo completo queda quieto.
 */
export function FintLogoLoader({ size, surface = "canvas", startComplete = false, ready = false, exitOnReady = true, onLeave, onDone }: FintLogoLoaderProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? LOGO_DONE : startComplete ? T.breatheStart : 0);
  const tempo = startComplete ? START_TEMPO : 1;
  const exit = useSharedValue(0);

  // Sobre la losa amarilla las monedas van solas; en cualquier otro fondo, dentro del cuadrado amarillo.
  const onYellow = surface === "slab" && theme.launchBg.val === theme.slab.val;
  const coin = theme.slabInk.val;
  const scale = onYellow ? 1 : BRAND_TILE_SCALE;
  const side = 120 - 2 * BRAND_TILE.inset;

  // El ciclo mientras se espera. Con movimiento reducido, el logo completo y quieto: sin animación continua.
  useEffect(() => {
    if (ready && exitOnReady) return;
    if (reduceMotion) {
      t.value = LOGO_DONE;
      return;
    }
    const restart = withRepeat(withSequence(withTiming(0, clock(0)), withTiming(T.total, clock(T.total / tempo))), -1, false);
    t.value = withSequence(withTiming(T.total, clock(Math.max(0, T.total - t.value) / tempo)), restart);
    return () => cancelAnimation(t);
    // Solo al montar y al cambiar la preferencia; `ready` corta el ciclo en el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  // Llegaron los datos: completar el logo si hace falta y salir.
  useEffect(() => {
    if (!ready) return;
    // Sin salida propia, el ciclo sigue: montar lo que viene tarda (el Inicio, ~2 s en desarrollo) y, completo y
    // quieto, el logo parecía no tener animación.
    if (!exitOnReady) {
      onDone?.();
      return;
    }
    cancelAnimation(t);
    const leave = () => {
      "worklet";
      if (onLeave) runOnJS(onLeave)();
      exit.value = withTiming(1, { duration: EXIT_MS, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }, (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      });
    };
    if (reduceMotion) {
      leave();
      return;
    }
    const now = t.value;
    if (now < LOGO_DONE) {
      // Lo que falta del armado, al doble de velocidad.
      t.value = withTiming(LOGO_DONE, clock((LOGO_DONE - now) / (FAST * tempo)), (finished) => {
        if (finished) leave();
      });
    } else if (now > T.breatheEnd) {
      // Estaba desvaneciéndose: vuelve al logo completo antes de irse.
      t.value = withTiming(T.breatheEnd, clock((now - T.breatheEnd) / (FAST * tempo)), (finished) => {
        if (finished) leave();
      });
    } else {
      leave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // La salida (al llegar los datos) se lleva todo, cuadrado incluido.
  const leaving = useAnimatedStyle(() => ({ opacity: 1 - exit.value, transform: [{ scale: 1 - 0.04 * exit.value }] }));
  // La respiración y el desvanecido del ciclo son solo de las monedas: el cuadrado no parpadea al reiniciar.
  const coinsFrame = useAnimatedStyle(() => {
    const now = t.value;
    const out = clamp01((now - T.breatheEnd) / (T.outEnd - T.breatheEnd));
    let s = 1 - 0.05 * out;
    if (now > T.breatheStart && now < T.breatheEnd) {
      s *= 1 + 0.02 * Math.sin(((now - T.breatheStart) / (T.breatheEnd - T.breatheStart)) * Math.PI);
    }
    return { opacity: 1 - out, transform: [{ scale: s }] };
  });

  const coinProps = [useCoinProps(t, 0), useCoinProps(t, 1), useCoinProps(t, 2)];

  return (
    <Animated.View style={[{ width: size, height: size }, leaving]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {onYellow ? null : (
        <Svg width={size} height={size} viewBox="0 0 120 120" style={{ position: "absolute" }}>
          <Rect x={BRAND_TILE.inset} y={BRAND_TILE.inset} width={side} height={side} rx={BRAND_TILE.radius} fill={theme.slab.val} />
        </Svg>
      )}
      <Animated.View style={[{ width: size, height: size }, coinsFrame]}>
        <Svg width={size} height={size} viewBox="0 0 120 120" style={{ overflow: "visible" }}>
          <G transform={`translate(60 60) scale(${scale}) translate(-60 -60)`}>
            {BRAND_COINS.map((c, k) => (
              <G key={k}>
                <AnimatedPath fill={BRAND_COIN_EDGE} animatedProps={coinProps[k].edge} />
                <AnimatedEllipse cx={60} rx={c.rx} ry={c.ry} fill={coin} animatedProps={coinProps[k].face} />
              </G>
            ))}
          </G>
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
