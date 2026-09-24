import { Canvas, Circle, DashPathEffect, Group, LinearGradient, Path, Skia, Line as SkiaLine, vec } from "@shopify/react-native-skia";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "@tamagui/lucide-icons-2";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NumberFlow } from "number-flow-react-native";
import { Pressable } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  LinearTransition,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Area, CartesianChart, Line, useChartPressState } from "victory-native";
import { View, XStack, YStack, useTheme } from "tamagui";
import { getCategoryLabel } from "../finance/categoryLabels";
import { getAppLocale } from "../i18n";
import { motion, radius, space } from "../theme/tokens";
import { fontFace, textStyles } from "../theme/typography";
import { Amount, FintCard, FText, SectionHeader, SegmentedControl } from "../ui";
import { riseIn } from "../ui/entering";
import { haptics } from "../ui/haptics";
import { cumulative, topCategories, type CategoryShare, type SpendingSeries } from "./spending";

type Tab = "pace" | "categories";
const TAB_KEY = "home.spendingTab";
const CHART_HEIGHT = 120;
const DONUT = 112;
/** Lo que crece hacia afuera la porción elegida. */
const SLICE_GROW = 3;
/** Anillo de 68% de radio interior, dejando lugar para que la porción elegida crezca sin salirse. */
const RING_WIDTH = Math.round((DONUT / 2 - SLICE_GROW) * 0.32);
const RING_RADIUS = DONUT / 2 - SLICE_GROW - RING_WIDTH / 2;

interface SpendingCardProps {
  currency: string;
  series: SpendingSeries | null;
  categories: readonly { name: string; amount: number }[];
  /** Cuenta mirada en el hero; la tarjeta entera cambia con ella. */
  accountLabel: string;
  loading: boolean;
}

/**
 * Gasto del mes: una cabecera fija con lo gastado hasta hoy y la comparación
 * contra el mismo día del mes anterior, y dos pestañas sobre el mismo dinero,
 * Ritmo y Categorías. La pestaña elegida se recuerda en el dispositivo.
 */
