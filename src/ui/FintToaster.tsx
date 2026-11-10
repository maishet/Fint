import { AlertCircle, CheckCircle2, Info } from "@tamagui/lucide-icons-2";
import { useContext, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, FadeOut, SlideInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { initialWindowMetrics, SafeAreaInsetsContext } from "react-native-safe-area-context";
import { Toaster } from "sonner-native";
import { floatingTabBarHeight } from "../components/FintTabBar";
import type { ThemeMode } from "../theme/ThemeMode";
import { useThemeMode } from "../theme/ThemeMode";
import { fintPalette } from "../theme/palette";
import { motion } from "../theme/tokens";
import { fontFace } from "../theme/typography";

const DEFAULT_DURATION = 4000;
/** Distancia del borde superior a los avisos simples (los de arriba). */
const TOP_OFFSET = 56;
/** Separación entre el aviso con acción y la barra de pestañas. */
const ABOVE_TAB_BAR = 8;

/**
 * El aviso con acción va invertido respecto del fondo para despegarse: tarjeta tinta en claro y papel en oscuro.
 * Los íconos también se invierten; contra su tarjeta dan, en claro, éxito 9.8:1, error 6.1:1 e info 16.6:1, y en
 * oscuro, éxito 4.9:1, error 4.9:1 e info 16.6:1 (todos sobre los 3:1 de WCAG 1.4.11).
 */
const INVERTED = {
  light: {
    card: fintPalette.light.ink,
    title: fintPalette.light.onChipOn,
    description: fintPalette.dark.muted,
    bar: fintPalette.light.brand,
    success: fintPalette.dark.flowIn,
    error: fintPalette.dark.dangerHard,
    info: fintPalette.dark.ink,
  },
  dark: {
    card: fintPalette.dark.ink,
    title: fintPalette.light.ink,
    description: fintPalette.light.muted,
    bar: fintPalette.light.ink,
    success: fintPalette.light.flowIn,
    error: fintPalette.light.dangerHard,
    info: fintPalette.light.ink,
  },
} as const;

export type ToastPreset = "success" | "error" | "info";

/** El tema activo, que `FintToaster` deja aquí para que `notify` (fuera de React) arme el aviso invertido. */
let currentMode: ThemeMode = "light";
let reduceMotion = false;

/** Fondo del aviso con acción: la tarjeta invertida y la barra de tiempo que se acorta lineal mientras dura. */
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

function invertedIcon(preset: ToastPreset) {
  const c = INVERTED[currentMode];
  if (preset === "success") return <CheckCircle2 size={20} color={c.success} />;
  if (preset === "error") return <AlertCircle size={20} color={c.error} />;
  return <Info size={20} color={c.info} />;
}

/**
 * Opciones del aviso con acción ("Deshacer"): abajo, encima de la barra de pestañas, entra desde abajo con
 * `springUi` (con movimiento reducido, sin desplazarse) y va invertido con su barra de tiempo.
 */
export function actionToastOptions(duration: number | undefined, preset: ToastPreset, hasCustomIcon: boolean) {
  const c = INVERTED[currentMode];
  const enter = reduceMotion
    ? undefined
    : SlideInDown.springify().damping(motion.springUi.damping).stiffness(motion.springUi.stiffness).mass(motion.springUi.mass);
  return {
    position: "bottom-center" as const,
    ...(enter ? { animation: { enter, exit: FadeOut.duration(motion.fade.duration) } } : {}),
    ...(hasCustomIcon ? {} : { icon: invertedIcon(preset) }),
    style: { borderColor: c.card, borderWidth: 0, borderRadius: 20 },
    styles: {
      title: { color: c.title, fontFamily: fontFace.sans[600], fontSize: 14 },
      description: { color: c.description },
    },
    actionButtonStyle: { backgroundColor: fintPalette.light.brand, borderWidth: 0, borderRadius: 999, minHeight: 34, paddingHorizontal: 20 },
    actionButtonTextStyle: { color: fintPalette.light.onBrand, fontFamily: fontFace.sans[600], fontSize: 14 },
    backgroundComponent: <TimerBackground color={c.card} bar={c.bar} duration={duration ?? DEFAULT_DURATION} />,
  };
}

/**
 * Los avisos simples salen arriba; los que llevan acción, abajo sobre la barra de pestañas. sonner-native comparte
 * un solo `offset` entre posiciones, así que el contenedor de abajo se sube con `marginBottom`, que en el de arriba
 * no tiene efecto.
 *
 * La dirección para descartar es una sola para todos los avisos (sonner-native no la acepta por aviso), pero con
 * `up` cada uno se va hacia su borde: los de arriba hacia arriba y el de deshacer, abajo, hacia abajo.
 */
export function FintToaster() {
  const { themeMode } = useThemeMode();
  // Dentro del portal puede no llegar el contexto de márgenes seguros: se cae a las medidas iniciales de la ventana.
  const insets = useContext(SafeAreaInsetsContext) ?? initialWindowMetrics?.insets ?? { bottom: 0 };
  reduceMotion = useReducedMotion();
  const palette = fintPalette[themeMode];
  currentMode = themeMode;

  return (
    <Toaster
      theme={themeMode}
      position="top-center"
      offset={TOP_OFFSET}
      positionerStyle={{ marginBottom: floatingTabBarHeight(insets.bottom) + ABOVE_TAB_BAR - TOP_OFFSET }}
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
          borderWidth: 0,
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
