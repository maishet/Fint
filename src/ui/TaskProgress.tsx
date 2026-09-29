import { Check, X } from "@tamagui/lucide-icons-2";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { View, XStack, YStack, useTheme } from "tamagui";
import { withAlpha } from "../theme/color";
import { motion, radius, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FintButton } from "./FintButton";
import { FText } from "./FText";
import { haptics } from "./haptics";
import { PressableScale } from "./PressableScale";

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface TaskStep {
  label: string;
  done: boolean;
  /** Su conteo a la derecha, en `mono` ("128"). */
  count?: string;
}

export interface TaskResult {
  tone: "success" | "error";
  title: string;
  /** Lo que ya se guardó, o qué pasó ("Se guardaron 128 de 300"). */
  detail?: string;
  primary?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}

export interface TaskProgressProps {
  variant?: "screen" | "compact" | "inline";
  /** Nombre de la tarea en versalitas ("IMPORTAR CSV"). */
  kind?: string;
  icon?: ReactNode;
  /** En gerundio: "Importando tus movimientos". */
  title: string;
  steps?: TaskStep[];
  /** Con cantidad conocida: lo procesado y el total. Sin total, cuenta el tiempo transcurrido. */
  value?: number;
  total?: number;
  /** "movimientos", "comprobantes", "%". */
  unit?: string;
  hint?: string;
  result?: TaskResult | null;
  onCancel?: () => void;
  onBackground?: () => void;
}

/**
 * La carga de una tarea (`CargaTarea` del design system): cuenta el trabajo real con ruedas de dígitos en `mono`
 * (lo procesado de un total o, si no hay cantidad, el tiempo transcurrido), un riel y las etapas reales de la tarea.
 * Al terminar, el check se dibuja y aparecen el resultado y las acciones. Tres variantes: `screen` (pantalla completa
 * sobre `canvas`), `compact` (un recuadro dentro de una tarjeta) e `inline` (dentro de un botón, con el porcentaje).
 */
