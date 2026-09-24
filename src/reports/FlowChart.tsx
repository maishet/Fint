import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View as RNView, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { View, XStack, YStack } from "tamagui";
import { motion, opacity, radius, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { Amount, FText } from "../ui";
import { haptics } from "../ui/haptics";

/** Alto de las barras y de la lente; debajo, la etiqueta. */
const BARS_H = 104;
const LENS_H = 112;
const LABEL_H = 14;

export interface FlowChartColumn {
  key: string;
  /** Etiqueta corta bajo la columna ("7-13 set", "lun 21", "ene"). */
  label: string;
  /** Nombre completo para el resumen de arriba y el lector de pantalla. */
  title: string;
  income: number;
  expenses: number;
}

/**
 * Barras pareadas de ingreso (`flowIn`) y egreso (`flowOut`), una columna por
 * semana, día o mes, con una lente de `surfaceSunken` que sigue al dedo 1:1 y
 * hace snap a la columna más cercana al soltar, heredando la velocidad del
 * gesto (con movimiento reducido, sin resorte). El resumen de arriba cambia en
 * el mismo frame que el háptico de selección. Tocar una columna también la elige.
 */
export function FlowChart({ columns, currency, initialIndex }: { columns: readonly FlowChartColumn[]; currency: string; initialIndex: number }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(initialIndex);
  const n = Math.max(1, columns.length);
  const colW = width / n;
  const index = Math.min(Math.max(0, selected), columns.length - 1);
  const lensX = useSharedValue(0);
  const current = useSharedValue(index);

  // Otro periodo trae otras columnas: vuelve a la sugerida y coloca la lente sin animar.
  useEffect(() => {
    setSelected(initialIndex);
  }, [columns, initialIndex]);
  useEffect(() => {
    current.value = index;
    if (colW > 0) lensX.value = index * colW;
  }, [colW, current, index, lensX]);

  const max = Math.max(1, ...columns.flatMap((c) => [c.income, c.expenses]));
  const barH = (v: number) => (v > 0 ? Math.max(4, Math.round((v / max) * BARS_H)) : 0);
  // 11px por barra y 5px entre el par; con muchas columnas (un año) se angostan para que el par siga leyéndose.
  const barW = Math.max(5, Math.min(11, Math.floor((colW - 10) / 2)));
  const pairGap = barW >= 9 ? 5 : 3;

  const choose = (i: number) => {
    haptics.select();
    setSelected(i);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      if (colW <= 0) return;
      lensX.value = Math.min(Math.max(0, e.x - colW / 2), width - colW);
      const i = Math.min(n - 1, Math.max(0, Math.round(lensX.value / colW)));
      if (i !== current.value) {
        current.value = i;
        runOnJS(choose)(i);
      }
    })
    .onEnd((e) => {
      const target = current.value * colW;
      lensX.value = reduceMotion ? target : withSpring(target, { ...motion.springGesture, velocity: e.velocityX });
    });
  const tap = Gesture.Tap().onEnd((e) => {
    if (colW <= 0) return;
    const i = Math.min(n - 1, Math.max(0, Math.floor(e.x / colW)));
    lensX.value = reduceMotion ? i * colW : withSpring(i * colW, motion.springUi);
    if (i !== current.value) {
      current.value = i;
      runOnJS(choose)(i);
    }
  });
  const lensStyle = useAnimatedStyle(() => ({ transform: [{ translateX: lensX.value }] }));

  const sel = columns[index];

  return (
    <YStack>
      <XStack gap={16}>
        <Legend color="$flowIn" label={t("reportsTab.income")} />
        <Legend color="$flowOut" label={t("reportsTab.expenses")} />
      </XStack>

      {sel ? (
        <XStack mt={12} px={12} py={9} rounded={radius.md} bg="$surfaceSunken" items="center" justify="space-between" gap={space[3]}>
          <FText variant="body-strong" style={{ fontSize: 13 }} numberOfLines={1}>
            {sel.title}
          </FText>
          <YStack items="flex-end">
            <Amount value={sel.income} currency={currency} kind="income" variant="amount-sm" showSymbol={false} />
            <Amount value={sel.expenses} currency={currency} kind="expense" variant="amount-sm" tone="flowOut" showSymbol={false} />
          </YStack>
        </XStack>
      ) : null}

      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <RNView
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          style={{ height: LENS_H + 8 + LABEL_H + 6, marginTop: 12 }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={sel ? `${sel.title}. ${t("reportsTab.income")}: ${sel.income}. ${t("reportsTab.expenses")}: ${sel.expenses}` : undefined}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => {
            const next = e.nativeEvent.actionName === "increment" ? index + 1 : index - 1;
            if (next >= 0 && next < columns.length) choose(next);
          }}
        >
          {colW > 0 ? (
            <Animated.View style={[{ position: "absolute", top: 0, left: 0, width: colW, height: LENS_H }, lensStyle]}>
              <View flex={1} rounded={radius.md} bg="$surfaceSunken" />
            </Animated.View>
          ) : null}
          <XStack flex={1}>
            {columns.map((c, i) => {
              const on = i === index;
              return (
                <YStack key={c.key} flex={1} items="center">
                  <XStack height={LENS_H} items="flex-end" justify="center" gap={pairGap} pb={LENS_H - BARS_H}>
                    {barH(c.income) > 0 ? (
                      <View width={barW} height={barH(c.income)} bg="$flowIn" opacity={on ? 1 : opacity.idle} style={{ borderRadius: radius.xs }} />
                    ) : (
                      <View width={barW} />
                    )}
                    {barH(c.expenses) > 0 ? (
                      <View width={barW} height={barH(c.expenses)} bg="$flowOut" opacity={on ? 1 : opacity.idle} style={{ borderRadius: radius.xs }} />
                    ) : (
                      <View width={barW} />
                    )}
                  </XStack>
                  <FText
                    variant="figure-caption"
                    tone={on ? "brand" : "inkFaint"}
                    numberOfLines={1}
                    style={{ marginTop: 8, fontSize: 10, fontFamily: on ? fontFace.mono[600] : fontFace.mono[400] }}
                  >
                    {c.label}
                  </FText>
                </YStack>
              );
            })}
          </XStack>
        </RNView>
      </GestureDetector>
    </YStack>
  );
}

function Legend({ color, label }: { color: "$flowIn" | "$flowOut"; label: string }) {
  return (
    <XStack items="center" gap={6}>
      <View width={8} height={8} rounded={999} bg={color} />
      <FText variant="caption" tone="inkMuted">
        {label}
      </FText>
    </XStack>
  );
}