export function SpendingCard({ currency, series, categories, accountLabel, loading }: SpendingCardProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const [tab, setTab] = useState<Tab>("pace");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    SecureStore.getItemAsync(TAB_KEY)
      .then((v) => (v === "pace" || v === "categories" ? setTab(v) : undefined))
      .catch(() => undefined);
  }, []);
  const changeTab = (next: Tab) => {
    setTab(next);
    SecureStore.setItemAsync(TAB_KEY, next).catch(() => undefined);
  };
  // El selector también responde a un deslizamiento horizontal sobre la tarjeta. El arrastre de Ritmo
  // se activa antes (6px) y gana dentro del gráfico; en vertical manda el scroll de la pantalla.
  const swipeTab = (direction: 1 | -1) => {
    const next: Tab = direction > 0 ? "categories" : "pace";
    if (next === tab) return;
    haptics.select();
    changeTab(next);
  };
  const swipe = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 48 || Math.abs(e.velocityX) > 500) runOnJS(swipeTab)(e.translationX < 0 ? 1 : -1);
    });

  const now = new Date();
  const monthName = (offset: number) =>
    new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(now.getFullYear(), now.getMonth() + offset, 1));
  const previousMonth = inSentence(monthName(-1), locale);

  const current = series?.current ?? categories.reduce((a, c) => a + c.amount, 0);
  const diff = series ? Math.round((series.current - series.previousToDate) * 100) / 100 : 0;
  const title = t("home.spending.title", { month: inSentence(monthName(0), locale) });

  return (
    <YStack px={space[4]}>
      <SectionHeader title={title} actionLabel={t("home.spending.analysis")} onAction={() => router.push("/(tabs)/reports")} />
      <GestureDetector gesture={swipe}>
        <Animated.View layout={LinearTransition.springify().damping(motion.springUi.damping).stiffness(motion.springUi.stiffness)}>
          <FintCard p={space[5]} gap={space[4]}>
            <SegmentedControl
              options={[
                { value: "pace", label: t("home.spending.pace") },
                { value: "categories", label: t("home.spending.categories") },
              ]}
              value={tab}
              onChange={changeTab}
              accessibilityLabel={title}
            />
  
            <YStack gap={2}>
              <FText variant="caption" tone="inkFaint">
                {t("home.spending.spentToDate")}
              </FText>
              <Amount value={current} currency={currency} variant="amount-lg" />
              {series?.hasPrevious ? (
                <XStack items="center" gap={4} flexWrap="wrap">
                  {diff === 0 ? (
                    <FText variant="caption" tone="inkMuted">
                      {t("home.spending.same", { month: previousMonth })}
                    </FText>
                  ) : (
                    <>
                      {diff < 0 ? (
                        <ArrowDownRight size={14} color="$flowIn" strokeWidth={2.2} />
                      ) : (
                        <ArrowUpRight size={14} color="$flowOut" strokeWidth={2.2} />
                      )}
                      <Amount value={Math.abs(diff)} currency={currency} variant="amount-sm" tone={diff < 0 ? "flowIn" : "flowOut"} />
                      <FText variant="caption" tone="inkMuted">
                        {t(diff < 0 ? "home.spending.below" : "home.spending.above", { month: previousMonth })}
                      </FText>
                    </>
                  )}
                </XStack>
              ) : series ? (
                <FText variant="caption" tone="inkFaint">
                  {t("home.spending.noPrevious")}
                </FText>
              ) : null}
            </YStack>
  
            {loading && !series ? (
              <View height={CHART_HEIGHT} rounded={radius.md} bg="$surfaceSunken" />
            ) : tab === "pace" ? (
              // La vista nueva entra con `fade` y 6px hacia arriba; la cabecera no se mueve.
              <Animated.View key="pace" entering={riseIn({ distance: 6, reduceMotion })}>
                <PaceChart series={series} currency={currency} locale={locale} monthName={monthName} />
              </Animated.View>
            ) : (
              <Animated.View key="categories" entering={riseIn({ distance: 6, reduceMotion })}>
                <CategoryDonut categories={categories} currency={currency} spent={series?.current} />
              </Animated.View>
            )}
  
            {/* Ritmo cierra con su leyenda (dentro de PaceChart); Categorías, con la cuenta mirada y el detalle. */}
            {tab === "categories" ? (
              <XStack justify="space-between" items="center" pt={space[3]} borderTopWidth={1} borderColor="$line">
                <FText variant="caption" tone="inkFaint" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {accountLabel}
                </FText>
                <Pressable onPress={() => router.push("/(tabs)/reports")} hitSlop={10} accessibilityRole="link">
                  <XStack items="center" gap={2}>
                    <FText variant="label" tone="brand" style={{ fontFamily: fontFace.sans[600] }}>
                      {t("home.spending.viewDetail")}
                    </FText>
                    <ChevronRight size={14} color="$brand" strokeWidth={2.2} />
                  </XStack>
                </Pressable>
              </XStack>
            ) : null}
          </FintCard>
        </Animated.View>
      </GestureDetector>
    </YStack>
  );
}

/**
 * Ritmo: la curva acumulada del mes en `chart1` contra la del mes anterior en
 * `inkFaint` punteada. Arrastrar muestra los dos montos de cualquier día.
 * La línea es `chart1` y no `flowOut`: gastar es lo normal.
 */
