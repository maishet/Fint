import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Plus } from "@tamagui/lucide-icons-2";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useThemeName } from "tamagui";
import { useThemeMode } from "../theme/ThemeMode";
import { motion, radius, shadows } from "../theme/tokens";
import { PressableScale } from "../ui/PressableScale";
import { haptics } from "../ui/haptics";

/** Medidas del design system: tabs de 56x46, 7px de padding, botón central de 54px en un hueco de 70px. */
const TAB_W = 56;
const TAB_H = 46;
const BAR_PADDING = 7;
const BAR_HEIGHT = TAB_H + BAR_PADDING * 2;
const FAB_SIZE = 54;
const FAB_SLOT = 70;
const FAB_LIFT = 22;
const BAR_BOTTOM_GAP = 10;
const BAR_INSET = 16;
const FADE_HEIGHT = 150;

/** Alto que ocupa la barra flotante; úsalo para el padding inferior de las listas. */
export function floatingTabBarHeight(bottomInset: number) {
  return BAR_HEIGHT + Math.max(bottomInset, BAR_INSET) + BAR_BOTTOM_GAP;
}

function withAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return hex;
  const int = Number.parseInt(value, 16);
  return `rgba(${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},${alpha})`;
}

function useReduceTransparency() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceTransparencyEnabled?.().then(setReduce).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.("reduceTransparencyChanged", setReduce);
    return () => sub?.remove();
  }, []);
  return reduce;
}

export interface FintTabBarProps extends BottomTabBarProps {
  /**
   * El botón central de registro. Con él, la barra deja un hueco de 70px al
   * centro y pinta encima el disco `brand`. Siempre es el mismo más y siempre
   * abre la misma hoja, en cualquier tab.
   */
  centerAction?: { label: string; onPress: () => void };
}

/**
 * Barra de tabs flotante: `glass` con desenfoque, `radius-2xl`, píldora
 * `brandWash` bajo el tab activo que se desliza con `spring-ui`. Solo iconos;
 * cada tab lleva su nombre para el lector de pantalla.
 */
export function FintTabBar({ state, descriptors, navigation, centerAction }: FintTabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const themeName = useThemeName();
  const { themeMode } = useThemeMode();
  const reduceTransparency = useReduceTransparency();

  const count = state.routes.length;
  const centerIndex = centerAction ? Math.ceil(count / 2) : -1;
  /** Posición x de cada tab dentro de la barra, contando el hueco del botón central. */
  const slotX = (index: number) => index * TAB_W + (centerAction && index >= centerIndex ? FAB_SLOT : 0);

  const pillX = useSharedValue(slotX(state.index));
  useEffect(() => {
    pillX.value = withSpring(slotX(state.index), motion.springUi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, centerIndex]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }] }));

  const background = theme.canvas.val;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingBottom: Math.max(insets.bottom, BAR_INSET) }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(background, 0), withAlpha(background, 0.82), background]}
        locations={[0, 0.46, 0.78]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: FADE_HEIGHT }}
      />

      <View
        style={{
          marginBottom: BAR_BOTTOM_GAP,
          height: BAR_HEIGHT,
          padding: BAR_PADDING,
          flexDirection: "row",
          borderRadius: radius["2xl"],
          borderWidth: 1,
          borderColor: theme.glassLine.val,
          backgroundColor: reduceTransparency ? theme.surface.val : theme.glass.val,
          boxShadow: shadows[themeMode].float,
        }}
      >
        {!reduceTransparency ? (
          <View style={[StyleSheet.absoluteFill, { borderRadius: radius["2xl"], overflow: "hidden" }]} pointerEvents="none">
            <BlurView intensity={40} tint={themeName === "dark" ? "dark" : "light"} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
          </View>
        ) : null}

        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", left: BAR_PADDING, top: BAR_PADDING, width: TAB_W, height: TAB_H, borderRadius: radius.xl, backgroundColor: theme.brandWash.val },
            pillStyle,
          ]}
        />

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = typeof options.tabBarLabel === "string" ? options.tabBarLabel : (options.title ?? route.name);
          return (
            <View key={route.key} style={{ flexDirection: "row" }}>
              {centerAction && index === centerIndex ? <View style={{ width: FAB_SLOT }} /> : null}
              <TabButton
                label={label}
                focused={focused}
                icon={options.tabBarIcon?.({ color: focused ? theme.brand.val : theme.inkFaint.val, focused, size: 24 })}
                onPress={() => {
                  const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                  if (focused || event.defaultPrevented) return;
                  haptics.select();
                  navigation.navigate(route.name, route.params);
                }}
              />
            </View>
          );
        })}

        {centerAction ? (
          <View
            pointerEvents="box-none"
            style={{ position: "absolute", top: -FAB_LIFT, left: BAR_PADDING + centerIndex * TAB_W + (FAB_SLOT - FAB_SIZE - 6) / 2 }}
          >
            <PressableScale onPress={centerAction.onPress} haptic="tap" accessibilityRole="button" accessibilityLabel={centerAction.label} hitSlop={6}>
              <View
                style={{
                  width: FAB_SIZE + 6,
                  height: FAB_SIZE + 6,
                  borderRadius: radius.pill,
                  borderWidth: 3,
                  borderColor: background,
                  backgroundColor: theme.brand.val,
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: shadows[themeMode].float,
                }}
              >
                <Plus size={24} color={theme.onBrand.val as any} strokeWidth={2.4} />
              </View>
            </PressableScale>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function TabButton({ label, focused, icon, onPress }: { label: string; focused: boolean; icon: ReactNode; onPress: () => void }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (focused) scale.value = withSequence(withSpring(1.08, motion.springUi), withSpring(1, motion.springUi));
  }, [focused, scale]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      style={{ width: TAB_W, height: TAB_H, alignItems: "center", justifyContent: "center" }}
    >
      <Animated.View style={iconStyle}>{icon}</Animated.View>
    </Pressable>
  );
}
