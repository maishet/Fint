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
import Svg, { Circle, Ellipse } from "react-native-svg";
import { useTheme } from "tamagui";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

/** Las monedas del logo, de la más grande (abajo) a la más chica; las mismas medidas que `BrandSymbol`. */
const COINS = [
  { cy: 78, rx: 34, ry: 11, opacity: 0.55 },
  { cy: 62, rx: 28, ry: 10, opacity: 0.78 },
  { cy: 47, rx: 20, ry: 9, opacity: 1 },
] as const;

const RING_RADIUS = 58;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** Tiempos del ciclo en ms (README de `PantallaCarga`). */
const T = {
  ringStart: 80,
  ringEnd: 980,
  discStart: 900,
  discEnd: 1220,
  ringOutStart: 1100,
  ringOutEnd: 1400,
  drop: 1150,
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
const PULSE_MS = 1600;

// El reloj del ciclo es tiempo, no movimiento: cada pieza aplica su curva encima. Con movimiento reducido
// no corre (ver abajo), así que no debe saltar al final por la opción del sistema.
const clock = (duration: number) => ({ duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never });

function clamp01(x: number) {
  "worklet";
  return Math.max(0, Math.min(1, x));
}
function easeInOutCubic(x: number) {
  "worklet";
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
function easeOutCubic(x: number) {
  "worklet";
  return 1 - Math.pow(1 - x, 3);
}
/** Un rebote corto, el equivalente a `spring-gesture` en función del tiempo. */
function springGesture(u: number) {
  "worklet";
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return 1 - Math.exp(-6 * u) * Math.cos(10 * u);
}

/** Cada moneda cae desde 34 unidades más arriba, escalonada, y aparece en su opacidad del logo. */
function useCoinProps(t: SharedValue<number>, k: 0 | 1 | 2) {
  const c = COINS[k];
  return useAnimatedProps(() => {
    const u = (t.value - T.drop - k * T.stagger) / T.dropDur;
    return { cy: c.cy - 34 * (1 - springGesture(clamp01(u))), opacity: c.opacity * clamp01(u * 3) };
  });
}

export interface FintLogoLoaderProps {
  size: number;
  /** `slab` sobre la losa (pantalla completa); `canvas` dentro de una pantalla. */
  surface?: "slab" | "canvas";
  /** Arranca desde el logo completo (respira y se desvanece) en lugar de armarlo desde vacío. */
  startComplete?: boolean;
  /** Llegaron los datos: termina de armar el logo (rápido), sale y llama `onDone`. */
  ready?: boolean;
  /**
   * Con `false`, al llegar los datos el logo se completa y se queda quieto (sin salir) y `onDone` se llama ahí:
   * lo que viene después lo tapa con su propia transición. Por defecto sale con `fade`.
   */
  exitOnReady?: boolean;
  /** Empieza la salida (el logo ya está completo): para que la frase salga junto con él. */
  onLeave?: () => void;
  onDone?: () => void;
}

/**
 * El logo que se arma mientras se espera: un punto con halo dibuja el aro del
 * disco, el disco se llena y las tres monedas caen una sobre otra con un
 * rebote corto; respira una vez y el ciclo vuelve a empezar (4.1 s). Cuando
 * llega `ready` nunca se corta a la mitad: completa el logo al doble de
 * velocidad y recién ahí sale con `fade` y escala 0.96. Con movimiento
 * reducido, el logo completo late en opacidad.
 */
export function FintLogoLoader({ size, surface = "canvas", startComplete = false, ready = false, exitOnReady = true, onLeave, onDone }: FintLogoLoaderProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(startComplete || reduceMotion ? LOGO_DONE : 0);
  const exit = useSharedValue(0);
  const pulse = useSharedValue(1);

  const onSlab = surface === "slab";
  const disc = onSlab ? theme.glassSlab.val : theme.slab.val;
  const discLine = onSlab ? theme.glassSlabLine.val : "transparent";
  const coin = theme.slabInk.val;
  const ring = onSlab ? theme.brandSlab.val : theme.brand.val;
  const dot = onSlab ? theme.slabInk.val : theme.brand.val;
  const dotLine = onSlab ? "transparent" : theme.canvas.val;

  // El ciclo (o el latido con movimiento reducido) mientras se espera.
  useEffect(() => {
    if (ready) return;
    if (reduceMotion) {
      t.value = LOGO_DONE;
      pulse.value = withRepeat(withTiming(0.6, { duration: PULSE_MS / 2, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }), -1, true);
      return () => cancelAnimation(pulse);
    }
    const restart = withRepeat(withSequence(withTiming(0, clock(0)), withTiming(T.total, clock(T.total))), -1, false);
    t.value = withSequence(withTiming(T.total, clock(Math.max(0, T.total - t.value))), restart);
    return () => cancelAnimation(t);
    // Solo al montar y al cambiar la preferencia; `ready` corta el ciclo en el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  // Llegaron los datos: completar el logo si hace falta y salir.
  useEffect(() => {
    if (!ready) return;
    cancelAnimation(t);
    cancelAnimation(pulse);
    const leave = () => {
      "worklet";
      if (!exitOnReady) {
        if (onDone) runOnJS(onDone)();
        return;
      }
      if (onLeave) runOnJS(onLeave)();
      exit.value = withTiming(1, { duration: EXIT_MS, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }, (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      });
    };
    if (reduceMotion) {
      pulse.value = withTiming(1, clock(120));
      leave();
      return;
    }
    const now = t.value;
    if (now < LOGO_DONE) {
      // Lo que falta del armado, al doble de velocidad.
      t.value = withTiming(LOGO_DONE, clock((LOGO_DONE - now) / FAST), (finished) => {
        if (finished) leave();
      });
    } else if (now > T.breatheEnd) {
      // Estaba desvaneciéndose: vuelve al logo completo antes de irse.
      t.value = withTiming(T.breatheEnd, clock((now - T.breatheEnd) / FAST), (finished) => {
        if (finished) leave();
      });
    } else {
      leave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const frame = useAnimatedStyle(() => {
    const now = t.value;
    const out = clamp01((now - T.breatheEnd) / (T.outEnd - T.breatheEnd));
    let scale = 1 - 0.05 * out;
    if (now > T.breatheStart && now < T.breatheEnd) {
      scale *= 1 + 0.02 * Math.sin(((now - T.breatheStart) / (T.breatheEnd - T.breatheStart)) * Math.PI);
    }
    scale *= 1 - 0.04 * exit.value;
    return { opacity: (1 - out) * (1 - exit.value) * pulse.value, transform: [{ scale }] };
  });

  const discProps = useAnimatedProps(() => ({
    opacity: easeOutCubic(clamp01((t.value - T.discStart) / (T.discEnd - T.discStart))),
  }));

  const drawn = () => {
    "worklet";
    return easeInOutCubic(clamp01((t.value - T.ringStart) / (T.ringEnd - T.ringStart)));
  };
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_LENGTH * (1 - drawn()),
    opacity: t.value < T.ringStart ? 0 : 1 - clamp01((t.value - T.ringOutStart) / (T.ringOutEnd - T.ringOutStart)),
  }));
  // El punto y su halo van en la punta del trazo: al ser un círculo, basta el ángulo.
  const tip = (visible: number) => {
    "worklet";
    const theta = -Math.PI / 2 + 2 * Math.PI * drawn();
    const drawing = t.value >= T.ringStart && t.value <= T.ringEnd;
    return { cx: 60 + RING_RADIUS * Math.cos(theta), cy: 60 + RING_RADIUS * Math.sin(theta), opacity: drawing ? visible : 0 };
  };
  const haloProps = useAnimatedProps(() => tip(0.3));
  const dotProps = useAnimatedProps(() => tip(1));

  const coinProps = [useCoinProps(t, 0), useCoinProps(t, 1), useCoinProps(t, 2)];

  return (
    <Animated.View style={[{ width: size, height: size }, frame]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 120 120" style={{ overflow: "visible" }}>
        <AnimatedCircle cx={60} cy={60} r={RING_RADIUS} fill={disc} stroke={discLine} strokeWidth={1} animatedProps={discProps} />
        <AnimatedCircle
          cx={60}
          cy={60}
          r={RING_RADIUS}
          fill="none"
          stroke={ring}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeDasharray={`${RING_LENGTH} ${RING_LENGTH}`}
          rotation={-90}
          origin="60, 60"
          animatedProps={ringProps}
        />
        {COINS.map((c, k) => (
          <AnimatedEllipse key={k} cx={60} rx={c.rx} ry={c.ry} fill={coin} animatedProps={coinProps[k]} />
        ))}
        <AnimatedCircle r={8} fill={ring} animatedProps={haloProps} />
        <AnimatedCircle r={3.4} fill={dot} stroke={dotLine} strokeWidth={1.5} animatedProps={dotProps} />
      </Svg>
    </Animated.View>
  );
}
