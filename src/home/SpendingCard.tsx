import { Circle, DashPathEffect, Group, Line as SkiaLine, vec } from "@shopify/react-native-skia";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "@tamagui/lucide-icons-2";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  LinearTransition,
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Area, CartesianChart, Line, useChartPressState } from "victory-native";
import { Text, View, XStack, YStack, useTheme } from "tamagui";
import { getCategoryLabel } from "../finance/categoryLabels";
import { categoryTint } from "../finance/categoryTint";
import { useCategoryHue } from "../finance/emojiHue";
import { useCategoryIcons } from "../finance/useCategoryIcons";
import { getAppLocale } from "../i18n";
import { useThemeMode } from "../theme/ThemeMode";
import { COMPACT_FONT_SCALE, motion, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { Amount, FText, PressableScale, SectionHeader, SegmentedControl } from "../ui";
import { riseIn } from "../ui/entering";
import { haptics } from "../ui/haptics";
import { cumulative, topCategories, type SpendingSeries } from "./spending";

type Tab = "pace" | "categories";
const TAB_KEY = "home.spendingTab";
const CHART_HEIGHT = 150;
/** El mosaico de Categorías: alto total y separación entre fichas. */
const MOSAIC_HEIGHT = 250;
const MOSAIC_GAP = 6;
/** Opacidad del área amarilla bajo la línea de Ritmo. */
const PACE_AREA_OPACITY = 0.45;

interface SpendingCardProps {
  currency: string;
  series: SpendingSeries | null;
  categories: readonly { name: string; amount: number }[];
  /** Cuenta mirada en el hero; la tarjeta entera cambia con ella. */
  accountLabel: string;
  loading: boolean;
}

/**
 * Gasto del mes: dos pestañas sobre el mismo dinero, Ritmo y Categorías, y una
 * cabecera fija con lo gastado hasta hoy y la comparación contra el mismo día
 * del mes anterior en una ficha. Va directo sobre `canvas`, sin tarjeta. La
 * pestaña elegida se recuerda en el dispositivo.
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
    <YStack px={space[5]}>
      <SectionHeader title={title} actionLabel={t("home.spending.analysis")} onAction={() => router.push("/(tabs)/reports")} />
      <GestureDetector gesture={swipe}>
        <Animated.View layout={LinearTransition.springify().damping(motion.springUi.damping).stiffness(motion.springUi.stiffness)}>
          <YStack gap={space[4]}>
            <SegmentedControl
              size="sm"
              options={[
                { value: "pace", label: t("home.spending.pace") },
                { value: "categories", label: t("home.spending.categories") },
              ]}
              value={tab}
              onChange={changeTab}
              accessibilityLabel={title}
            />

            <YStack gap={4}>
              <XStack items="flex-end" justify="space-between" gap={space[3]} flexWrap="wrap">
                <YStack gap={2}>
                  <FText tone="inkMuted" style={{ fontSize: 13, lineHeight: 18 }}>
                    {t("home.spending.spentToDate")}
                  </FText>
                  <Amount value={current} currency={currency} variant="amount-lg" style={{ fontFamily: fontFace.mono[600], fontSize: 34, lineHeight: 40 }} />
                </YStack>
                {series?.hasPrevious && diff !== 0 ? (
                  // La diferencia contra el mes anterior, en una ficha verde (menos) o terracota (más).
                  <XStack height={28} px={10} gap={3} items="center" rounded={999} bg={diff < 0 ? "$green2" : "$red2"}>
                    {diff < 0 ? <ArrowDownRight size={13} color="$flowIn" strokeWidth={2.6} /> : <ArrowUpRight size={13} color="$flowOut" strokeWidth={2.6} />}
                    <Amount
                      value={Math.abs(diff)}
                      currency={currency}
                      variant="amount-sm"
                      tone={diff < 0 ? "flowIn" : "flowOut"}
                      maxFontSizeMultiplier={COMPACT_FONT_SCALE}
                      style={{ fontFamily: fontFace.mono[600], fontSize: 12, lineHeight: 16 }}
                    />
                  </XStack>
                ) : null}
              </XStack>
              {series?.hasPrevious ? (
                <FText tone="inkFaint" style={{ fontSize: 13, lineHeight: 18 }}>
                  {diff === 0
                    ? t("home.spending.same", { month: previousMonth })
                    : t(diff < 0 ? "home.spending.below" : "home.spending.above", { month: previousMonth })}
                </FText>
              ) : series ? (
                <FText tone="inkFaint" style={{ fontSize: 13, lineHeight: 18 }}>
                  {t("home.spending.noPrevious")}
                </FText>
              ) : null}
            </YStack>

            {loading && !series ? (
              <View height={CHART_HEIGHT} rounded={18} bg="$surface" />
            ) : tab === "pace" ? (
              // La vista nueva entra con `fade` y 6px hacia arriba; la cabecera no se mueve.
              <Animated.View key="pace" entering={riseIn({ distance: 6, reduceMotion })}>
                <PaceChart series={series} currency={currency} locale={locale} monthName={monthName} />
              </Animated.View>
            ) : (
              <Animated.View key="categories" entering={riseIn({ distance: 6, reduceMotion })}>
                <CategoryMosaic categories={categories} currency={currency} spent={series?.current} />
              </Animated.View>
            )}

            {/* Ritmo cierra con su leyenda (dentro de PaceChart); Categorías, con la cuenta mirada y el detalle. */}
            {tab === "categories" ? (
              <XStack justify="space-between" items="center" gap={space[3]}>
                <FText variant="caption" tone="inkFaint" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {accountLabel}
                </FText>
                <Pressable onPress={() => router.push("/(tabs)/reports")} hitSlop={12} accessibilityRole="link">
                  <XStack items="center" gap={2}>
                    <FText variant="label" tone="ink" maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.sans[600] }}>
                      {t("home.spending.viewDetail")}
                    </FText>
                    <ChevronRight size={14} color="$ink" strokeWidth={2.2} />
                  </XStack>
                </Pressable>
              </XStack>
            ) : null}
          </YStack>
        </Animated.View>
      </GestureDetector>
    </YStack>
  );
}

