import { ArrowDown, ArrowUp, ChevronRight } from "@tamagui/lucide-icons-2";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState, type Ref } from "react";
import { Pressable, useWindowDimensions, type GestureResponderEvent, type View as NativeView } from "react-native";
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withSpring, type SharedValue } from "react-native-reanimated";
import { Path, Svg } from "react-native-svg";
import { useTheme, View, XStack, YStack } from "tamagui";
import { categoryAccent } from "../finance/categoryTint";
import { useCategoryHue } from "../finance/emojiHue";
import { useThemeMode } from "../theme/ThemeMode";
import { useSensitiveMoney } from "../privacy/useSensitiveMoney";
import { COMPACT_FONT_SCALE, motion } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { Amount, FText, Monogram } from "../ui";
import type { CategoryRow } from "./logic";

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
 * Categorías del periodo (marca D, F-07): un donut con el gasto total al centro y, debajo, una fila por categoría con
 * su emoji en el cuadro de 38, el nombre, el porcentaje con la variación, el monto y el chevron. Las porciones son las
 * mismas filas (las 5 mayores y "Otros"), cada una en el color fuerte del tono de su emoji (`categoryAccent`, ≥ 3:1
 * contra el fondo); "Otros" y las categorías sin emoji, en `lineStrong`.
 *
 * Tocar una porción resalta su fila y la trae a la vista (`onReveal`); tocar la fila abre sus movimientos ("Otros" no
 * abre nada). Para el lector, el donut es un solo elemento que dice el total y cada categoría con su porcentaje y su
 * monto, respetando "Ocultar montos".
 */
export function CategoryBreakdown({
  rows,
  currency,
  onOpen,
  iconFor,
  onReveal,
}: {
  rows: readonly CategoryRow[];
  currency: string;
  onOpen: (row: CategoryRow) => void;
  /** El emoji guardado de una categoría por su nombre (el de `useCategoryIcons`). */
  iconFor: (name: string) => string | null;
  /** Trae a la vista la fila de una porción tocada (la pantalla sabe desplazar su `ScrollView`). */
  onReveal?: (row: NativeView) => void;
}) {
  const { t } = useTranslation();
  const [highlight, setHighlight] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, NativeView>());
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => (clearTimer.current ? clearTimeout(clearTimer.current) : undefined), []);

  const select = (row: CategoryRow) => {
    const id = rowId(row);
    setHighlight(id);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    const node = rowRefs.current.get(id);
    if (node) onReveal?.(node);
  };

  return (
    <YStack>
      <CategoryDonut rows={rows} currency={currency} iconFor={iconFor} highlight={highlight} onSelect={select} />
      <YStack mt={14}>
        {rows.map((r, i) => (
          <BreakdownRow
            key={rowId(r)}
            ref={(node) => {
              if (node) rowRefs.current.set(rowId(r), node);
              else rowRefs.current.delete(rowId(r));
            }}
            row={r}
            first={i === 0}
            highlighted={highlight === rowId(r)}
            emoji={r.key ? iconFor(r.key) : null}
            currency={currency}
            onPress={r.key ? () => onOpen(r) : undefined}
            openLabel={r.key ? t("reportsTab.openCategory", { name: r.label }) : undefined}
          />
        ))}
      </YStack>
    </YStack>
  );
}

/** Cuánto dura el resaltado de la fila de una porción tocada. */
const HIGHLIGHT_MS = 1800;
/** Separación entre porciones, en px sobre el anillo. */
const GAP = 2;
/** Lado y grosor del donut; desde `COMPACT_FONT_SCALE`, más chico para dejar sitio al texto. */
const DONUT = { regular: { size: 176, stroke: 22 }, compact: { size: 150, stroke: 18 } } as const;
/** Margen para acertar a una porción con el dedo, por dentro y por fuera del anillo. */
const TOUCH_SLOP = 14;

const AnimatedPath = Animated.createAnimatedComponent(Path);

function rowId(row: CategoryRow) {
  return row.key ?? "__other__";
}

interface Slice {
  row: CategoryRow;
  /** Inicio y fin de la porción en grados, desde las 12 y en sentido horario. */
  startDeg: number;
  endDeg: number;
  /**
   * El arco que se traza, en radianes desde las 12: la porción recortada en media separación por lado y, con extremo
   * redondeado, en medio grosor más (el extremo redondo sobresale eso del trazo).
   */
  fromRad: number;
  toRad: number;
  round: boolean;
}