function PaceChart({
  series,
  currency,
  locale,
  monthName,
}: {
  series: SpendingSeries | null;
  currency: string;
  locale: string;
  monthName: (offset: number) => string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const { state, isActive } = useChartPressState({ x: 0, y: { cur: 0, prev: 0 } });
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const draw = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (!reduceMotion) draw.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [draw, reduceMotion]);

  const data = useMemo(() => {
    if (!series) return [];
    const cur = cumulative(series.currentDaily);
    const prev = cumulative(series.previousDaily);
    return Array.from({ length: series.daysInMonth }, (_, i) => ({
      day: i + 1,
      cur: i < cur.length ? cur[i] : null,
      prev: series.hasPrevious && i < prev.length ? prev[i] : null,
    }));
  }, [series]);

  useAnimatedReaction(
    () => (isActive ? state.x.value.value : null),
    (day, prevDay) => {
      if (day !== prevDay) {
        runOnJS(setActiveDay)(day as number | null);
        if (day != null) runOnJS(haptics.select)();
      }
    },
    [isActive],
  );

  const guideTop = useDerivedValue(() => vec(state.x.position.value, 0));
  const guideBottom = useDerivedValue(() => vec(state.x.position.value, CHART_HEIGHT));

  if (!series) return <View height={CHART_HEIGHT} />;

  const maxY = Math.max(1, ...data.map((d) => Math.max(d.cur ?? 0, d.prev ?? 0))) * 1.12;
  const active = activeDay != null ? data[activeDay - 1] : null;
  const current = monthName(0);

  return (
    <YStack gap={space[2]}>
      <View height={CHART_HEIGHT} accessible accessibilityLabel={t("home.spending.chartLabel", { month: inSentence(current, locale), previous: inSentence(monthName(-1), locale) })}>
        <CartesianChart
          data={data}
          xKey="day"
          yKeys={["cur", "prev"]}
          domain={{ x: [1, series.daysInMonth], y: [0, maxY] }}
          padding={{ top: 6, bottom: 2, left: 0, right: 6 }}
          chartPressState={state}
          // Arrastre horizontal inmediato, sin mantener presionado; si el dedo va en vertical, manda el scroll de la pantalla.
          chartPressConfig={{ pan: { activeOffsetX: [-6, 6], failOffsetY: [-10, 10] } }}
        >
          {({ points, chartBounds }) => {
            const todayPoint = points.cur[series.today - 1];
            return (
              <>
                {series.hasPrevious ? (
                  <Line points={points.prev} color={theme.inkFaint.val} strokeWidth={1.5} curveType="monotoneX" opacity={0.8}>
                    <DashPathEffect intervals={[4, 4]} />
                  </Line>
                ) : null}
<Group opacity={draw}>
                <Area points={points.cur} y0={chartBounds.bottom} curveType="monotoneX">
                  <LinearGradient
                    start={vec(0, chartBounds.top)}
                    end={vec(0, chartBounds.bottom)}
                    colors={[withAlpha(theme.chart1.val, 0.22), withAlpha(theme.chart1.val, 0)]}
                  />
                </Area>
                </Group>
                <Line points={points.cur} color={theme.chart1.val} strokeWidth={2.5} curveType="monotoneX" end={draw} strokeCap="round" />
                {todayPoint?.y != null && !isActive ? (
                  <Circle cx={todayPoint.x} cy={todayPoint.y} r={5} color={theme.chart1.val} />
                ) : null}
                {isActive ? (
                  <>
                    <SkiaLine p1={guideTop} p2={guideBottom} color={theme.line.val} strokeWidth={1} />
                    <Circle cx={state.x.position} cy={state.y.cur.position} r={5} color={theme.chart1.val} />
                    {series.hasPrevious ? <Circle cx={state.x.position} cy={state.y.prev.position} r={4} color={theme.inkFaint.val} /> : null}
                  </>
                ) : null}
              </>
            );
          }}
        </CartesianChart>
      </View>

      {/* Solo el primer día lleva el mes ("1 set"); los demás, el número. */}
      <XStack justify="space-between">
        {[1, Math.ceil(series.daysInMonth / 2), series.daysInMonth].map((d, i) => (
          <FText key={d} variant="figure-caption" tone="inkFaint">
            {i === 0
              ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" })
                  .format(new Date(new Date().getFullYear(), new Date().getMonth(), d))
                  .replace(/\.$/, "")
              : d}
          </FText>
        ))}
      </XStack>

      {/* Pie: la leyenda; mientras se arrastra, los dos montos del día bajo el dedo. Misma altura, sin saltos. */}
      <XStack justify="space-between" items="center" minH={20} mt={space[2]} pt={space[3]} borderTopWidth={1} borderColor="$line">
        {active ? (
          <>
            <FText variant="caption" tone="inkMuted">
              {t("home.spending.dayLabel", { day: active.day, month: inSentence(current, locale) })}
            </FText>
            <XStack gap={space[3]} items="baseline">
              {active.cur != null ? <Amount value={active.cur} currency={currency} variant="amount-sm" /> : null}
              {active.prev != null ? <Amount value={active.prev} currency={currency} variant="amount-sm" tone="inkFaint" /> : null}
            </XStack>
          </>
        ) : (
          <XStack gap={space[4]}>
            <Legend color="$chart1" label={current} />
            {series.hasPrevious ? <Legend color="$inkFaint" label={monthName(-1)} dashed /> : null}
          </XStack>
        )}
      </XStack>
    </YStack>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <XStack items="center" gap={6}>
      <View width={14} height={dashed ? 0 : 2.5} rounded={2} bg={dashed ? undefined : (color as never)} borderTopWidth={dashed ? 1.5 : 0} borderStyle="dashed" borderColor={color as never} />
      <FText variant="caption" tone="inkMuted" style={{ textTransform: "capitalize" }}>
        {label}
      </FText>
    </XStack>
  );
}

