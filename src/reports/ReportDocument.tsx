import { useEffect } from "react";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "tamagui";
import { fontFace } from "../theme/typography";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Una vuelta del dibujo: el contorno, las piezas, un rato completo y el desvanecido. */
const CYCLE_MS = 3800;
/** Con movimiento reducido el documento queda completo y quieto (este instante del ciclo). */
const STILL_MS = 2600;

/** El contorno de la hoja con la esquina doblada, en el `viewBox` de 120 × 150. */
const OUTLINE: [number, number][] = [
  [6, 4],
  [84, 4],
  [114, 34],
  [114, 144],
  [6, 144],
  [6, 4],
];
const SEGMENTS = OUTLINE.slice(1).map(([x, y], i) => {
  const [x0, y0] = OUTLINE[i];
  return { x0, y0, dx: x - x0, dy: y - y0, length: Math.hypot(x - x0, y - y0) };
});
const LENGTH = SEGMENTS.reduce((sum, s) => sum + s.length, 0);
const OUTLINE_D = `M${OUTLINE.map(([x, y]) => `${x} ${y}`).join(" L")}`;

function clamp01(x: number) {
  "worklet";
  return Math.max(0, Math.min(1, x));
}
function easeInOut(x: number) {
  "worklet";
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
function easeOut(x: number) {
  "worklet";
  return 1 - Math.pow(1 - x, 3);
}
/** Cuánto del contorno lleva dibujado el punto. */
function drawn(t: number) {
  "worklet";
  return easeInOut(clamp01((t - 60) / 820));
}
function pointAt(p: number) {
  "worklet";
  let left = p * LENGTH;
  for (const s of SEGMENTS) {
    if (left <= s.length) return { x: s.x0 + (s.dx * left) / s.length, y: s.y0 + (s.dy * left) / s.length };
    left -= s.length;
  }
  return { x: OUTLINE[0][0], y: OUTLINE[0][1] };
}

type Tone = "ink" | "inkFaint" | "lineStrong" | "flowIn" | "chart1" | "chart4";
interface Piece {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  tone: Tone;
  /** Orden de aparición. */
  order: number;
  /** Barra: crece desde abajo. */
  bar?: boolean;
}

/** PDF: título, subtítulo, cinco barras y cuatro filas de tabla con su monto. */
const PDF_PIECES: Piece[] = (() => {
  const list: Piece[] = [
    { x: 18, y: 18, width: 44, height: 6, rx: 3, tone: "ink", order: 0 },
    { x: 18, y: 30, width: 30, height: 4, rx: 2, tone: "inkFaint", order: 1 },
  ];
  [
    [20, 20],
    [34, 30],
    [48, 14],
    [62, 34],
    [76, 24],
  ].forEach(([x, h], i) => list.push({ x, y: 80 - h, width: 9, height: h, rx: 2, tone: i % 2 ? "chart1" : "chart4", order: list.length, bar: true }));
  [92, 104, 116, 128].forEach((y, i) => {
    list.push({ x: 18, y, width: 50 - i * 6, height: 4, rx: 2, tone: "lineStrong", order: list.length });
    list.push({ x: 84, y, width: 18, height: 4, rx: 2, tone: "inkFaint", order: list.length });
  });
  return list;
})();

/** Excel: título, subtítulo y una grilla de 4 × 7 que se enciende en diagonal, con el encabezado en `flowIn`. */
const XLSX_PIECES: Piece[] = (() => {
  const list: Piece[] = [
    { x: 16, y: 16, width: 40, height: 6, rx: 3, tone: "ink", order: 0 },
    { x: 16, y: 27, width: 26, height: 4, rx: 2, tone: "inkFaint", order: 0 },
  ];
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 4; c++)
      list.push({ x: 16 + c * 23, y: 40 + r * 15, width: 20, height: 11, rx: 2, tone: r === 0 ? "flowIn" : c === 3 ? "inkFaint" : "lineStrong", order: r + c + 1 });
  return list;
})();

/**
 * El documento que se dibuja mientras se genera el reporte (`CargaReporte`), con el lenguaje de la pantalla de carga:
 * un punto `brand` con halo recorre el contorno de la hoja, la hoja se llena de `surface` y aparecen las piezas del
 * reporte (barras y filas en el PDF, la grilla en el Excel). Se repite cada 3.8 s; `paused` lo deja quieto donde
 * está (error). Con movimiento reducido, completo y quieto.
 */
