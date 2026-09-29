import { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTheme } from "tamagui";
import { useThemeMode } from "../theme/ThemeMode";
import { motion, opacity, shadows } from "../theme/tokens";
import { haptics } from "./haptics";

export interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

const W = 46;
const H = 28;
const KNOB = 22;

/** Interruptor del sistema: encendido en `brand`. La perilla se desliza con `spring-ui`. */
export function Toggle({ value, onValueChange, accessibilityLabel, disabled }: ToggleProps) {
  const theme = useTheme();
  const { themeMode } = useThemeMode();
  const on = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    on.value = withSpring(value ? 1 : 0, motion.springUi);
  }, [on, value]);

  const off = theme.surfaceSunken.val;
  const brand = theme.brand.val;
  const knobOff = themeMode === "dark" ? theme.inkFaint.val : theme.surface.val;
  const knobOn = theme.onBrand.val;

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [off, brand]),
    borderColor: interpolateColor(on.value, [0, 1], [theme.line.val, brand]),
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: on.value * (W - KNOB - 6) }],
    backgroundColor: interpolateColor(on.value, [0, 1], [knobOff, knobOn]),
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPressIn={() => {
        haptics.select();
        onValueChange(!value);
      }}
      style={{ opacity: disabled ? opacity.disabled : 1 }}
    >
      <Animated.View style={[{ width: W, height: H, borderRadius: H / 2, borderWidth: 1, padding: 2 }, trackStyle]}>
        <Animated.View
          style={[{ width: KNOB, height: KNOB, borderRadius: KNOB / 2, boxShadow: shadows[themeMode].raised }, knobStyle]}
        />
      </Animated.View>
    </Pressable>
  );
}
