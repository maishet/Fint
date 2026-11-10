import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Plus } from "@tamagui/lucide-icons-2";
import { LinearGradient } from "expo-linear-gradient";
import { cloneElement, Fragment, isValidElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "tamagui";
import { withAlpha } from "../theme/color";
import { COMPACT_FONT_SCALE, motion } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { PressableScale } from "../ui/PressableScale";
import { setFabOrigin } from "../ui/fabOrigin";
import { haptics } from "../ui/haptics";

/** Medidas de la marca D: barra de 70 con radio 26, botón central de 58 con radio 20 y punto activo de 5. */
const BAR_HEIGHT = 70;
const BAR_RADIUS = 26;
const BAR_PADDING = 6;
const FAB_SIZE = 58;
const FAB_RADIUS = 20;
const BAR_BOTTOM_GAP = 10;
const BAR_INSET = 16;
const FADE_HEIGHT = 150;
const DOT = 5;
const LABEL_COLOR_ON = "#FFFFFF";
const BAR_SHADOW = "0 14px 30px -14px rgba(20,20,18,0.6)";

/** Alto que ocupa la barra flotante; úsalo para el padding inferior de las listas. */
export function floatingTabBarHeight(bottomInset: number) {
  return BAR_HEIGHT + Math.max(bottomInset, BAR_INSET) + BAR_BOTTOM_GAP;
}

export interface FintTabBarProps extends BottomTabBarProps {
  /**
   * El botón central de registro: el cuadrado amarillo de 58 en su propio hueco, entre los tabs 2 y 3. Siempre es
   * el mismo más y siempre abre la misma hoja, en cualquier tab.
   */
  centerAction?: { label: string; onPress: () => void };
}

/**
 * Barra de tabs flotante, tinta en los dos temas. El tab activo lleva el ícono amarillo con trazo 2.3 y la etiqueta
 * en blanco, y un punto amarillo que se desliza a la nueva pestaña con `springUi` (con movimiento reducido aparece
 * sin moverse). Desde `COMPACT_FONT_SCALE` la barra deja las etiquetas y agranda los íconos; cada tab conserva su
 * nombre para el lector de pantalla.
 */

export function FintTabBar({ state, descriptors, navigation, centerAction }: FintTabBarProps) {
  const fabRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const showLabels = fontScale < COMPACT_FONT_SCALE;
  const [barWidth, setBarWidth] = useState(0);

  const count = state.routes.length;
  const centerIndex = centerAction ? Math.ceil(count / 2) : -1;
  const slots = count + (centerAction ? 1 : 0);
  const slotW = barWidth > 0 ? (barWidth - BAR_PADDING * 2) / slots : 0;
  /** Hueco de cada tab dentro de la barra, contando el del botón central. */
  const slotOf = (index: number) => index + (centerAction && index >= centerIndex ? 1 : 0);
  const dotX = (index: number) => BAR_PADDING + slotOf(index) * slotW + slotW / 2 - DOT / 2;

  const x = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (slotW <= 0) return;
    const target = dotX(state.index);
    if (!placed.current || reduceMotion) {
      x.value = target;
      placed.current = true;
    } else {
      x.value = withSpring(target, motion.springUi);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, slotW, reduceMotion]);
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const background = theme.canvas.val;
  const active = theme.tabActive.val;
  const inactive = theme.tabInactive.val;

  const centerButton = centerAction ? (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <PressableScale onPress={centerAction.onPress} haptic="tap" accessibilityRole="button" accessibilityLabel={centerAction.label}>
        <View
          ref={fabRef}
          // El formulario de movimiento crece desde aquí: se guarda su centro en la pantalla. `measure` y no
          // `measureInWindow`, que en Android descuenta la barra de estado.
          onLayout={() =>
            fabRef.current?.measure((_x, _y, w, h, pageX, pageY) => setFabOrigin({ x: pageX + w / 2, y: pageY + h / 2, size: w }))
          }
          style={{
            width: FAB_SIZE,
            height: FAB_SIZE,
            borderRadius: FAB_RADIUS,
            backgroundColor: theme.brand.val,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Plus size={28} color={theme.onBrand.val as never} strokeWidth={2.6} />
        </View>
      </PressableScale>
    </View>
  ) : null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: BAR_INSET, paddingBottom: Math.max(insets.bottom, BAR_INSET) }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(background, 0), withAlpha(background, 0.82), background]}
        locations={[0, 0.46, 0.78]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: FADE_HEIGHT }}
      />

      <View
        accessibilityRole="tablist"
        onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)}
        style={{
          marginBottom: BAR_BOTTOM_GAP,
          height: BAR_HEIGHT,
          paddingHorizontal: BAR_PADDING,
          flexDirection: "row",
          alignItems: "center",
          borderRadius: BAR_RADIUS,
          backgroundColor: theme.tabFloatingBackground.val,
          boxShadow: BAR_SHADOW,
        }}
      >
        {slotW > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              { position: "absolute", left: 0, bottom: showLabels ? 6 : 12, width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: active },
              dotStyle,
            ]}
          />
        ) : null}

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = typeof options.tabBarLabel === "string" ? options.tabBarLabel : (options.title ?? route.name);
          const rawIcon = options.tabBarIcon?.({ color: focused ? active : inactive, focused, size: showLabels ? 22 : 26 });
          const icon = isValidElement(rawIcon)
            ? cloneElement(rawIcon as ReactElement<{ strokeWidth?: number }>, { strokeWidth: focused ? 2.3 : 1.9 })
            : rawIcon;
          return (
            <Fragment key={route.key}>
              {/* El botón central va en su hueco del árbol, entre los tabs 2 y 3: el lector lo recorre en el orden en que se ve. */}
              {centerAction && index === centerIndex ? centerButton : null}
              <TabButton
                label={label}
                focused={focused}
                showLabel={showLabels}
                icon={icon}
                labelColor={focused ? LABEL_COLOR_ON : inactive}
                onPress={() => {
                  const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                  if (focused || event.defaultPrevented) return;
                  haptics.select();
                  navigation.navigate(route.name, route.params);
                }}
              />
            </Fragment>
          );
        })}
      </View>
    </View>
  );
}

function TabButton({
  label,
  focused,
  showLabel,
  icon,
  labelColor,
  onPress,
}: {
  label: string;
  focused: boolean;
  showLabel: boolean;
  icon: ReactNode;
  labelColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      style={{ flex: 1, height: BAR_HEIGHT, alignItems: "center", justifyContent: "center", gap: 4 }}
    >
      {icon}
      {showLabel ? (
        // La etiqueta es visual: el nombre ya va en `accessibilityLabel` del tab, así no se lee dos veces.
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={COMPACT_FONT_SCALE}
          importantForAccessibility="no"
          accessibilityElementsHidden
          style={{ fontSize: 10, lineHeight: 13, color: labelColor, fontFamily: focused ? fontFace.sans[600] : fontFace.sans[500] }}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}