/**
 * Categorías: un donut de 112px con las cuatro más grandes y "Otros". Tocar
 * una fila de la leyenda la selecciona y el centro muestra su porcentaje.
 */
function CategoryDonut({
  categories,
  currency,
  spent,
}: {
  categories: readonly { name: string; amount: number }[];
  currency: string;
  /** Lo gastado hasta hoy de la cabecera: el donut suma exactamente eso. */
  spent?: number;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const rows = useMemo(
    () =>
      topCategories(
        categories.map((c) => ({ name: getCategoryLabel(c.name, t), amount: c.amount })),
        t("home.spending.other"),
        { spent },
      ),
    [categories, spent, t],
  );
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = useState(0);
  const selectedIndex = Math.min(selected, rows.length - 1);
  const sel: CategoryShare | undefined = rows[selectedIndex];
  const colorOf = (i: number) => theme[`chart${i}` as "chart1"].val;

  // Al entrar en la pestaña, las porciones se dibujan en secuencia, en el sentido del reloj, en 500ms.
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) progress.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotion]);

  // Ángulos de cada porción, desde las 12 en punto.
  const slices = useMemo(() => {
    const total = rows.reduce((a, r) => a + r.amount, 0) || 1;
    let start = 0;
    return rows.map((r) => {
      const sweep = (r.amount / total) * 360;
      const slice = { start, sweep };
      start += sweep;
      return slice;
    });
  }, [rows]);

  const select = (i: number) => {
    if (i === selectedIndex) return;
    haptics.select();
    setSelected(i);
  };

  // Tocar una porción: el ángulo del toque dice cuál es; fuera del anillo no hace nada.
  const onDonutPress = (x: number, y: number) => {
    const dx = x - DONUT / 2;
    const dy = y - DONUT / 2;
    const distance = Math.hypot(dx, dy);
    if (distance < RING_RADIUS - RING_WIDTH / 2 - 8 || distance > DONUT / 2 + 6) return;
    const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
    const hit = slices.findIndex((s) => angle >= s.start && angle < s.start + s.sweep);
    if (hit >= 0) select(hit);
  };

  if (rows.length === 0) {
    return (
      <XStack items="center" gap={space[4]}>
        <Canvas style={{ width: DONUT, height: DONUT }}>
          <Circle cx={DONUT / 2} cy={DONUT / 2} r={RING_RADIUS} style="stroke" strokeWidth={RING_WIDTH} color={theme.chartTrack.val} />
        </Canvas>
        <FText tone="inkMuted" style={{ flex: 1 }}>
          {t("home.spending.empty")}
        </FText>
      </XStack>
    );
  }

  return (
    <XStack items="center" gap={space[4]}>
      <Pressable
        onPress={(e) => onDonutPress(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Canvas style={{ width: DONUT, height: DONUT }}>
          <Circle cx={DONUT / 2} cy={DONUT / 2} r={RING_RADIUS} style="stroke" strokeWidth={RING_WIDTH} color={theme.chartTrack.val} />
          {slices.map((s, i) => (
            <DonutSlice
              key={rows[i].isOther ? "__other__" : `${i}-${rows[i].name}`}
              start={s.start}
              sweep={s.sweep}
              gap={rows.length > 1}
              color={colorOf(rows[i].color)}
              selected={i === selectedIndex}
              progress={progress}
              reduceMotion={reduceMotion}
            />
          ))}
        </Canvas>
        {sel ? (
          <YStack position="absolute" inset={0} items="center" justify="center" pointerEvents="none">
            <NumberFlow
              value={sel.percentage}
              suffix="%"
              style={{ ...textStyles.amount, fontSize: 17, color: theme.ink.val }}
              containerStyle={{ alignSelf: "center" }}
            />
            <FText variant="caption" tone="inkFaint" numberOfLines={1} style={{ maxWidth: 70 }}>
              {sel.name}
            </FText>
          </YStack>
        ) : null}
      </Pressable>

      <YStack flex={1} minW={0}>
        {rows.map((r, i) => (
          <LegendRow
            key={r.isOther ? "__other__" : `${i}-${r.name}`}
            name={r.name}
            amount={r.amount}
            percentage={r.percentage}
            currency={currency}
            color={colorOf(r.color)}
            selected={i === selectedIndex}
            onPress={() => select(i)}
          />
        ))}
      </YStack>
    </XStack>
  );
}

/**
 * Una porción del donut como arco con trazo. Seleccionada crece 3px hacia
 * afuera con `spring-ui` (el borde interior no se mueve). Se dibuja cuando el
 * barrido de entrada (`progress`, 0 a 1 de la vuelta) llega a su ángulo.
 */
function DonutSlice({
  start,
  sweep,
  gap,
  color,
  selected,
  progress,
  reduceMotion,
}: {
  start: number;
  sweep: number;
  gap: boolean;
  color: string;
  selected: boolean;
  progress: SharedValue<number>;
  reduceMotion: boolean;
}) {
  const grow = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    grow.value = reduceMotion ? (selected ? 1 : 0) : withSpring(selected ? 1 : 0, motion.springUi);
  }, [grow, reduceMotion, selected]);

  // 2px de separación entre porciones vecinas, medidos sobre el radio del anillo.
  const gapDeg = gap ? ((2 / RING_RADIUS) * 180) / Math.PI : 0;
  const path = useDerivedValue(() => {
    const r = RING_RADIUS + (SLICE_GROW / 2) * grow.value;
    const drawn = Math.min(1, Math.max(0, (progress.value * 360 - start) / sweep));
    const arc = Math.min(359.9, Math.max(0, sweep - gapDeg) * drawn);
    const p = Skia.Path.Make();
    if (arc > 0) p.addArc(Skia.XYWHRect(DONUT / 2 - r, DONUT / 2 - r, r * 2, r * 2), start - 90 + gapDeg / 2, arc);
    return p;
  });
  const strokeWidth = useDerivedValue(() => RING_WIDTH + SLICE_GROW * grow.value);

  return <Path path={path} style="stroke" strokeWidth={strokeWidth} color={color} />;
}

