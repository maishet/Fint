import { AlertCircle, CheckCircle2, Info } from "@tamagui/lucide-icons-2";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Toaster } from "sonner-native";
import type { ThemeMode } from "../theme/ThemeMode";
import { useThemeMode } from "../theme/ThemeMode";
import { fintPalette } from "../theme/palette";
import { fontFace } from "../theme/typography";

const DEFAULT_DURATION = 4000;

const INVERTED = {
  light: {
    card: fintPalette.light.ink,
    title: fintPalette.light.onChipOn,
    description: fintPalette.dark.muted,
    bar: fintPalette.light.brand,
  },
  dark: {
    card: fintPalette.dark.ink,
    title: fintPalette.light.ink,
    description: fintPalette.light.muted,
    bar: fintPalette.light.ink,
  },
} as const;

let currentMode: ThemeMode = "light";

function TimerBackground({ color, bar, duration }: { color: string; bar: string; duration: number }) {
  const progress = useSharedValue(1);
  useEffect(() => {
    progress.value = withTiming(0, { duration, easing: Easing.linear });
  }, [duration, progress]);
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color }]}>
      <Animated.View style={[{ position: "absolute", left: 0, bottom: 0, height: 3, backgroundColor: bar }, barStyle]} />
    </View>
  );
}

export function actionToastOptions(duration: number | undefined) {
  const c = INVERTED[currentMode];
  return {
    style: { borderColor: c.card, borderWidth: 0, borderRadius: 20 },
    styles: {
      title: { color: c.title, fontFamily: fontFace.sans[600], fontSize: 14 },
      description: { color: c.description },
    },
    actionButtonStyle: { backgroundColor: fintPalette.light.brand, borderRadius: 999, minHeight: 34, paddingHorizontal: 20 },
    actionButtonTextStyle: { color: fintPalette.light.onBrand, fontFamily: fontFace.sans[600], fontSize: 14 },
    backgroundComponent: <TimerBackground color={c.card} bar={c.bar} duration={duration ?? DEFAULT_DURATION} />,
  };
}

export function FintToaster() {
  const { themeMode } = useThemeMode();
  const palette = fintPalette[themeMode];
  currentMode = themeMode;

  return (
    <Toaster
      theme={themeMode}
      position="top-center"
      offset={56}
      gap={10}
      duration={DEFAULT_DURATION}
      visibleToasts={3}
      swipeToDismissDirection="up"
      icons={{
        success: <CheckCircle2 size={20} color={palette.flowIn} />,
        error: <AlertCircle size={20} color={palette.dangerHard} />,
        info: <Info size={20} color={palette.ink} />,
      }}
      toastOptions={{
        style: {
          backgroundColor: palette.surface,
          borderColor: palette.surface,
          borderWidth: 0,
          borderRadius: 20,
        },
        titleStyle: {
          color: palette.text,
          fontFamily: fontFace.sans[600],
          fontSize: 15,
        },
        descriptionStyle: {
          color: palette.muted,
          fontFamily: fontFace.sans[400],
          fontSize: 13,
        },
        actionButtonStyle: {
          backgroundColor: palette.brand,
          borderRadius: 999,
          minHeight: 34,
          paddingHorizontal: 20,
        },
        actionButtonTextStyle: {
          color: palette.onBrand,
          fontFamily: fontFace.sans[600],
        },
      }}
    />
  );
}