/**
 * El donut: cada porción es un arco (`Path`) con extremos redondeados y 2 px de separación; una porción tan chica que
 * no cabe con sus extremos va recta. Con una sola categoría es un anillo completo. Entra barriendo desde las 12 con
 * `spring-ui` (sin movimiento con "reducir movimiento"). El toque se resuelve por el ángulo del dedo.
 */
function CategoryDonut({
  rows,
  currency,
  iconFor,
  highlight,
  onSelect,
}: {
  rows: readonly CategoryRow[];
  currency: string;
  iconFor: (name: string) => string | null;
  highlight: string | null;
  onSelect: (row: CategoryRow) => void;
}) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const { formatSensitiveAmount } = useSensitiveMoney();
  const reduceMotion = useReducedMotion();
  const { size, stroke } = fontScale >= COMPACT_FONT_SCALE ? DONUT.compact : DONUT.regular;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = rows.reduce((sum, r) => sum + Math.max(r.amount, 0), 0);

  const single = rows.length === 1;
  let cursor = 0;
  const slices: Slice[] = rows.map((row) => {
    const arc = total > 0 ? (Math.max(row.amount, 0) / total) * circumference : 0;
    const startPx = cursor;
    cursor += arc;
    const round = !single && arc > stroke + GAP + 2;
    const trim = single ? 0 : (GAP / 2 + (round ? stroke / 2 : 0)) / radius;
    const fromRad = startPx / radius + trim;
    const toRad = Math.max((startPx + arc) / radius - trim, fromRad + 0.004);
    return {
      row,
      fromRad,
      toRad,
      round,
      startDeg: (startPx / circumference) * 360,
      endDeg: ((startPx + arc) / circumference) * 360,
    };
  });

  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withSpring(1, motion.springUi);
  }, [progress, reduceMotion, total, rows.length]);

  const onPress = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    if (locationX === undefined || locationY === undefined) return;
    const dx = locationX - size / 2;
    const dy = locationY - size / 2;
    const dist = Math.hypot(dx, dy);
    if (dist < radius - stroke / 2 - TOUCH_SLOP || dist > radius + stroke / 2 + TOUCH_SLOP) return;
    const angle = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    const hit = slices.find((s) => angle >= s.startDeg && angle < s.endDeg);
    if (hit) onSelect(hit.row);
  };

  const label = [
    `${t("reportsTab.categories")}. ${t("reportsTab.expenses")}: ${formatSensitiveAmount(total, currency)}`,
    ...rows.map((r) => `${r.label}, ${pct(r.percentage)}%, ${formatSensitiveAmount(r.amount, currency)}`),
  ].join(". ");

  return (
    <View items="center">
      <Pressable onPress={onPress} accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {slices.map((s) => (
            <DonutSlice
              key={rowId(s.row)}
              slice={s}
              emoji={s.row.key ? iconFor(s.row.key) : null}
              size={size}
              stroke={stroke}
              radius={radius}
              progress={progress}
              dimmed={highlight !== null && highlight !== rowId(s.row)}
            />
          ))}
        </Svg>
        <YStack position="absolute" t={0} l={0} r={0} b={0} items="center" justify="center" px={stroke + 12} pointerEvents="none">
          <Amount
            value={total}
            currency={currency}
            smallCents
            numberOfLines={1}
            adjustsFontSizeToFit
            allowFontScaling={false}
            style={{ fontFamily: fontFace.mono[600], fontSize: size >= DONUT.regular.size ? 24 : 20, lineHeight: size >= DONUT.regular.size ? 30 : 26 }}
          />
          <FText variant="caption" tone="inkFaint" numberOfLines={1} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
            {t("reportsTab.expenses")}
          </FText>
        </YStack>
      </Pressable>
    </View>
  );
}

/**
 * El trazo de un arco de `from` a `to` (radianes desde las 12, en sentido horario) sobre el círculo del donut. Un
 * anillo completo va en dos medias vueltas: un solo arco SVG no puede cerrar el círculo.
 */
