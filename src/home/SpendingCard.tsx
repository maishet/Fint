import { Circle, DashPathEffect, Group, LinearGradient, Line as SkiaLine, vec } from "@shopify/react-native-skia";
import { ArrowDownRight, ArrowUpRight } from "@tamagui/lucide-icons-2";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Area, CartesianChart, Line, Pie, PolarChart, useChartPressState } from "victory-native";
import { View, XStack, YStack, useTheme } from "tamagui";
import { getCategoryLabel } from "../finance/categoryLabels";
import { getAppLocale } from "../i18n";
import { motion, radius, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { Amount, FintCard, FText, SectionHeader, SegmentedControl } from "../ui";
import { haptics } from "../ui/haptics";
import { cumulative, topCategories, type CategoryShare, type SpendingSeries } from "./spending";

type Tab = "pace" | "categories";
const TAB_KEY = "home.spendingTab";
const CHART_HEIGHT = 120;
const DONUT = 112;

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

  useEffect(() => {
    SecureStore.getItemAsync(TAB_KEY)
      .then((v) => (v === "pace" || v === "categories" ? setTab(v) : undefined))
      .catch(() => undefined);
  }, []);
  const changeTab = (next: Tab) => {
    setTab(next);
    SecureStore.setItemAsync(TAB_KEY, next).catch(() => undefined);
  };

  const now = new Date();
  const monthName = (offset: number) =>
    new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(now.getFullYear(), now.getMonth() + offset, 1));
  const previousMonth = monthName(-1);

  const current = series?.current ?? categories.reduce((a, c) => a + c.amount, 0);
  const diff = series ? Math.round((series.current - series.previousToDate) * 100) / 100 : 0;

  return (
    <YStack px={space[4]}>
      <SectionHeader title={t("home.spending.title")} />
      <Animated.View layout={LinearTransition.springify().damping(motion.springUi.damping).stiffness(motion.springUi.stiffness)}>
        <FintCard p={space[5]} gap={space[4]}>
          <SegmentedControl
            options={[
              { value: "pace", label: t("home.spending.pace") },
              { value: "categories", label: t("home.spending.categories") },
            ]}
            value={tab}
            onChange={changeTab}
            accessibilityLabel={t("home.spending.title")}
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
            <Animated.View key="pace" entering={FadeIn.duration(motion.fade.duration)}>
              <PaceChart series={series} currency={currency} locale={locale} monthName={monthName} />
            </Animated.View>
          ) : (
            <Animated.View key="categories" entering={FadeIn.duration(motion.fade.duration)}>
              <CategoryDonut categories={categories} currency={currency} />
            </Animated.View>
          )}

          <XStack justify="space-between" items="center" pt={space[3]} borderTopWidth={1} borderColor="$line">
            <FText variant="caption" tone="inkFaint" numberOfLines={1} style={{ flexShrink: 1 }}>
              {accountLabel}
            </FText>
            <Pressable onPress={() => router.push("/(tabs)/reports")} hitSlop={10} accessibilityRole="link">
              <FText variant="label" tone="brand" style={{ fontFamily: fontFace.sans[600] }}>
                {t("home.spending.viewDetail")}
              </FText>
            </Pressable>
          </XStack>
        </FintCard>
      </Animated.View>
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
      <XStack justify="space-between" items="center" minH={20}>
        {active ? (
          <>
            <FText variant="caption" tone="inkMuted">
              {t("home.spending.dayLabel", { day: active.day, month: current })}
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

      <View height={CHART_HEIGHT} accessible accessibilityLabel={t("home.spending.chartLabel", { month: current, previous: monthName(-1) })}>
        <CartesianChart
          data={data}
          xKey="day"
          yKeys={["cur", "prev"]}
          domain={{ x: [1, series.daysInMonth], y: [0, maxY] }}
          padding={{ top: 6, bottom: 2, left: 0, right: 6 }}
          chartPressState={state}
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

      <XStack justify="space-between">
        {[1, Math.ceil(series.daysInMonth / 2), series.daysInMonth].map((d) => (
          <FText key={d} variant="figure-caption" tone="inkFaint">
            {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(new Date().getFullYear(), new Date().getMonth(), d))}
          </FText>
        ))}
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
function CategoryDonut({ categories, currency }: { categories: readonly { name: string; amount: number }[]; currency: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const rows = useMemo(
    () => topCategories(categories.map((c) => ({ name: getCategoryLabel(c.name, t), amount: c.amount })), t("home.spending.other")),
    [categories, t],
  );
  const [selected, setSelected] = useState(0);
  const sel: CategoryShare | undefined = rows[Math.min(selected, rows.length - 1)];
  const colorOf = (i: number) => theme[`chart${i}` as "chart1"].val;

  if (rows.length === 0) {
    return (
      <XStack items="center" gap={space[4]}>
        <View width={DONUT} height={DONUT} rounded={999} borderWidth={16} borderColor="$chartTrack" />
        <FText tone="inkMuted" style={{ flex: 1 }}>
          {t("home.spending.empty")}
        </FText>
      </XStack>
    );
  }

  const data = rows.map((r, i) => ({ label: r.name, value: r.amount, color: colorOf(r.color), index: i }));

  return (
    <XStack items="center" gap={space[4]}>
      <View width={DONUT} height={DONUT}>
        <PolarChart data={data} labelKey="label" valueKey="value" colorKey="color" containerStyle={{ width: DONUT, height: DONUT }}>
          <Pie.Chart innerRadius="68%">
            {() => (
              <Pie.Slice>
                <Pie.SliceAngularInset angularInset={{ angularStrokeWidth: 2, angularStrokeColor: theme.surface.val }} />
              </Pie.Slice>
            )}
          </Pie.Chart>
        </PolarChart>
        {sel ? (
          <YStack position="absolute" inset={0} items="center" justify="center" pointerEvents="none">
            <FText variant="amount" style={{ fontSize: 17 }}>{`${sel.percentage}%`}</FText>
            <FText variant="caption" tone="inkFaint" numberOfLines={1} style={{ maxWidth: 70 }}>
              {sel.name}
            </FText>
          </YStack>
        ) : null}
      </View>

      <YStack flex={1} minW={0}>
        {rows.map((r, i) => (
          <Pressable
            key={r.name}
            onPress={() => {
              haptics.select();
              setSelected(i);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: i === selected }}
          >
            <XStack items="center" gap={8} py={5} px={6} rounded={radius.sm} bg={i === selected ? "$surfaceSunken" : "transparent"}>
              <View width={8} height={8} rounded={999} bg={colorOf(r.color) as never} />
              <FText variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                {r.name}
              </FText>
              <Amount value={r.amount} currency={currency} variant="figure-caption" showSymbol={false} tone="inkMuted" />
            </XStack>
          </Pressable>
        ))}
      </YStack>
    </XStack>
  );
}

function withAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return hex;
  const int = Number.parseInt(value, 16);
  return `rgba(${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},${alpha})`;
}