/**
 * Ritmo: la curva acumulada del mes en tinta con el área amarilla debajo,
 * contra la del mes anterior en `inkFaint` punteada; hoy, un punto amarillo con
 * borde tinta y una guía punteada. Arrastrar muestra los dos montos de
 * cualquier día. La línea no es `flowOut`: gastar es lo normal.
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
          // F-01 no lleva cuadrícula: victory-native 42 dibuja el eje y con líneas finas por defecto, así que se apagan.
          xAxis={{ tickCount: 0, lineWidth: 0 }}
          yAxis={[{ tickCount: 0, lineWidth: 0 }]}
          frame={{ lineWidth: 0 }}
          // Margen dentro del área: victory-native recorta el dibujo al área del gráfico, así que el punto de hoy
          // (radio 7 con borde de 3) y las curvas se cortaban en los bordes con un margen de afuera.
          padding={{ top: 0, bottom: 0, left: 0, right: 0 }}
          domainPadding={{ top: 10, bottom: 10, left: 10, right: 10 }}
          chartPressState={state}
          // Arrastre horizontal inmediato, sin mantener presionado; si el dedo va en vertical, manda el scroll de la pantalla.
          chartPressConfig={{ pan: { activeOffsetX: [-6, 6], failOffsetY: [-10, 10] } }}
        >
          {({ points, yScale }) => {
            // La base del área y de la guía es el cero de la escala (con `domainPadding` ya no es el borde de abajo).
            const zero = yScale(0);
            const todayPoint = points.cur[series.today - 1];
            return (
              <>
                {series.hasPrevious ? (
                  <Line points={points.prev} color={theme.inkFaint.val} strokeWidth={2} curveType="monotoneX" strokeCap="round">
                    <DashPathEffect intervals={[3, 6]} />
                  </Line>
                ) : null}
                <Group opacity={draw}>
                  <Area points={points.cur} y0={zero} curveType="monotoneX" color={theme.brand.val} opacity={PACE_AREA_OPACITY} />
                </Group>
                <Line points={points.cur} color={theme.ink.val} strokeWidth={3} curveType="monotoneX" end={draw} strokeCap="round" strokeJoin="round" />
                {todayPoint?.y != null && !isActive ? (
                  <>
                    <SkiaLine p1={vec(todayPoint.x, todayPoint.y)} p2={vec(todayPoint.x, zero)} color={theme.ink.val} strokeWidth={1.5}>
                      <DashPathEffect intervals={[2, 3]} />
                    </SkiaLine>
                    <Circle cx={todayPoint.x} cy={todayPoint.y} r={7} color={theme.brand.val} />
                    <Circle cx={todayPoint.x} cy={todayPoint.y} r={7} color={theme.ink.val} style="stroke" strokeWidth={3} />
                  </>
                ) : null}
                {isActive ? (
                  <>
                    <SkiaLine p1={guideTop} p2={guideBottom} color={theme.line.val} strokeWidth={1} />
                    <Circle cx={state.x.position} cy={state.y.cur.position} r={6} color={theme.brand.val} />
                    <Circle cx={state.x.position} cy={state.y.cur.position} r={6} color={theme.ink.val} style="stroke" strokeWidth={2.5} />
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
      <XStack justify="space-between" items="center" minH={20} mt={space[1]}>
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
            <Legend color="$ink" label={current} />
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
      <View width={14} height={dashed ? 0 : 3} rounded={2} bg={dashed ? undefined : (color as never)} borderTopWidth={dashed ? 2 : 0} borderStyle="dashed" borderColor={color as never} />
      <FText variant="caption" tone="inkMuted" style={{ textTransform: "capitalize" }}>
        {label}
      </FText>
    </XStack>
  );
}

/**
 * Categorías: un mosaico con las cuatro más grandes y "Otros" (los mismos datos que tenía el donut). La más grande
 * ocupa la columna izquierda a todo el alto; las demás se reparten a la derecha. Cada ficha lleva el fondo pastel del
 * tono de su emoji (`categoryTint`) y "Otros", `surface` con la cantidad de categorías que agrupa. Tocar una ficha
 * abre los movimientos de esa categoría, como las filas de Reportes; "Otros" abre el análisis en Reportes.
 */