function arcPath(c: number, r: number, from: number, to: number) {
  "worklet";
  const x = (a: number) => c + r * Math.sin(a);
  const y = (a: number) => c - r * Math.cos(a);
  if (to - from >= 2 * Math.PI - 0.0001) {
    const half = from + Math.PI;
    return `M ${x(from)} ${y(from)} A ${r} ${r} 0 1 1 ${x(half)} ${y(half)} A ${r} ${r} 0 1 1 ${x(from)} ${y(from)}`;
  }
  const large = to - from > Math.PI ? 1 : 0;
  return `M ${x(from)} ${y(from)} A ${r} ${r} 0 ${large} 1 ${x(to)} ${y(to)}`;
}

/** Una porción: su color sale del tono del emoji; sin emoji, o "Otros", `lineStrong`. */
function DonutSlice({
  slice,
  emoji,
  size,
  stroke,
  radius,
  progress,
  dimmed,
}: {
  slice: Slice;
  emoji: string | null;
  size: number;
  stroke: number;
  radius: number;
  progress: SharedValue<number>;
  dimmed: boolean;
}) {
  const { themeMode } = useThemeMode();
  const theme = useTheme();
  const hue = useCategoryHue(emoji, slice.row.key ?? slice.row.label);
  const color = slice.row.key && emoji ? categoryAccent(hue, themeMode) : theme.lineStrong.val;
  const { fromRad, toRad } = slice;
  const center = size / 2;
  const animatedProps = useAnimatedProps(() => {
    // Barrido desde las 12: cada porción se dibuja cuando el barrido llega a ella.
    const to = Math.min(toRad, progress.value * 2 * Math.PI);
    return { d: to <= fromRad ? "M 0 0" : arcPath(center, radius, fromRad, to), strokeOpacity: to <= fromRad ? 0 : 1 };
  });
  return (
    <AnimatedPath
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap={slice.round ? "round" : "butt"}
      opacity={dimmed ? 0.3 : 1}
      animatedProps={animatedProps}
    />
  );
}

/**
 * Una fila: el cuadro de 38 con el emoji (o la inicial; "Otros" sin emoji), el nombre a 16, el porcentaje en `mono`
 * con la variación y el monto. Desde `COMPACT_FONT_SCALE` el monto baja debajo del nombre. `highlighted`: la porción
 * de esta fila se tocó en el donut, así que la fila se marca en `surface` un momento.
 */
function BreakdownRow({
  ref,
  highlighted,
  row,
  first,
  emoji,
  currency,
  onPress,
  openLabel,
}: {
  ref?: Ref<NativeView>;
  highlighted: boolean;
  row: CategoryRow;
  first: boolean;
  emoji: string | null;
  currency: string;
  onPress?: () => void;
  openLabel?: string;
}) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= COMPACT_FONT_SCALE;
  const amount = <Amount value={row.amount} currency={currency} style={{ fontFamily: fontFace.mono[600], fontSize: 15, lineHeight: 20 }} />;
  return (
    <View ref={ref} borderTopWidth={first ? 0 : 1} borderColor="$line">
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={`${row.label}, ${pct(row.percentage)}%`}
        accessibilityHint={openLabel}
      >
        {({ pressed }) => (
          <XStack
            items={stacked ? "flex-start" : "center"}
            gap={12}
            py={10}
            mx={-8}
            px={8}
            rounded={14}
            bg={pressed ? "$surfaceSunken" : highlighted ? "$surface" : undefined}
          >
            <Monogram name={row.label} emoji={emoji} size={38} />
            <YStack flex={1} minW={0} gap={2}>
              <FText numberOfLines={stacked ? undefined : 1} style={{ fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21, letterSpacing: -0.15 }}>
                {row.label}
              </FText>
              <XStack items="center" gap={8}>
                <FText tone="inkFaint" style={{ fontFamily: fontFace.mono[500], fontSize: 13, lineHeight: 18 }}>
                  {`${pct(row.percentage)}%`}
                </FText>
                <CategoryChange change={row.change} />
              </XStack>
              {stacked ? <View mt={2}>{amount}</View> : null}
            </YStack>
            {stacked ? null : amount}
            {/* "Otros" no abre nada, pero guarda el hueco del chevron para que su monto quede alineado con los demás. */}
            {onPress ? (
              <View pt={stacked ? 10 : 0}>
                <ChevronRight size={16} color="$inkFaint" strokeWidth={2.2} />
              </View>
            ) : (
              <View width={16} />
            )}
          </XStack>
        )}
      </Pressable>
    </View>
  );
}
