import { Canvas, Circle, Path, Skia } from "@shopify/react-native-skia";
import { ArrowDown, ArrowUp, ChevronRight } from "@tamagui/lucide-icons-2";
import { NumberFlow } from "number-flow-react-native";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { View, XStack, YStack, useTheme } from "tamagui";
import { motion, radius } from "../theme/tokens";
import { fontFace, textStyles } from "../theme/typography";
import { Amount, FText } from "../ui";
import { haptics } from "../ui/haptics";
import type { CategoryRow } from "./logic";

const SIZE = 150;
const RING_WIDTH = 18;
/** La porción elegida engorda 4px hacia afuera. */
const GROW = 4;
const RING_RADIUS = SIZE / 2 - GROW / 2 - RING_WIDTH / 2 - 2;

/** "32%" o "4.5%": entero cuando lo es, con un decimal si no. */
function pct(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

/**
 * La variación de una categoría de gasto: bajar es buena noticia (`flowIn`),
 * subir no (`flowOut`). Sin periodo anterior dice "nueva"; sin cambio, "igual".
 */
export function CategoryChange({ change }: { change: number | null }) {
  const { t } = useTranslation();
  if (change === null || change === 0) {
    return (
      <FText variant="figure-caption" tone="inkFaint" style={{ fontSize: 11 }}>
        {t(change === null ? "reportsTab.new" : "reportsTab.same")}
      </FText>
    );
  }
  const tone = change < 0 ? "flowIn" : "flowOut";
  const Icon = change > 0 ? ArrowUp : ArrowDown;
  return (
    <XStack items="center" gap={2}>
      <Icon size={11} color={`$${tone}`} strokeWidth={2.6} />
      <FText variant="figure-caption" tone={tone} style={{ fontSize: 11 }}>
        {`${pct(Math.abs(change))}%`}
      </FText>
    </XStack>
  );
}

/**
 * Donut de gasto con leyenda direccionada: tocar una porción o su fila elige
 * las dos; la porción crece con `spring-ui` y el porcentaje del centro rueda.
 * Tocar la fila ya elegida abre sus movimientos (la fila muestra la flecha).
 */
export function CategoryBreakdown({ rows, currency, onOpen }: { rows: readonly CategoryRow[]; currency: string; onOpen: (row: CategoryRow) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, rows.length - 1);
  const sel = rows[index];
  const colorOf = (i: number) => theme[`chart${i}` as "chart1"].val;

  // Al aparecer, las porciones se dibujan en secuencia, en el sentido del reloj.
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    setSelected(0);
    if (!reduceMotion) {
      progress.value = 0;
      progress.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    }
  }, [progress, reduceMotion, rows]);

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
    if (i === index) return;
    haptics.select();
    setSelected(i);
  };

  const onDonutPress = (x: number, y: number) => {
    const dx = x - SIZE / 2;
    const dy = y - SIZE / 2;
    const distance = Math.hypot(dx, dy);
    if (distance < RING_RADIUS - RING_WIDTH / 2 - 8 || distance > SIZE / 2 + 6) return;
    const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
    const hit = slices.findIndex((s) => angle >= s.start && angle < s.start + s.sweep);
    if (hit >= 0) select(hit);
  };

  return (
    <YStack>
      <XStack justify="center" mb={14}>
        <Pressable onPress={(e) => onDonutPress(e.nativeEvent.locationX, e.nativeEvent.locationY)} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Canvas style={{ width: SIZE, height: SIZE }}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={RING_RADIUS} style="stroke" strokeWidth={RING_WIDTH} color={theme.chartTrack.val} />
            {slices.map((s, i) => (
              <Slice
                key={rows[i].key ?? "__other__"}
                start={s.start}
                sweep={s.sweep}
                gap={rows.length > 1}
                color={colorOf(rows[i].color)}
                selected={i === index}
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
                format={{ maximumFractionDigits: 1 }}
                style={{ ...textStyles["amount-lg"], color: theme.ink.val }}
                containerStyle={{ alignSelf: "center" }}
              />
              <FText variant="caption" tone="inkFaint" numberOfLines={1} style={{ fontSize: 11, maxWidth: 88 }}>
                {sel.label}
              </FText>
            </YStack>
          ) : null}
        </Pressable>
      </XStack>

      {rows.map((r, i) => (
        <LegendRow
          key={r.key ?? "__other__"}
          row={r}
          first={i === 0}
          color={colorOf(r.color)}
          currency={currency}
          selected={i === index}
          onPress={() => (i === index ? r.key && onOpen(r) : select(i))}
          openLabel={r.key ? t("reportsTab.openCategory", { name: r.label }) : undefined}
        />
      ))}
    </YStack>
  );
}

function Slice({
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
    const r = RING_RADIUS + (GROW / 2) * grow.value;
    const drawn = Math.min(1, Math.max(0, (progress.value * 360 - start) / sweep));
    const arc = Math.min(359.9, Math.max(0, sweep - gapDeg) * drawn);
    const p = Skia.Path.Make();
    if (arc > 0) p.addArc(Skia.XYWHRect(SIZE / 2 - r, SIZE / 2 - r, r * 2, r * 2), start - 90 + gapDeg / 2, arc);
    return p;
  });
  const strokeWidth = useDerivedValue(() => RING_WIDTH + GROW * grow.value);
  return <Path path={path} style="stroke" strokeWidth={strokeWidth} color={color} />;
}

/** Fila de la leyenda: punto, nombre y porcentaje, monto y variación. Al elegirla se tiñe de `surfaceSunken`. */
function LegendRow({
  row,
  first,
  color,
  currency,
  selected,
  onPress,
  openLabel,
}: {
  row: CategoryRow;
  first: boolean;
  color: string;
  currency: string;
  selected: boolean;
  onPress: () => void;
  openLabel?: string;
}) {
  const theme = useTheme();
  const tint = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    tint.value = withTiming(selected ? 1 : 0, { duration: motion.fade.duration });
  }, [selected, tint]);
  const to = theme.surfaceSunken.val;
  const bg = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(tint.value, [0, 1], ["rgba(0,0,0,0)", to]) }));

  return (
    <View borderTopWidth={first ? 0 : 1} borderColor="$line">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${row.label}, ${pct(row.percentage)}%`}
        accessibilityHint={selected ? openLabel : undefined}
      >
        <Animated.View style={[{ borderRadius: radius.sm, marginVertical: 2 }, bg]}>
          <XStack items="center" gap={10} py={6} px={6}>
            <XStack flex={1} minW={0} items="center" gap={8}>
              <View width={8} height={8} style={{ borderRadius: 2, backgroundColor: color }} />
              <FText variant="body" numberOfLines={1} style={{ fontSize: 14, flexShrink: 1 }}>
                {row.label}
              </FText>
              <FText variant="figure-caption" tone="inkFaint" style={{ fontSize: 11, fontFamily: fontFace.mono[400] }}>
                {`${pct(row.percentage)}%`}
              </FText>
            </XStack>
            <Amount value={row.amount} currency={currency} showSymbol={false} style={{ fontSize: 14 }} />
            <XStack width={50} justify="flex-end">
              <CategoryChange change={row.change} />
            </XStack>
            <XStack width={12} justify="flex-end">
              {selected && openLabel ? <ChevronRight size={12} color="$inkFaint" strokeWidth={2.4} /> : null}
            </XStack>
          </XStack>
        </Animated.View>
      </Pressable>
    </View>
  );
}
