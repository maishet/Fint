import { useEffect, useState } from "react";
import { Pressable, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { XStack, useTheme } from "tamagui";
import { useThemeMode } from "../theme/ThemeMode";
import { motion, radius, shadows } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FText } from "./FText";
import { haptics } from "./haptics";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
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
 * texto cambia de peso en el mismo frame, con `haptics.select()`.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  const { themeMode } = useThemeMode();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
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
        return (
          <Pressable
            key={option.value}
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPressIn={() => {
              if (selected) return;
              haptics.select();
              onChange(option.value);
            }}
          >
            <FText
              variant="label"
              tone={selected ? "ink" : "inkMuted"}
              style={selected ? { fontFamily: fontFace.sans[600] } : undefined}
              numberOfLines={1}
            >
              {option.label}
            </FText>
          </Pressable>
        );
      })}
    </XStack>
  );
}
