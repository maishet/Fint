import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { View, useTheme } from "tamagui";
import { getCurrencySymbol } from "../finance/currencies";
import { MINUS, THIN_SPACE } from "../finance/formatAmount";
import { displayAmountInput } from "../forms/amountInput";
import { motion } from "../theme/tokens";
import { fontFace } from "../theme/typography";

/** Tamaños del monto: baja en pasos de 8px si no cabe, nunca pasa a dos líneas. */
const SIZES = [64, 56, 48, 40] as const;
const HEIGHT = 72;
/**
 * Los dígitos de IBM Plex Sans son tabulares: todos avanzan lo mismo, así cada pieza se ubica con cálculo. El
 * avance se mide una vez en el dispositivo (diez ceros a 40px, que caben sin partirse); mientras tanto, 0.6em.
 */
const ADVANCE = 0.6;
const FACE = fontFace.mono[600];
const PROBE_SIZE = 40;
/** Interletrado por carácter: −1px a 64px. El −3px de `amount-input` encimaba los dígitos en Android. */
const TRACKING = -0.016;
/** El símbolo y el signo, a 30px cuando la cifra va a 64px. */
const MINOR = 30 / 64;
/** Alto de línea de cada texto, en proporción a su tamaño. Igual para todos, para alinear líneas base. */
const LINE = 1.0625;
/**
 * Distancia de la parte de arriba de la caja a la línea base, en proporción al tamaño: Android centra la
 * altura de Plex (1.025em arriba de la línea base y 0.275em abajo) dentro de la línea de `LINE`.
 */
const BASELINE = (LINE - (1.025 + 0.275)) / 2 + 1.025;
/** El espacio fino de miles y el punto decimal ocupan menos que un dígito (en Plex, 0.118em y 0.3em contra 0.6em). */
const THIN_UNITS = 0.2;
const POINT_UNITS = 0.5;

export interface AmountDisplayProps {
  /** Lo que la persona escribió con el teclado: "84.5". */
  input: string;
  currency?: string;
  /** `expense` pinta `−` en `flowOut`, `income` pinta `+` en `flowIn`, `transfer` va sin signo. */
  kind?: "expense" | "income" | "transfer";
  /** Muestra el cursor `brand` de 3px: el campo está activo. */
  active?: boolean;
}

interface Geometry {
  width: SharedValue<number>;
  /** El avance real de un carácter, en em. */
  advance: SharedValue<number>;
  size: SharedValue<number>;
  /** Ancho de la cifra en "unidades" de dígito; se anima para que todo se corra con el mismo resorte. */
  units: SharedValue<number>;
  signOn: SharedValue<number>;
  /** Ancho del símbolo de la moneda, en em. */
  symbolEm: number;
  caret: boolean;
}

/** Ancho de lo que va antes de la cifra (signo y símbolo) y del cursor. */
function prefixWidth(size: number, signOn: number, symbolEm: number, advance: number) {
  "worklet";
  const m = size * MINOR;
  return signOn * (m * advance + 6) + m * symbolEm + 8;
}

function digitAdvance(size: number, advance: number) {
  "worklet";
  return size * (advance + TRACKING);
}

/** Donde empieza la fila completa, centrada en el ancho disponible. */
function rowStart(g: Geometry) {
  "worklet";
  const s = g.size.value;
  const a = g.advance.value;
  const total = prefixWidth(s, g.signOn.value, g.symbolEm, a) + g.units.value * digitAdvance(s, a) + (g.caret ? 7 : 0);
  return (g.width.value - total) / 2;
}

/**
 * El monto del formulario, en `amount-input`: 64px centrado, con el símbolo a
 * 30px en `inkFaint`, el signo delante y todo sobre la misma línea base. Sin
 * monto muestra "0" en `inkFaint`.
 *
 * Cada pieza se ubica con cálculo (los dígitos son tabulares) y se anima sola:
 * el dígito nuevo entra desde 8px más abajo con `spring-ui` y los anteriores se
 * corren con el mismo resorte; al borrar, el dígito sale hacia abajo. Si deja
 * de caber, el tamaño baja un paso con `spring-ui`.
 */