export function ReportDocument({ format, paused = false }: { format: "pdf" | "xlsx"; paused?: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? STILL_MS : 0);

  useEffect(() => {
    if (reduceMotion || paused) {
      if (reduceMotion) t.value = STILL_MS;
      return;
    }
    // Un reloj en ms que vuelve a 0 en cada vuelta; al reanudar (Reintentar) empieza una vuelta nueva.
    t.value = 0;
    t.value = withRepeat(withTiming(CYCLE_MS, { duration: CYCLE_MS, easing: Easing.linear, reduceMotion: ReduceMotion.Never }), -1, false);
    return () => cancelAnimation(t);
  }, [paused, reduceMotion, t]);

  const whole = useAnimatedStyle(() => ({ opacity: 1 - clamp01((t.value - 3250) / 450) }));
  const page = useAnimatedProps(() => ({ opacity: easeOut(clamp01((t.value - 820) / 260)) }));
  const fold = useAnimatedProps(() => ({ opacity: clamp01((t.value - 820) / 260) }));
  const line = useAnimatedProps(() => ({
    strokeDashoffset: LENGTH * (1 - drawn(t.value)),
    opacity: t.value > 60 ? 1 - clamp01((t.value - 1000) / 300) : 0,
  }));
  // El punto con su halo, en la punta del trazo mientras se dibuja el contorno.
  const halo = useAnimatedProps(() => {
    const q = pointAt(drawn(t.value));
    return { cx: q.x, cy: q.y, opacity: t.value > 60 && t.value < 880 ? 0.3 : 0 };
  });
  const dot = useAnimatedProps(() => {
    const q = pointAt(drawn(t.value));
    return { cx: q.x, cy: q.y, opacity: t.value > 60 && t.value < 880 ? 1 : 0 };
  });

  const pieces = format === "pdf" ? PDF_PIECES : XLSX_PIECES;
  const colors: Record<Tone, string> = {
    ink: theme.ink.val,
    inkFaint: theme.inkFaint.val,
    lineStrong: theme.lineStrong.val,
    flowIn: theme.flowIn.val,
    chart1: theme.chart1.val,
    chart4: theme.chart4.val,
  };

  return (
    <Animated.View style={whole} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* El `viewBox` deja 6 de margen para que el halo no se corte en las esquinas. */}
      <Svg width={145} height={178} viewBox="-6 -6 132 162">
        <AnimatedPath d={`${OUTLINE_D} Z`} fill={theme.surface.val} stroke={theme.lineStrong.val} strokeWidth={1.5} strokeLinejoin="round" animatedProps={page} />
        <AnimatedPath d="M84 4v24a6 6 0 0 0 6 6h24" fill="none" stroke={theme.lineStrong.val} strokeWidth={1.5} animatedProps={fold} />
        <AnimatedPath
          d={OUTLINE_D}
          fill="none"
          stroke={theme.brand.val}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[LENGTH, LENGTH]}
          animatedProps={line}
        />
        {pieces.map((piece, i) => (
          <PieceRect key={`${format}-${i}`} piece={piece} format={format} color={colors[piece.tone]} t={t} />
        ))}
        <AnimatedCircle r={7} fill={theme.brand.val} animatedProps={halo} />
        <AnimatedCircle r={3} fill={theme.brand.val} stroke={theme.surfaceOverlay.val} strokeWidth={1.5} animatedProps={dot} />
      </Svg>
    </Animated.View>
  );
}

function PieceRect({ piece, format, color, t }: { piece: Piece; format: "pdf" | "xlsx"; color: string; t: SharedValue<number> }) {
  const start = 1050 + piece.order * (format === "pdf" ? 90 : 95);
  const props = useAnimatedProps(() => {
    const u = easeOut(clamp01((t.value - start) / 320));
    const grow = piece.bar ? u : 1;
    return { opacity: u, y: piece.y + piece.height * (1 - grow), height: Math.max(piece.height * grow, 0.1) };
  });
  return <AnimatedRect x={piece.x} y={piece.y} width={piece.width} height={piece.height} rx={piece.rx} fill={color} animatedProps={props} />;
}

/** El ícono de un archivo: la hoja con la esquina doblada y la etiqueta del formato ("PDF" en `flowOut`, "XLSX" en `flowIn`). */
export function FileIcon({ format, width = 46, height = 56 }: { format: "pdf" | "xlsx"; width?: number; height?: number }) {
  const theme = useTheme();
  return (
    <Svg width={width} height={height} viewBox="0 0 46 56">
      <Path d="M4 3a3 3 0 0 1 3-3h22l13 13v38a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill={theme.surfaceSunken.val} stroke={theme.lineStrong.val} strokeWidth={1.2} />
      <Path d="M29 0v10a3 3 0 0 0 3 3h10" fill="none" stroke={theme.lineStrong.val} strokeWidth={1.2} />
      <Rect x={0} y={30} width={30} height={15} rx={3} fill={format === "pdf" ? theme.flowOut.val : theme.flowIn.val} />
      <SvgText x={15} y={41} textAnchor="middle" fill={theme.onBrand.val} fontSize={9} fontFamily={fontFace.sans[600]} letterSpacing={0.4}>
        {format === "pdf" ? "PDF" : "XLSX"}
      </SvgText>
    </Svg>
  );
}