export function TaskProgress({ variant = "screen", kind, icon, title, steps = [], value, total, unit, hint, result, onCancel, onBackground }: TaskProgressProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const elapsed = useElapsed(!result && total == null);
  const known = total != null && value != null;
  const progress = result ? 1 : known ? Math.min(1, total ? value / total : 0) : null;
  const success = result?.tone === "success";

  // El éxito se siente en el mismo cuadro en que se dibuja el check.
  useEffect(() => {
    if (result?.tone === "success") haptics.success();
    else if (result?.tone === "error") haptics.error();
  }, [result?.tone]);

  const counter = known ? (
    <XStack items="flex-end" gap={10}>
      <Odometer value={value} digits={String(total).length} size={variant === "screen" ? 56 : 18} />
      <FText tone="inkMuted" style={{ fontSize: variant === "screen" ? 14 : 13, lineHeight: 20, marginBottom: variant === "screen" ? 10 : 0 }}>
        {t("taskProgress.of", { total, unit: unit ?? "" })}
      </FText>
    </XStack>
  ) : (
    <XStack items="flex-end" gap={10}>
      <Clock seconds={elapsed} size={variant === "screen" ? 56 : 18} />
      <FText tone="inkMuted" style={{ fontSize: variant === "screen" ? 14 : 13, lineHeight: 20, marginBottom: variant === "screen" ? 10 : 0 }}>
        {t("taskProgress.elapsed")}
      </FText>
    </XStack>
  );

  if (variant === "inline") {
    return (
      <XStack height={36} px={14} gap={8} items="center" rounded={radius.pill} bg="$brandWash" accessibilityRole="progressbar" accessibilityValue={known ? { min: 0, max: 100, now: Math.round((progress ?? 0) * 100) } : undefined}>
        <FText tone="brand" style={{ fontFamily: fontFace.sans[600], fontSize: 13, lineHeight: 18 }}>
          {title}
        </FText>
        {known ? <Odometer value={Math.round((progress ?? 0) * 100)} digits={2} size={13} tone="brand" /> : <Clock seconds={elapsed} size={13} tone="brand" />}
        {known ? (
          <FText tone="brand" style={{ fontFamily: fontFace.mono[500], fontSize: 13, lineHeight: 18 }}>
            %
          </FText>
        ) : null}
      </XStack>
    );
  }

  if (variant === "compact") {
    return (
      <XStack
        gap={12}
        items="center"
        px={14}
        py={12}
        rounded={radius.md}
        bg="$surfaceSunken"
        accessibilityRole="progressbar"
        accessibilityLabel={title}
        accessibilityValue={known ? { min: 0, max: total, now: value } : undefined}
      >
        {known ? <Odometer value={value} digits={String(total).length} size={18} /> : <Clock seconds={elapsed} size={18} />}
        <YStack flex={1} minW={0}>
          <FText tone="inkMuted" numberOfLines={2} style={{ fontSize: 13, lineHeight: 18 }} accessibilityLiveRegion="polite">
            {known && !result ? (
              <FText tone="ink" style={{ fontFamily: fontFace.sans[600], fontSize: 13, lineHeight: 18 }}>
                {`${t("taskProgress.of", { total, unit: unit ?? "" })} · `}
              </FText>
            ) : null}
            {result ? result.title : title}
          </FText>
          <View mt={8}>
            <Rail progress={progress} height={3} tone={success ? "flowIn" : "brand"} />
          </View>
        </YStack>
      </XStack>
    );
  }

  const currentIndex = steps.findIndex((s) => !s.done);
  return (
    <YStack flex={1} bg="$canvas" pt={insets.top} pb={Math.max(insets.bottom, 16) + 10}>
      <XStack minH={48} px={space[4]} pt={8} items="center" justify={onBackground ? "flex-end" : "flex-start"}>
        {!result && onCancel ? (
          <PressableScale onPress={onCancel} haptic="tap" accessibilityRole="button" accessibilityLabel={t("taskProgress.cancel")}>
            <View width={40} height={40} rounded={radius.pill} items="center" justify="center" bg="$surface" borderWidth={1} borderColor="$line">
              <X size={18} color="$ink" strokeWidth={2} />
            </View>
          </PressableScale>
        ) : null}
        {!result && onBackground ? (
          <PressableScale onPress={onBackground} haptic="tap" accessibilityRole="button">
            <FText tone="inkMuted" style={{ fontFamily: fontFace.sans[600], fontSize: 14 }}>
              {t("taskProgress.background")}
            </FText>
          </PressableScale>
        ) : null}
      </XStack>

      <YStack flex={1} justify="center" px={space[6]} pb={60} accessibilityRole="progressbar" accessibilityLabel={result ? result.title : title}>
        {result ? (
          <ResultMark success={success} />
        ) : (
          <XStack items="center" gap={8}>
            <View width={28} height={28} rounded={radius.sm} bg="$brandWash" items="center" justify="center">
              {icon}
            </View>
            {kind ? (
              <FText tone="inkFaint" style={{ fontFamily: fontFace.sans[600], fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase" }}>
                {kind}
              </FText>
            ) : null}
          </XStack>
        )}
        <Animated.View key={result ? "result" : "title"} entering={FadeIn.duration(motion.fade.duration)}>
          <FText style={{ fontFamily: fontFace.display[600], fontSize: 26, lineHeight: 31, letterSpacing: -0.6, marginTop: 14 }} accessibilityLiveRegion="polite">
            {result ? result.title : title}
          </FText>
          {result?.detail ? (
            <FText tone="inkMuted" style={{ fontSize: 14, lineHeight: 20, marginTop: 6 }}>
              {result.detail}
            </FText>
          ) : null}
        </Animated.View>
        {!result ? <View mt={26}>{counter}</View> : null}
        <View mt={18}>
          <Rail progress={progress} height={6} tone={result ? (success ? "flowIn" : "dangerHard") : "brand"} />
        </View>
        {steps.length ? (
          <YStack mt={26} gap={14}>
            {steps.map((step, i) => (
              <StepRow key={step.label} step={step} current={!result && i === currentIndex} done={step.done || success} />
            ))}
          </YStack>
        ) : null}
        {hint && !result ? (
          <FText tone="inkFaint" style={{ fontSize: 12, lineHeight: 17, marginTop: 24 }}>
            {hint}
          </FText>
        ) : null}
      </YStack>

      {result ? (
        <Animated.View entering={FadeIn.duration(motion.fade.duration)}>
          <YStack px={space[4]} gap={10}>
            {result.primary ? <FintButton onPress={result.primary.onPress}>{result.primary.label}</FintButton> : null}
            {result.secondary ? (
              <FintButton variant="outlined" onPress={result.secondary.onPress}>
                {result.secondary.label}
              </FintButton>
            ) : null}
          </YStack>
        </Animated.View>
      ) : null}
    </YStack>
  );
}

/** Segundos desde que empezó la tarea, que avanzan cada segundo mientras corre. */
function useElapsed(running: boolean) {
  const [started] = useState(() => Date.now());
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running, started]);
  return seconds;
}