function CategoryMosaic({
  categories,
  currency,
  spent,
}: {
  categories: readonly { name: string; amount: number }[];
  currency: string;
  /** Lo gastado hasta hoy de la cabecera: el mosaico suma exactamente eso. */
  spent?: number;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const iconFor = useCategoryIcons();
  const { rows, otherCount } = useMemo(() => {
    // La etiqueta traducida para mostrar y el nombre real para buscar el emoji de la categoría.
    const rawByLabel = new Map(categories.map((c) => [getCategoryLabel(c.name, t), c.name]));
    const shares = topCategories(
      categories.map((c) => ({ name: getCategoryLabel(c.name, t), amount: c.amount })),
      t("home.spending.other"),
      { spent },
    );
    const positive = categories.filter((c) => c.amount > 0).length;
    const heads = shares.filter((r) => !r.isOther).length;
    return {
      rows: shares.map((r) => ({ ...r, raw: r.isOther ? null : (rawByLabel.get(r.name) ?? r.name) })),
      otherCount: Math.max(0, positive - heads),
    };
  }, [categories, spent, t]);

  if (rows.length === 0) {
    return (
      <YStack height={MOSAIC_HEIGHT / 2} rounded={18} bg="$surface" items="center" justify="center" px={space[4]}>
        <FText tone="inkMuted" style={{ textAlign: "center" }}>
          {t("home.spending.empty")}
        </FText>
      </YStack>
    );
  }

  const openReports = () => router.push("/(tabs)/reports");
  // El contrato aún no filtra movimientos por categoría ni por mes: Movimientos busca el nombre de la categoría en
  // todo el historial (igual que `openCategory` de Reportes). `qt` hace que la misma búsqueda se repita al volver.
  const openCategory = (name: string) => router.navigate({ pathname: "/(tabs)/movements", params: { q: name, qt: String(Date.now()) } });
  const tile = (r: (typeof rows)[number], big: boolean) => (
    <MosaicTile
      key={r.isOther ? "__other__" : r.name}
      name={r.name}
      emoji={r.raw ? iconFor(r.raw, "expense") : null}
      otherCount={r.isOther ? otherCount : null}
      amount={r.amount}
      percentage={r.percentage}
      currency={currency}
      big={big}
      opensMovements={!r.isOther}
      onPress={r.raw ? () => openCategory(r.raw!) : openReports}
    />
  );

  const [first, ...rest] = rows;
  // Filas de la columna derecha: con cuatro, la de en medio lleva dos fichas (como en el diseño); si no, una por fila.
  const right = rest.length === 4 ? [[rest[0]], [rest[1], rest[2]], [rest[3]]] : rest.map((r) => [r]);

  return (
    // Con una sola categoría no hace falta todo el alto: la ficha sola baja a 160.
    <XStack height={rows.length === 1 ? 160 : MOSAIC_HEIGHT} gap={MOSAIC_GAP}>
      <View flex={right.length > 0 ? 1.35 : 1}>{tile(first, true)}</View>
      {right.length > 0 ? (
        <YStack flex={1.9} gap={MOSAIC_GAP}>
          {right.map((line, i) => (
            <XStack key={i} flex={1} gap={MOSAIC_GAP}>
              {line.map((r, j) => (
                <View key={r.isOther ? "__other__" : r.name} flex={line.length === 2 && j === 1 ? 0.9 : 1}>
                  {tile(r, false)}
                </View>
              ))}
            </XStack>
          ))}
        </YStack>
      ) : null}
    </XStack>
  );
}

/**
 * Una ficha del mosaico: emoji arriba (oculto al lector), nombre 12/800, monto y porcentaje abajo. Para el lector,
 * las que abren sus movimientos lo dicen ("Vivienda, 53 %. Ver movimientos").
 */
function MosaicTile({
  name,
  emoji,
  otherCount,
  amount,
  percentage,
  currency,
  big,
  opensMovements,
  onPress,
}: {
  name: string;
  emoji: string | null;
  /** Solo en "Otros": cuántas categorías agrupa ("+4"). */
  otherCount: number | null;
  amount: number;
  percentage: number;
  currency: string;
  big: boolean;
  opensMovements: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { themeMode } = useThemeMode();
  const hue = useCategoryHue(emoji, name);
  const isOther = otherCount != null;
  return (
    <PressableScale onPress={onPress} haptic="tap" accessibilityRole="button" accessibilityLabel={opensMovements ? `${name}, ${percentage}%. ${t("reports.viewMovements")}` : `${name}, ${percentage}%`} style={{ flex: 1 }}>
      <YStack
        flex={1}
        rounded={18}
        p={10}
        justify="space-between"
        overflow="hidden"
        bg={isOther ? "$surface" : undefined}
        style={isOther ? undefined : { backgroundColor: categoryTint(hue, themeMode) }}
      >
        {isOther ? (
          <FText tone="inkMuted" style={{ fontFamily: fontFace.mono[600], fontSize: 14, lineHeight: 18 }}>
            {otherCount > 0 ? `+${otherCount}` : ""}
          </FText>
        ) : emoji ? (
          <Text allowFontScaling={false} accessibilityElementsHidden importantForAccessibility="no" style={{ fontSize: big ? 40 : 24, lineHeight: big ? 48 : 30 }}>
            {emoji}
          </Text>
        ) : (
          <View />
        )}
        <YStack minW={0}>
          <FText numberOfLines={1} maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.display[700], fontSize: big ? 12 : 11, lineHeight: 15 }}>
            {name}
          </FText>
          <XStack items="baseline" justify="space-between" gap={4}>
            <Amount
              value={amount}
              currency={currency}
              variant="amount-sm"
              tone="ink"
              maxFontSizeMultiplier={COMPACT_FONT_SCALE}
              style={{ fontFamily: fontFace.mono[600], fontSize: big ? 16 : 12, lineHeight: big ? 21 : 16, flexShrink: 1 }}
            />
            <FText tone="inkMuted" maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.mono[600], fontSize: 11, lineHeight: 14 }}>
              {`${percentage} %`}
            </FText>
          </XStack>
        </YStack>
      </YStack>
    </PressableScale>
  );
}

/** El mes dentro de una frase: "Gasto de setiembre". Mayúscula solo en la primera palabra; en inglés los meses la llevan siempre. */
function inSentence(month: string, locale: string) {
  return locale.startsWith("en") ? month : month.toLocaleLowerCase(locale);
}