export function AmountDisplay({ input, currency = "PEN", kind = "expense", active = true }: AmountDisplayProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [measured, setMeasured] = useState(0);
  const [advanceEm, setAdvanceEm] = useState(ADVANCE);
  const [symbolWidth, setSymbolWidth] = useState<{ symbol: string; em: number } | null>(null);

  const text = displayAmountInput(input);
  const symbol = getCurrencySymbol(currency);
  const sign = kind === "expense" ? MINUS : kind === "income" ? "+" : "";
  const empty = input === "";
  // El símbolo no es tabular ("S/" mide menos que dos dígitos): se mide en el dispositivo como el avance.
  const symbolEm = symbolWidth?.symbol === symbol ? symbolWidth.em : symbol.length * ADVANCE;

  // Cada carácter con su posición en unidades de dígito. Los espacios de miles no cuentan como dígito, así un
  // dígito conserva su clave (y su animación) aunque cambie la agrupación. El punto ocupa medio dígito.
  const glyphs = useMemo(() => {
    if (empty) return { list: [{ key: "empty", ch: text, offset: 0 }], units: 1 };
    let digit = 0;
    let offset = 0;
    const list = [...text].map((ch) => {
      const isSpace = ch === THIN_SPACE;
      const glyph = { key: isSpace ? `s${digit}` : `d${digit++}`, ch, offset };
      offset += isSpace ? THIN_UNITS : ch === "." ? POINT_UNITS : 1;
      return glyph;
    });
    return { list, units: offset };
  }, [empty, text]);

  const fits = (s: number) =>
    prefixWidth(s, sign ? 1 : 0, symbolEm, advanceEm) + glyphs.units * digitAdvance(s, advanceEm) + 7 + 12 <= measured;
  const target = measured === 0 ? SIZES[0] : (SIZES.find(fits) ?? SIZES[SIZES.length - 1]);

  const width = useSharedValue(0);
  const advance = useSharedValue(ADVANCE);
  const size = useSharedValue<number>(target);
  const units = useSharedValue(glyphs.units);
  const signOn = useSharedValue(sign ? 1 : 0);
  useEffect(() => {
    const go = (sv: SharedValue<number>, v: number) => {
      sv.value = reduceMotion ? v : withSpring(v, motion.springUi);
    };
    go(size, target);
    go(units, glyphs.units);
    go(signOn, sign ? 1 : 0);
  }, [glyphs.units, reduceMotion, sign, signOn, size, target, units]);

  const geometry: Geometry = { width, advance, size, units, signOn, symbolEm, caret: active };

  // El signo cruza de `−` a `+` con `fade` al cambiar de tipo.
  const signOpacity = useSharedValue(sign ? 1 : 0);
  const lastSign = useRef(sign);
  useEffect(() => {
    if (lastSign.current === sign) return;
    lastSign.current = sign;
    if (reduceMotion) {
      signOpacity.value = sign ? 1 : 0;
      return;
    }
    signOpacity.value = sign ? withSequence(withTiming(0, { duration: 0 }), withTiming(1, motion.fade)) : withTiming(0, motion.fade);
  }, [reduceMotion, sign, signOpacity]);

  // Todas las piezas comparten la línea base de la cifra.
  const baseline = (s: number) => {
    "worklet";
    return (HEIGHT - s * LINE) / 2 + s * BASELINE;
  };

  const signStyle = useAnimatedStyle(() => {
    const s = size.value;
    const m = s * MINOR;
    return {
      opacity: signOpacity.value,
      fontSize: m,
      lineHeight: m * LINE,
      left: rowStart(geometry),
      top: baseline(s) - m * BASELINE,
    };
  });
  const symbolStyle = useAnimatedStyle(() => {
    const s = size.value;
    const m = s * MINOR;
    return {
      fontSize: m,
      lineHeight: m * LINE,
      left: rowStart(geometry) + signOn.value * (m * advance.value + 6),
      top: baseline(s) - m * BASELINE,
    };
  });

  const caretOpacity = useSharedValue(1);
  useEffect(() => {
    if (!active || reduceMotion) {
      caretOpacity.value = 1;
      return;
    }
    caretOpacity.value = withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 500 })), -1);
  }, [active, caretOpacity, reduceMotion]);
  const caretStyle = useAnimatedStyle(() => {
    const s = size.value;
    const h = s * 0.84;
    return {
      opacity: caretOpacity.value,
      height: h,
      left:
        rowStart(geometry) +
        prefixWidth(s, signOn.value, geometry.symbolEm, advance.value) +
        units.value * digitAdvance(s, advance.value) +
        4,
      top: (HEIGHT - h) / 2,
    };
  });

  const signColor = kind === "income" ? theme.flowIn.val : theme.flowOut.val;
  const valueLabel = `${sign}${symbol} ${text.replaceAll(THIN_SPACE, "")}`;
  const valueColor = empty ? theme.inkFaint.val : theme.ink.val;

  return (
    <View
      height={HEIGHT}
      onLayout={(e: LayoutChangeEvent) => {
        const w = e.nativeEvent.layout.width;
        width.value = w;
        setMeasured(w);
      }}
      accessible
      accessibilityRole="text"
      accessibilityLabel={t("forms.amount") + ": " + valueLabel}
      accessibilityLiveRegion="polite"
    >
      {/* Sondas invisibles: miden el avance real de un dígito y el ancho del símbolo en este dispositivo. */}
      <Text
        style={{ position: "absolute", opacity: 0, fontFamily: FACE, fontSize: PROBE_SIZE, includeFontPadding: false }}
        onLayout={(e: LayoutChangeEvent) => {
          const em = e.nativeEvent.layout.width / (PROBE_SIZE * 10);
          if (em > 0.3 && em < 1) {
            advance.value = em;
            setAdvanceEm(em);
          }
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        0000000000
      </Text>
      <Text
        key={symbol}
        style={{ position: "absolute", opacity: 0, fontFamily: FACE, fontSize: PROBE_SIZE, includeFontPadding: false }}
        onLayout={(e: LayoutChangeEvent) => {
          const em = e.nativeEvent.layout.width / PROBE_SIZE;
          if (em > 0) setSymbolWidth({ symbol, em });
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {symbol}
      </Text>
      {measured > 0 ? (
        <>
          <Animated.Text style={[{ position: "absolute", fontFamily: FACE, color: signColor, includeFontPadding: false }, signStyle]}>
            {sign || MINUS}
          </Animated.Text>
          <Animated.Text
            style={[{ position: "absolute", fontFamily: FACE, color: theme.inkFaint.val, includeFontPadding: false }, symbolStyle]}
          >
            {symbol}
          </Animated.Text>
          {glyphs.list.map((g) => (
            <Glyph key={g.key} ch={g.ch} offset={g.offset} color={valueColor} geometry={geometry} reduceMotion={reduceMotion} baseline={baseline} />
          ))}
          {active ? (
            <Animated.View style={[{ position: "absolute", width: 3, borderRadius: 2, backgroundColor: theme.brand.val }, caretStyle]} />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Glyph({
  ch,
  offset,
  color,
  geometry,
  reduceMotion,
  baseline,
}: {
  ch: string;
  offset: number;
  color: string;
  geometry: Geometry;
  reduceMotion: boolean;
  baseline: (size: number) => number;
}) {
  // Su lugar dentro de la cifra: al montarse ya está ahí (entra desde abajo); si cambia la agrupación, se corre.
  const at = useSharedValue(offset);
  useEffect(() => {
    at.value = reduceMotion ? offset : withSpring(offset, motion.springUi);
  }, [at, offset, reduceMotion]);

  const style = useAnimatedStyle(() => {
    const s = geometry.size.value;
    return {
      fontSize: s,
      lineHeight: s * LINE,
      left:
        rowStart(geometry) +
        prefixWidth(s, geometry.signOn.value, geometry.symbolEm, geometry.advance.value) +
        at.value * digitAdvance(s, geometry.advance.value),
      top: baseline(s) - s * BASELINE,
    };
  });

  return (
    <Animated.Text
      entering={reduceMotion ? undefined : digitIn}
      exiting={reduceMotion ? undefined : digitOut}
      style={[{ position: "absolute", fontFamily: FACE, fontVariant: ["tabular-nums"], color, includeFontPadding: false }, style]}
    >
      {ch}
    </Animated.Text>
  );
}

function digitIn() {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 8 }] },
    animations: {
      opacity: withTiming(1, { duration: 120 }),
      transform: [{ translateY: withSpring(0, motion.springUi) }],
    },
  };
}

function digitOut() {
  "worklet";
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
    animations: {
      opacity: withTiming(0, { duration: 120 }),
      transform: [{ translateY: withTiming(8, { duration: 120 }) }],
    },
  };
}
