import { Delete } from "@tamagui/lucide-icons-2";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { XStack, YStack, useTheme } from "tamagui";
import type { AmountKey } from "../forms/amountInput";
import { COMPACT_FONT_SCALE, compactBlockMaxWidth, motion } from "../theme/tokens";
import { fontFace, textStyles } from "../theme/typography";
import { haptics } from "./haptics";

const ROWS: AmountKey[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "del"],
];

export interface AmountKeypadProps {
  onKey: (key: AmountKey) => void;
  /** Mantener presionado borrar vacía el monto. */
  onClear?: () => void;
}

/**
 * Teclado propio del monto (marca D): doce teclas de 54px en `surface` con radio
 * 16. Cada tecla responde en el `onPressIn`: pasa a `surfaceSunken` y a escala
 * .94 con la curva `press`, y `haptics.select()` en el mismo frame. El teclado
 * del sistema nunca aparece en el monto.
 */
export function AmountKeypad({ onKey, onClear }: AmountKeypadProps) {
  return (
    <YStack px={20} pt={12} items="center">
      <YStack gap={6} width="100%" maxW={compactBlockMaxWidth}>
        {ROWS.map((row) => (
          <XStack key={row.join("")} gap={6}>
            {row.map((key) => (
              <Key key={key} value={key} onKey={onKey} onClear={onClear} />
            ))}
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

function Key({ value, onKey, onClear }: { value: AmountKey; onKey: (k: AmountKey) => void; onClear?: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const pressed = useSharedValue(0);
  const from = theme.surface.val;
  const to = theme.surfaceSunken.val;
  const bg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(pressed.value, [0, 1], [from, to]),
    transform: [{ scale: 1 - 0.06 * pressed.value }],
  }));
  const isDelete = value === "del";

  return (
    <Pressable
      style={{ flex: 1 }}
      accessibilityRole="keyboardkey"
      accessibilityLabel={isDelete ? t("amountKeypad.delete") : value === "." ? t("amountKeypad.decimal") : value}
      onPressIn={() => {
        pressed.value = withTiming(1, motion.press);
        haptics.select();
        onKey(value);
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, motion.fade);
      }}
      onLongPress={
        isDelete && onClear
          ? () => {
              onClear();
              haptics.tap();
            }
          : undefined
      }
      delayLongPress={450}
      // Mantener presionado no se anuncia: para el lector, "Borrar todo el monto" es una acción de la tecla.
      accessibilityActions={isDelete && onClear ? [{ name: "longpress", label: t("amountKeypad.clear") }] : undefined}
      onAccessibilityAction={() => onClear?.()}
    >
      <Animated.View style={[{ height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center" }, bg]}>
        {isDelete ? (
          <Delete size={24} color="$ink" strokeWidth={1.8} />
        ) : (
          <Animated.Text maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={[textStyles.amount, { fontFamily: fontFace.mono[600], fontSize: 24, lineHeight: 30, color: theme.ink.val }]}>
            {value}
          </Animated.Text>
        )}
      </Animated.View>
    </Pressable>
  );
}