/** Una rueda de dígitos: la tira 0-9 que hace un resorte (`spring-ui`) hasta su dígito. */
export function DigitWheel({ digit, size, dim = false, tone = "ink" }: { digit: number; size: number; dim?: boolean; tone?: "ink" | "brand" }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const line = Math.round(size * 1.08);
  const y = useSharedValue(-digit * line);
  useEffect(() => {
    y.value = reduceMotion ? -digit * line : withSpring(-digit * line, motion.springUi);
  }, [digit, line, reduceMotion, y]);
  const strip = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const color = dim ? theme.inkFaint.val : tone === "brand" ? theme.brand.val : theme.ink.val;
  return (
    <View height={line} overflow="hidden" style={{ opacity: dim ? 0.35 : 1 }}>
      <Animated.View style={strip}>
        {Array.from({ length: 10 }, (_, n) => (
          <Animated.Text
            key={n}
            style={{ height: line, lineHeight: line, fontSize: size, fontFamily: fontFace.mono[500], color, textAlign: "center", letterSpacing: size > 30 ? -2 : 0, includeFontPadding: false }}
          >
            {n}
          </Animated.Text>
        ))}
      </Animated.View>
    </View>
  );
}

/** El número en ruedas: con ceros a la izquierda apagados, así crece sin cambiar de ancho. */
function Odometer({ value, digits, size, tone = "ink" }: { value: number; digits: number; size: number; tone?: "ink" | "brand" }) {
  const text = String(Math.max(0, Math.round(value))).padStart(digits, "0");
  const lead = text.length - String(Math.max(0, Math.round(value))).length;
  return (
    <XStack accessible accessibilityLabel={String(Math.round(value))}>
      {[...text].map((ch, i) => (
        <DigitWheel key={i} digit={Number(ch)} size={size} dim={i < lead} tone={tone} />
      ))}
    </XStack>
  );
}

/** El tiempo transcurrido en ruedas: "0:14". */
function Clock({ seconds, size, tone = "ink" }: { seconds: number; size: number; tone?: "ink" | "brand" }) {
  const theme = useTheme();
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const line = Math.round(size * 1.08);
  return (
    <XStack accessible accessibilityLabel={`${m}:${String(s).padStart(2, "0")}`}>
      {[...String(m)].map((ch, i) => (
        <DigitWheel key={`m${i}`} digit={Number(ch)} size={size} tone={tone} />
      ))}
      <Animated.Text style={{ height: line, lineHeight: line, fontSize: size, fontFamily: fontFace.mono[500], color: tone === "brand" ? theme.brand.val : theme.ink.val, includeFontPadding: false }}>
        :
      </Animated.Text>
      <DigitWheel digit={Math.floor(s / 10)} size={size} tone={tone} />
      <DigitWheel digit={s % 10} size={size} tone={tone} />
    </XStack>
  );
}

/**
 * El riel: con cantidad, la parte hecha crece con `spring-ui`; sin cantidad, un tramo de un tercio lo recorre de lado
 * a lado sin simular un porcentaje. Con movimiento reducido, quieto al 100 % y la opacidad late.
 */
