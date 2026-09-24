import { Delete } from "@tamagui/lucide-icons-2";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { XStack, YStack, useTheme } from "tamagui";
import type { AmountKey } from "../forms/amountInput";
import { motion, radius } from "../theme/tokens";
import { textStyles } from "../theme/typography";
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
 * Teclado propio del monto: doce teclas de 56px. Cada tecla responde en el
 * `onPressIn`: fondo `surfaceSunken` con la curva `press` y `haptics.select()`
 * en el mismo frame. El teclado del sistema nunca aparece en el monto.
 */
export function AmountKeypad({ onKey, onClear }: AmountKeypadProps) {
  return (
    <YStack gap={4} px={10} pt={12} borderTopWidth={1} borderColor="$line">
      {ROWS.map((row) => (
        <XStack key={row.join("")} gap={4}>
          {row.map((key) => (
            <Key key={key} value={key} onKey={onKey} onClear={onClear} />
          ))}
        </XStack>
      ))}
    </YStack>
  );
}

function Key({ value, onKey, onClear }: { value: AmountKey; onKey: (k: AmountKey) => void; onClear?: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const pressed = useSharedValue(0);
  const from = "rgba(0,0,0,0)";
  const to = theme.surfaceSunken.val;
  const bg = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(pressed.value, [0, 1], [from, to]) }));
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
    >
      <Animated.View style={[{ height: 56, borderRadius: radius.md, alignItems: "center", justifyContent: "center" }, bg]}>
        {isDelete ? (
          <Delete size={24} color="$ink" strokeWidth={1.8} />
        ) : (
          <Animated.Text style={[textStyles.amount, { fontSize: 26, lineHeight: 30, color: theme.ink.val }]}>{value}</Animated.Text>
        )}
      </Animated.View>
    </Pressable>
  );
}
