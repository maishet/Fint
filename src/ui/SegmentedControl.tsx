import { useEffect, useState } from "react";
import { Pressable, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { XStack, useTheme } from "tamagui";
import { useThemeMode } from "../theme/ThemeMode";
import { COMPACT_FONT_SCALE, motion, radius, shadows } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FText } from "./FText";
import { haptics } from "./haptics";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Cantidad junto a la etiqueta, en `mono` ("Egresos 8"): `inkMuted` en la pestaña elegida, `inkFaint` en las demás. */
  count?: number;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `md` 38px (pestañas de tarjeta y del formulario), `sm` 34px (dentro de un recuadro). */
  size?: "md" | "sm";
  accessibilityLabel?: string;
}

const PAD = 3;

/**
 * Selector segmentado. El fondo `segmentThumb` se desliza con `spring-ui` y el
 * texto cambia de peso en el mismo frame en que se presiona. `onChange` y
 * `haptics.select()` van al soltar: dentro de un scroll, empezar a desplazar con
 * el dedo sobre el control no lo activa (WCAG 2.5.2); el cambio visual se
 * deshace solo si el toque se cancela.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, size = "md", accessibilityLabel }: SegmentedControlProps<T>) {
  const theme = useTheme();
  const { themeMode } = useThemeMode();
  const [width, setWidth] = useState(0);
  const [pressing, setPressing] = useState<T | null>(null);
  const shown = pressing ?? value;
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === shown),
  );
  const segment = width > 0 ? (width - PAD * 2) / options.length : 0;
  const x = useSharedValue(0);
  const height = size === "md" ? 38 : 34;

  useEffect(() => {
    if (segment > 0) x.value = withSpring(index * segment, motion.springUi);
  }, [index, segment, x]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <XStack
      height={height}
      p={PAD}
      rounded={radius.pill}
      bg="$surfaceSunken"
      role="tablist"
      aria-label={accessibilityLabel}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      {segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: PAD,
              left: PAD,
              width: segment,
              height: height - PAD * 2,
              borderRadius: radius.pill,
              backgroundColor: theme.segmentThumb.val,
              borderWidth: 1,
              borderColor: theme.line.val,
              boxShadow: shadows[themeMode].card,
            },
            thumbStyle,
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        const active = option.value === shown;
        return (
          <Pressable
            key={option.value}
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            // Cada segmento mide 28-32; el área de toque llega a 48 (Android) sin cambiar lo que se ve.
            hitSlop={{ top: 10, bottom: 10 }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPressIn={() => {
              if (!selected) setPressing(option.value);
            }}
            // `onPressOut` llega antes que `onPress` y en el mismo lote: al soltar no hay un instante de vuelta atrás.
            onPressOut={() => setPressing(null)}
            onPress={() => {
              if (selected) return;
              haptics.select();
              onChange(option.value);
            }}
          >
            <FText
              variant="label"
              tone={active ? "ink" : "inkMuted"}
              style={active ? { fontFamily: fontFace.sans[600] } : undefined}
              numberOfLines={1}
              maxFontSizeMultiplier={COMPACT_FONT_SCALE}
            >
              {option.label}
              {option.count !== undefined ? (
                <FText variant="label" tone={active ? "inkMuted" : "inkFaint"} style={{ fontFamily: fontFace.mono[500], fontSize: 12 }}>
                  {`  ${option.count}`}
                </FText>
              ) : null}
            </FText>
          </Pressable>
        );
      })}
    </XStack>
  );
}
