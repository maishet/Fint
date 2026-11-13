import { ChevronLeft, ChevronRight } from "@tamagui/lucide-icons-2";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Text, View, XStack, YStack } from "tamagui";
import { financeApi } from "../api/finance";
import { getAppLocale } from "../i18n";
import { parseDateString, toDateString, todayDateString } from "../finance/dates";
import { COMPACT_FONT_SCALE, motion } from "../theme/tokens";
import { fontFace, textStyles } from "../theme/typography";
import { FintSheet, FText, IconButton, PressableScale } from "../ui";
import { haptics } from "../ui/haptics";
import { daysWithMovements, monthGrid, monthRange } from "./logic";

/** Celda de 44 (área táctil) con el cuadro del día de 42 y radio 14, como en G-06. */
const CELL_H = 44;
const ROW_GAP = 2;
const BOX_H = 42;
const BOX_RADIUS = 14;
const CLOSE_DELAY = 180;

export interface DateSheetProps {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  /**
   * Pagos recurrentes: se programan, así que los días futuros se pueden elegir,
   * los atajos son Hoy y Mañana, y no hay puntos de movimientos.
   */
  allowFuture?: boolean;
}

/** "18 set" con el mes corto del idioma, sin punto. */
export function shortDay(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date).replace(".", "");
}