function Rail({ progress, height, tone }: { progress: number | null; height: number; tone: "brand" | "flowIn" | "dangerHard" }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const fill = useSharedValue(progress ?? 0);
  const sweep = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (progress != null) fill.value = reduceMotion ? progress : withSpring(progress, motion.springUi);
  }, [fill, progress, reduceMotion]);
  useEffect(() => {
    if (progress != null) return;
    if (reduceMotion) {
      pulse.value = withRepeat(withSequence(withTiming(0.45, motion.fade), withTiming(1, motion.fade)), -1, false);
      return;
    }
    sweep.value = 0;
    sweep.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.bezier(0.45, 0, 0.55, 1) }), -1, false);
  }, [progress, pulse, reduceMotion, sweep]);

  const bar = useAnimatedStyle(() => {
    if (progress != null) return { left: 0, width: width * fill.value, opacity: 1 };
    if (reduceMotion) return { left: 0, width, opacity: pulse.value };
    const segment = width * 0.34;
    return { left: -segment + (width + segment) * sweep.value, width: segment, opacity: 1 };
  });

  const color = tone === "flowIn" ? theme.flowIn.val : tone === "dangerHard" ? theme.dangerHard.val : theme.brand.val;
  return (
    <View height={height} rounded={height / 2} overflow="hidden" bg="$chartTrack" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, borderRadius: height / 2, backgroundColor: color }, bar]} />
    </View>
  );
}

function StepRow({ step, current, done }: { step: TaskStep; current: boolean; done: boolean }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!current || reduceMotion) return;
    pulse.value = withRepeat(withSequence(withTiming(0.35, { duration: 600 }), withTiming(1, { duration: 600 })), -1, false);
  }, [current, pulse, reduceMotion]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value, transform: [{ scale: 0.7 + 0.3 * pulse.value }] }));

  return (
    <XStack items="center" gap={12}>
      <View
        width={22}
        height={22}
        rounded={999}
        items="center"
        justify="center"
        borderWidth={1.5}
        borderColor={done ? "$flowIn" : current ? "$brand" : "$lineStrong"}
        bg={done ? "$flowIn" : "transparent"}
        opacity={done || current ? 1 : 0.6}
      >
        {done ? <Check size={13} color="$onBrand" strokeWidth={3} /> : current ? <Animated.View style={[{ width: 8, height: 8, borderRadius: 4 }, dot]}><View flex={1} rounded={4} bg="$brand" /></Animated.View> : null}
      </View>
      <FText
        tone={done ? "inkMuted" : current ? "ink" : "inkFaint"}
        style={{ flex: 1, fontSize: 14, lineHeight: 19, fontFamily: current ? fontFace.sans[600] : fontFace.sans[400] }}
        accessibilityLiveRegion={current ? "polite" : undefined}
      >
        {step.label}
      </FText>
      {step.count ? (
        <FText tone="inkFaint" style={{ fontFamily: fontFace.mono[500], fontSize: 12, lineHeight: 16 }}>
          {step.count}
        </FText>
      ) : null}
    </XStack>
  );
}

/** El check del final se dibuja en 500 ms (sin dibujarse con movimiento reducido); el error, una X quieta. */
function ResultMark({ success }: { success: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const drawn = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) drawn.value = withTiming(1, { duration: 500, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  }, [drawn, reduceMotion]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: 30 * (1 - drawn.value) }));
  if (!success) {
    return (
      <View width={56} height={56} rounded={999} items="center" justify="center" bg="$surfaceSunken">
        <X size={26} color="$dangerHard" strokeWidth={2.4} />
      </View>
    );
  }
  return (
    <View width={56} height={56} rounded={999} items="center" justify="center" style={{ backgroundColor: withAlpha(theme.flowIn.val, 0.14) }}>
      <Svg width={28} height={28} viewBox="0 0 24 24">
        <AnimatedPath d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={theme.flowIn.val} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={30} animatedProps={props} />
      </Svg>
    </View>
  );
}