/** Fila de la leyenda: al elegirla se tiñe de `surfaceSunken` con `fade`. */
function LegendRow({
  name,
  amount,
  percentage,
  currency,
  color,
  selected,
  onPress,
}: {
  name: string;
  amount: number;
  percentage: number;
  currency: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const tint = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    tint.value = withTiming(selected ? 1 : 0, { duration: motion.fade.duration });
  }, [selected, tint]);
  const from = "rgba(0,0,0,0)";
  const to = theme.surfaceSunken.val;
  const bg = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(tint.value, [0, 1], [from, to]) }));

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${name}, ${percentage}%`}>
      <Animated.View style={[{ borderRadius: radius.sm }, bg]}>
        <XStack items="center" gap={8} py={5} px={6}>
          <View width={8} height={8} rounded={999} style={{ backgroundColor: color }} />
          <FText variant="caption" numberOfLines={1} style={{ flex: 1 }}>
            {name}
          </FText>
          <Amount value={amount} currency={currency} variant="figure-caption" showSymbol={false} tone="inkMuted" />
        </XStack>
      </Animated.View>
    </Pressable>
  );
}

function withAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return hex;
  const int = Number.parseInt(value, 16);
  return `rgba(${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},${alpha})`;
}

/** El mes dentro de una frase: "Gasto de setiembre". Mayúscula solo en la primera palabra; en inglés los meses la llevan siempre. */
function inSentence(month: string, locale: string) {
  return locale.startsWith("en") ? month : month.toLocaleLowerCase(locale);
}
