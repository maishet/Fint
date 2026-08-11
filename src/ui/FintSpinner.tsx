import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";
import { useTheme } from "tamagui";

export interface FintSpinnerProps {
  /**
   * Token de tema (`$primaryForeground`), color literal o el `Variable` que
   * Tamagui inyecta cuando el spinner se pasa por la prop `icon` de un botón.
   */
  color?: string | { val?: unknown };
  size?: "small" | "large" | number;
}

const SIZES = { large: 24, small: 16 } as const;
const SPIN_MS = 800;

function resolveColor(
  theme: ReturnType<typeof useTheme>,
  color: FintSpinnerProps["color"],
): string | undefined {
  if (!color) return undefined;
  // Tamagui clona el icono con el color ya resuelto en un `Variable`.
  if (typeof color === "object") {
    return typeof color.val === "string" ? color.val : undefined;
  }
  if (!color.startsWith("$")) return color;
  const token = theme[color.slice(1) as keyof typeof theme] as
    | { val?: unknown }
    | undefined;
  return typeof token?.val === "string" ? token.val : undefined;
}

/**
 * Indicador de carga en línea: un aro que gira, para botones, footers de
 * listas y acciones de fila. Compacto y legible sin texto que lo acompañe.
 *
 * Para pantallas de carga completas usa `FintLoadingScreen`, que muestra el
 * isotipo animado.
 */
export function FintSpinner({ color, size = "small" }: FintSpinnerProps) {
  const theme = useTheme();
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isActive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isActive) setIsReduceMotionEnabled(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setIsReduceMotionEnabled,
    );

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isReduceMotionEnabled) {
      rotation.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(rotation, {
        duration: SPIN_MS,
        easing: Easing.linear,
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [isReduceMotionEnabled, rotation]);

  const diameter = typeof size === "number" ? size : SIZES[size];
  const resolved = resolveColor(theme, color) ?? resolveColor(theme, "$color");

  return (
    <Animated.View
      accessibilityRole="progressbar"
      style={{
        borderColor: resolved,
        borderRadius: diameter / 2,
        borderTopColor: "transparent",
        borderWidth: Math.max(2, Math.round(diameter * 0.13)),
        height: diameter,
        transform: [
          {
            rotate: rotation.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "360deg"],
            }),
          },
        ],
        width: diameter,
      }}
    />
  );
}