/** "mar 10": el día de la semana corto, sin punto, y el número (los atajos de G-06). */
function weekdayDay(date: Date, locale: string) {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date).replace(".", "");
  return `${weekday} ${date.getDate()}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Hoja de fecha (marca D, G-06): atajos Hoy, Ayer y Anteayer (con pagos, Hoy y
 * Mañana) en fichas `surface` de 52, la elegida en tinta, y el calendario del mes
 * (empieza en lunes). El día elegido va en un cuadro amarillo de radio 14 con el
 * número en tinta y se desliza desde el anterior; hoy lleva un anillo tinta de 2;
 * los días futuros no se pueden elegir (un movimiento ocurre en el pasado; lo que
 * viene se programa en Pagos). Un punto marca los días con movimientos. Tocar un
 * día lo elige y cierra: no hay botón de confirmar.
 */
export function DateSheet({ open, onClose, value, onChange, allowFuture = false }: DateSheetProps) {
  const { t, i18n } = useTranslation();
  // es-PE: "set." y "setiembre", como el resto de la app.
  const locale = getAppLocale(i18n.resolvedLanguage);
  const reduceMotion = useReducedMotion();
  const today = parseDateString(todayDateString())!;
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const twoDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const selected = parseDateString(value) ?? today;

  const [view, setView] = useState({ y: selected.getFullYear(), m: selected.getMonth() });
  const [direction, setDirection] = useState<1 | -1>(1);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) setView({ y: selected.getFullYear(), m: selected.getMonth() });
    // Solo al abrir: después manda la navegación de la persona.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const isCurrentMonth = view.y === today.getFullYear() && view.m === today.getMonth();
  const range = monthRange(view.y, view.m);
  const monthQuery = useQuery({
    queryKey: ["transactions", "month-days", range.from],
    queryFn: () => financeApi.listAllTransactions({ from: range.from, to: range.to }),
    enabled: open && !allowFuture,
    staleTime: 60_000,
  });
  // Con pagos no hay puntos: la consulta está apagada, pero la caché podría traer los del mes.
  const marked = useMemo(
    () => (allowFuture ? new Set<number>() : daysWithMovements(monthQuery.data ?? [], view.y, view.m)),
    [allowFuture, monthQuery.data, view.y, view.m],
  );
  const grid = useMemo(() => monthGrid(view.y, view.m), [view.y, view.m]);

  const go = (step: 1 | -1) => {
    if (step === 1 && isCurrentMonth && !allowFuture) return;
    haptics.select();
    setDirection(step);
    setView((v) => {
      const d = new Date(v.y, v.m + step, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const pick = (date: Date) => {
    haptics.select();
    onChange(toDateString(date));
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(onClose, CLOSE_DELAY);
  };

  // Deslizar en horizontal cambia de mes; la grilla sigue al dedo y vuelve con `spring-gesture`.
  const dragX = useSharedValue(0);
  const swipe = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      dragX.value = e.translationX * 0.6;
    })
    .onEnd((e) => {
      const step = e.translationX < -48 || e.velocityX < -500 ? 1 : e.translationX > 48 || e.velocityX > 500 ? -1 : 0;
      dragX.value = withSpring(0, { ...motion.springGesture, velocity: e.velocityX });
      if (step !== 0) runOnJS(go)(step as 1 | -1);
    });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.value }] }));

  // Iniciales de lunes a domingo: "L M M J V S D" (Intl daría "X" para el miércoles).
  const weekdays = t("movementForm.dateSheet.weekdays").split(",");

  // "Setiembre 2026", sin el "de" que agrega Intl en español.
  const title = `${new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(view.y, view.m, 1))} ${view.y}`;
  const subtitle = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(selected);

  const selectedIndex =
    selected.getFullYear() === view.y && selected.getMonth() === view.m ? grid.indexOf(selected.getDate()) : -1;

  return (
    <FintSheet open={open} onClose={onClose} title={t("movementForm.dateSheet.title")} subtitle={capitalize(subtitle)}>
      <XStack gap={8} px={20} pt={14}>
        {(allowFuture
          ? [
              { key: "today", label: t("movementForm.today"), date: today },
              { key: "tomorrow", label: t("movementForm.tomorrow"), date: tomorrow },
            ]
          : [
              { key: "today", label: t("movementForm.today"), date: today },
              { key: "yesterday", label: t("movementForm.yesterday"), date: yesterday },
              { key: "twoDaysAgo", label: t("movementForm.dayBeforeYesterday"), date: twoDaysAgo },
            ]
        ).map((q) => (
          <QuickChip key={q.key} label={q.label} date={weekdayDay(q.date, locale)} selected={sameDay(q.date, selected)} onPress={() => pick(q.date)} />
        ))}
      </XStack>

      <XStack items="center" justify="space-between" mt={16} mb={8} mx={20}>
        <FText maxFontSizeMultiplier={1.5} style={{ fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21 }}>
          {capitalize(title)}
        </FText>
        <XStack gap={6}>
          <IconButton size={34} label={t("movementForm.dateSheet.previousMonth")} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} onPress={() => go(-1)} />
          <IconButton
            size={34}
            label={t("movementForm.dateSheet.nextMonth")}
            disabled={isCurrentMonth && !allowFuture}
            icon={<ChevronRight size={20} color="$ink" strokeWidth={2} />}
            onPress={() => go(1)}
          />
        </XStack>
      </XStack>

      <XStack px={20}>
        {weekdays.map((d, i) => (
          <FText
            key={i}
            tone="inkFaint"
            maxFontSizeMultiplier={1.3}
            style={{ flex: 1, textAlign: "center", fontSize: 12, lineHeight: 16, fontFamily: fontFace.display[700], paddingBottom: 4 }}
          >
            {d}
          </FText>
        ))}
      </XStack>

      <GestureDetector gesture={swipe}>
        <Animated.View style={dragStyle}>
          <Animated.View
            key={`${view.y}-${view.m}`}
            entering={reduceMotion ? undefined : slideIn(direction)}
          >
            <CalendarGrid
              grid={grid}
              view={view}
              today={today}
              selectedIndex={selectedIndex}
              marked={marked}
              reduceMotion={reduceMotion}
              allowFuture={allowFuture}
              onPick={pick}
            />
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {allowFuture ? null : (
        <FText tone="inkFaint" style={{ fontSize: 12, lineHeight: 16, marginTop: 12, marginHorizontal: 20 }}>
          {t("movementForm.dateSheet.dotsHint")}
        </FText>
      )}
    </FintSheet>
  );
}

function CalendarGrid({
  grid,
  view,
  today,
  selectedIndex,
  marked,
  reduceMotion,
  allowFuture,
  onPick,
}: {
  grid: (number | null)[];
  view: { y: number; m: number };
  today: Date;
  selectedIndex: number;
  marked: Set<number>;
  reduceMotion: boolean;
  allowFuture: boolean;
  onPick: (date: Date) => void;
}) {
  const { t, i18n } = useTranslation();
  const [cellW, setCellW] = useState(0);
  // Un solo formateador para las etiquetas: crear uno por día costaba segundos al abrir la hoja en Hermes.
  const dayLabel = useMemo(
    () => new Intl.DateTimeFormat(getAppLocale(i18n.resolvedLanguage), { day: "numeric", month: "long" }),
    [i18n.resolvedLanguage],
  );
  const isTodayMonth = view.y === today.getFullYear() && view.m === today.getMonth();

  // El cuadro amarillo del día elegido se desliza desde el día anterior con `spring-ui`.
  const boxW = Math.max(0, cellW - 4);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const shown = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (cellW === 0 || selectedIndex < 0) {
      shown.value = 0;
      placed.current = false;
      return;
    }
    const nx = (selectedIndex % 7) * cellW + 2;
    const ny = Math.floor(selectedIndex / 7) * (CELL_H + ROW_GAP) + (CELL_H - BOX_H) / 2;
    if (!placed.current || reduceMotion) {
      x.value = nx;
      y.value = ny;
      placed.current = true;
    } else {
      x.value = withSpring(nx, motion.springUi);
      y.value = withSpring(ny, motion.springUi);
    }
    shown.value = withTiming(1, motion.fade);
  }, [cellW, reduceMotion, selectedIndex, shown, x, y]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateX: x.value }, { translateY: y.value }] }));

  // La cuadrícula en filas de 7 (se completa la última con vacíos); `i` sigue siendo el índice del día en `grid`.
  const rows = useMemo(() => {
    const padded = [...grid];
    while (padded.length % 7 !== 0) padded.push(null);
    return Array.from({ length: padded.length / 7 }, (_, r) => padded.slice(r * 7, r * 7 + 7).map((day, c) => ({ day, i: r * 7 + c })));
  }, [grid]);

  return (
    <YStack px={20} onLayout={(e: LayoutChangeEvent) => setCellW((e.nativeEvent.layout.width - 40) / 7)}>
      {cellW > 0 ? (
        <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 20, top: 0, width: boxW, height: BOX_H }, dotStyle]}>
          <View flex={1} rounded={BOX_RADIUS} bg="$brand" />
        </Animated.View>
      ) : null}
      {/* Filas de 7 con `flex: 1`: con `flexWrap` y `14.28%` de ancho, en iOS 27 el redondeo pasaba del 100 % y rompía a los 6 días. */}
      <YStack rowGap={ROW_GAP}>
        {rows.map((row, r) => (
          <XStack key={r}>
            {row.map(({ day, i }) => {
          if (day === null) return <View key={`e${i}`} flex={1} height={CELL_H} />;
          const date = new Date(view.y, view.m, day);
          const future = allowFuture ? false : isTodayMonth ? day > today.getDate() : date > today;
          const isToday = isTodayMonth && day === today.getDate();
          const isSelected = i === selectedIndex;
          return (
            <Pressable
              key={day}
              disabled={future}
              onPress={() => onPick(date)}
              style={{ flex: 1, height: CELL_H, alignItems: "center", justifyContent: "center" }}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: future }}
              // Los puntos solo se ven: el lector dice ", con movimientos" para el mismo dato.
              accessibilityLabel={marked.has(day) ? `${dayLabel.format(date)}, ${t("movementForm.dateSheet.withMovements")}` : dayLabel.format(date)}
            >
              <View
                width={boxW || "100%"}
                height={BOX_H}
                rounded={BOX_RADIUS}
                items="center"
                justify="center"
                gap={2}
                borderWidth={isToday && !isSelected ? 2 : 0}
                borderColor="$ink"
                opacity={future ? 0.4 : 1}
              >
                <Text
                  maxFontSizeMultiplier={1.3}
                  style={[textStyles.amount, { fontSize: 15, fontFamily: isSelected ? fontFace.mono[600] : fontFace.mono[500] }]}
                  color={isSelected ? "$onBrand" : future ? "$inkFaint" : "$ink"}
                >
                  {day}
                </Text>
                <View width={4} height={4} rounded={999} bg={marked.has(day) ? (isSelected ? "$onBrand" : "$inkMuted") : "transparent"} />
              </View>
            </Pressable>
          );
            })}
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

/** Atajo Hoy / Ayer / Anteayer (G-06): ficha `surface` de 52 con el nombre y "mar 10" debajo; la elegida en tinta. */
function QuickChip({ label, date, selected, onPress }: { label: string; date: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      style={{ flexGrow: 1, flexBasis: 0 }}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${date}`}
      accessibilityState={{ selected }}
    >
      <YStack minH={52} py={6} gap={1} items="center" justify="center" rounded={16} bg={selected ? "$ink" : "$surface"}>
        <FText color={selected ? "$canvas" : "$ink"} maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.display[700], fontSize: 14, lineHeight: 18 }}>
          {label}
        </FText>
        <FText color={selected ? "$canvas" : "$ink"} maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontSize: 12, lineHeight: 16, opacity: 0.75 }}>
          {date}
        </FText>
      </YStack>
    </PressableScale>
  );
}

function slideIn(direction: 1 | -1) {
  return () => {
    "worklet";
    return {
      initialValues: { opacity: 0, transform: [{ translateX: 24 * direction }] },
      animations: {
        opacity: withTiming(1, { duration: 180 }),
        transform: [{ translateX: withSpring(0, motion.springGesture) }],
      },
    };
  };
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
