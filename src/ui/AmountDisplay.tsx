import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { XStack, useTheme } from "tamagui";
import { getCurrencySymbol } from "../finance/currencies";
import { MINUS } from "../finance/formatAmount";
import { displayAmountInput } from "../forms/amountInput";
import { motion } from "../theme/tokens";
import { fontFace } from "../theme/typography";

/** Tamaños del monto: baja en pasos de 8px si no cabe, nunca pasa a dos líneas. */
const SIZES = [64, 56, 48, 40] as const;
/** Geist Mono: cada carácter mide 0.6em. Al ser monoespaciada, el ancho se calcula sin medir. */
const ADVANCE = 0.6;

export interface AmountDisplayProps {
  /** Lo que la persona escribió con el teclado: "84.5". */
  input: string;
  currency?: string;
  /** `expense` pinta `−` en `flowOut`, `income` pinta `+` en `flowIn`, `transfer` va sin signo. */
  kind?: "expense" | "income" | "transfer";
  /** Muestra el cursor `brand` de 3px: el campo está activo. */
  active?: boolean;
}

/**
 * El monto del formulario, en `amount-input`: 64px centrado, con el símbolo a
 * 30px en `inkFaint` y el signo delante. Sin monto muestra "0" en `inkFaint`.
 */
export function AmountDisplay({ input, currency = "PEN", kind = "expense", active = true }: AmountDisplayProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);

  const text = displayAmountInput(input);
  const symbol = getCurrencySymbol(currency);
  const sign = kind === "expense" ? MINUS : kind === "income" ? "+" : "";
  const empty = input === "";

  const fits = (size: number) =>
    (text.length * ADVANCE + (sign ? ADVANCE * (30 / 64) : 0) + (symbol.length + 1) * ADVANCE * (30 / 64)) * size + 12 <= width;
  const target = width === 0 ? SIZES[0] : (SIZES.find(fits) ?? SIZES[SIZES.length - 1]);

  const size = useSharedValue<number>(target);
  useEffect(() => {
    size.value = reduceMotion ? target : withSpring(target, motion.springUi);
  }, [reduceMotion, size, target]);

  const caret = useSharedValue(1);
  useEffect(() => {
    if (!active || reduceMotion) {
      caret.value = 1;
      return;
    }
    caret.value = withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 500 })), -1);
  }, [active, caret, reduceMotion]);

  const valueStyle = useAnimatedStyle(() => ({
    fontSize: size.value,
    lineHeight: size.value * 1.0625,
    letterSpacing: -size.value * 0.047,
  }));
  const minorStyle = useAnimatedStyle(() => ({ fontSize: size.value * (30 / 64) }));
  const caretStyle = useAnimatedStyle(() => ({ opacity: caret.value, height: size.value * 0.84 }));

  const signColor = kind === "income" ? theme.flowIn.val : theme.flowOut.val;
  const valueLabel = `${sign}${symbol} ${text.replaceAll(" ", "")}`;

  return (
    <XStack
      justify="center"
      items="center"
      height={72}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="text"
      accessibilityLabel={t("forms.amount") + ": " + valueLabel}
      accessibilityLiveRegion="polite"
    >
      {sign ? (
        <Animated.Text style={[{ fontFamily: fontFace.mono[500], color: signColor, marginRight: 6 }, minorStyle]}>{sign}</Animated.Text>
      ) : null}
      <Animated.Text style={[{ fontFamily: fontFace.mono[500], color: theme.inkFaint.val, marginRight: 8 }, minorStyle]}>
        {symbol}
      </Animated.Text>
      <Animated.Text
        numberOfLines={1}
        style={[
          { fontFamily: fontFace.mono[500], fontVariant: ["tabular-nums"], color: empty ? theme.inkFaint.val : theme.ink.val },
          valueStyle,
        ]}
      >
        {text}
      </Animated.Text>
      {active ? (
        <Animated.View style={[{ width: 3, borderRadius: 2, marginLeft: 4, backgroundColor: theme.brand.val }, caretStyle]} />
      ) : null}
    </XStack>
  );
}
