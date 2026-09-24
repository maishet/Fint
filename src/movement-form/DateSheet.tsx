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
import { motion, opacity } from "../theme/tokens";
import { fontFace, textStyles } from "../theme/typography";
import { FintSheet, FText, IconButton, PressableScale } from "../ui";
import { haptics } from "../ui/haptics";
import { daysWithMovements, monthGrid, monthRange } from "./logic";

const CELL_H = 44;
const ROW_GAP = 2;
const DOT = 38;
const CLOSE_DELAY = 180;

export interface DateSheetProps {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
}

/** "18 set" con el mes corto del idioma, sin punto. */
export function shortDay(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date).replace(".", "");
}

/**
 * Hoja de fecha: atajos Hoy y Ayer, y el calendario del mes (empieza en lunes).
 * El día elegido va relleno en `brand` y se desliza desde el anterior; hoy
 * lleva un anillo; los días futuros no se pueden elegir (un movimiento ocurre
 * en el pasado; lo que viene se programa en Pagos). Un punto marca los días con
 * movimientos. Tocar un día lo elige y cierra: no hay botón de confirmar.
 */
export function DateSheet({ open, onClose, value, onChange }: DateSheetProps) {
  const { t, i18n } = useTranslation();
  // es-PE: "set." y "setiembre", como el resto de la app.
  const locale = getAppLocale(i18n.resolvedLanguage);
  const reduceMotion = useReducedMotion();
  const today = parseDateString(todayDateString())!;
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
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
    enabled: open,
    staleTime: 60_000,
  });
  const marked = useMemo(() => daysWithMovements(monthQuery.data ?? [], view.y, view.m), [monthQuery.data, view.y, view.m]);
  const grid = useMemo(() => monthGrid(view.y, view.m), [view.y, view.m]);

  const go = (step: 1 | -1) => {
    if (step === 1 && isCurrentMonth) return;
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
      <XStack gap={8} px={16} pt={14}>
        <QuickChip label={t("movementForm.today")} date={shortDay(today, locale)} onPress={() => pick(today)} />
        <QuickChip label={t("movementForm.yesterday")} date={shortDay(yesterday, locale)} onPress={() => pick(yesterday)} />
      </XStack>

      <XStack items="center" justify="space-between" mt={20} mb={6} mx={20}>
        <FText variant="heading" style={{ fontFamily: fontFace.display[600], letterSpacing: -0.3 }}>
          {capitalize(title)}
        </FText>
        <XStack gap={6}>
          <IconButton size={34} label={t("movementForm.dateSheet.previousMonth")} icon={<ChevronLeft size={16} color="$ink" />} onPress={() => go(-1)} />
          <IconButton
            size={34}
            label={t("movementForm.dateSheet.nextMonth")}
            disabled={isCurrentMonth}
            icon={<ChevronRight size={16} color="$ink" />}
            onPress={() => go(1)}
          />
        </XStack>
      </XStack>

      <XStack px={12}>
        {weekdays.map((d, i) => (
          <FText
            key={i}
            variant="caption"
            tone="inkFaint"
            style={{ flex: 1, textAlign: "center", fontSize: 11, fontFamily: fontFace.sans[600], paddingTop: 6, paddingBottom: 8 }}
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
              onPick={pick}
            />
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <FText variant="caption" tone="inkFaint" style={{ textAlign: "center", marginTop: 12 }}>
        {t("movementForm.dateSheet.dotsHint")}
      </FText>
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
  onPick,
}: {
  grid: (number | null)[];
  view: { y: number; m: number };
  today: Date;
  selectedIndex: number;
  marked: Set<number>;
  reduceMotion: boolean;
  onPick: (date: Date) => void;
}) {
  const { i18n } = useTranslation();
  const [cellW, setCellW] = useState(0);
  // Un solo formateador para las etiquetas: crear uno por día costaba segundos al abrir la hoja en Hermes.
  const dayLabel = useMemo(
    () => new Intl.DateTimeFormat(getAppLocale(i18n.resolvedLanguage), { day: "numeric", month: "long" }),
    [i18n.resolvedLanguage],
  );
  const isTodayMonth = view.y === today.getFullYear() && view.m === today.getMonth();

  // El círculo del día elegido se desliza desde el día anterior con `spring-ui`.
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
    const nx = (selectedIndex % 7) * cellW + (cellW - DOT) / 2;
    const ny = Math.floor(selectedIndex / 7) * (CELL_H + ROW_GAP) + (CELL_H - DOT) / 2;
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

  return (
    <YStack px={12} onLayout={(e: LayoutChangeEvent) => setCellW((e.nativeEvent.layout.width - 24) / 7)}>
      {cellW > 0 ? (
        <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 12, top: 0, width: DOT, height: DOT }, dotStyle]}>
          <View flex={1} rounded={999} bg="$brand" />
        </Animated.View>
      ) : null}
      <XStack flexWrap="wrap" rowGap={ROW_GAP}>
        {grid.map((day, i) => {
          if (day === null) return <View key={`e${i}`} width={`${100 / 7}%`} height={CELL_H} />;
          const date = new Date(view.y, view.m, day);
          const future = isTodayMonth ? day > today.getDate() : date > today;
          const isToday = isTodayMonth && day === today.getDate();
          const isSelected = i === selectedIndex;
          return (
            <Pressable
              key={day}
              disabled={future}
              onPress={() => onPick(date)}
              style={{ width: `${100 / 7}%`, height: CELL_H, alignItems: "center", justifyContent: "center" }}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: future }}
              accessibilityLabel={dayLabel.format(date)}
            >
              <View
                width={DOT}
                height={DOT}
                rounded={999}
                items="center"
                justify="center"
                borderWidth={isToday && !isSelected ? 1.5 : 0}
                borderColor="$brand"
                opacity={future ? opacity.disabled : 1}
              >
                <Text
                  style={[textStyles.amount, { fontSize: 15 }]}
                  color={isSelected ? "$onBrand" : isToday ? "$brand" : future ? "$inkFaint" : "$ink"}
                >
                  {day}
                </Text>
              </View>
              {marked.has(day) ? (
                <View position="absolute" b={4} width={4} height={4} rounded={999} bg={isSelected ? "$onBrand" : "$inkFaint"} />
              ) : null}
            </Pressable>
          );
        })}
      </XStack>
    </YStack>
  );
}

/** Atajo Hoy / Ayer: el nombre en `ink` y la fecha en `mono` apagada. */
function QuickChip({ label, date, onPress }: { label: string; date: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={{ flexGrow: 1, flexBasis: 0 }} accessibilityRole="button" accessibilityLabel={`${label}, ${date}`}>
      <XStack height={32} gap={6} items="center" justify="center" rounded={999} borderWidth={1} borderColor="$lineStrong" bg="$surface">
        <FText variant="label">{label}</FText>
        <FText variant="caption" tone="inkFaint" style={{ fontFamily: fontFace.mono[500] }}>
          {date}
        </FText>
      </XStack>
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
