import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Paragraph, useTheme, useThemeName, XStack, YStack } from "tamagui";
import { haptics } from "../ui/haptics";
const BAR_HEIGHT = 62;
const BAR_INSET = 16;
const BAR_PADDING = 6;
const BAR_RADIUS = 26;
const PILL_RADIUS = 20;
const FADE_HEIGHT = 150;
const BAR_BOTTOM_GAP = 10;

const PILL_SPRING = { damping: 20, stiffness: 220, mass: 0.9 };

export function floatingTabBarHeight(bottomInset: number) {
  return BAR_HEIGHT + Math.max(bottomInset, BAR_INSET) + BAR_BOTTOM_GAP;
}

function withAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return hex;
  const int = Number.parseInt(value, 16);
  return `rgba(${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},${alpha})`;
}

export function FintTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const themeName = useThemeName();
  const [barWidth, setBarWidth] = useState(0);
  const pillX = useSharedValue(0);

  const count = state.routes.length;
  const slotWidth = barWidth > 0 ? (barWidth - BAR_PADDING * 2) / count : 0;

  useEffect(() => {
    if (slotWidth <= 0) return;
    pillX.value = withSpring(state.index * slotWidth, PILL_SPRING);
  }, [pillX, slotWidth, state.index]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: slotWidth,
  }));

  const background = theme.background.val;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: Math.max(insets.bottom, BAR_INSET),
      }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[
          withAlpha(background, 0),
          withAlpha(background, 0.82),
          background,
        ]}
        locations={[0, 0.46, 0.78]}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: FADE_HEIGHT,
        }}
      />

      <XStack
        mx={BAR_INSET}
        mb={BAR_BOTTOM_GAP}
        height={BAR_HEIGHT}
        p={BAR_PADDING}
        rounded={BAR_RADIUS}
        bg="$tabFloatingBackground"
        borderColor="$tabFloatingBorder"
        borderWidth={1}
        shadowColor="#043036"
        shadowOffset={{ width: 0, height: 10 }}
        shadowOpacity={0.16}
        shadowRadius={34}
        elevation={8}
        overflow="hidden"
        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      >
        <BlurView
          intensity={26}
          tint={themeName === "dark" ? "dark" : "light"}
          experimentalBlurMethod="dimezisBlurView"
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: BAR_PADDING,
              top: BAR_PADDING,
              height: BAR_HEIGHT - BAR_PADDING * 2 - 2,
              borderRadius: PILL_RADIUS,
              backgroundColor: theme.tabPill.val,
            },
            pillStyle,
          ]}
        />

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const color = isFocused ? theme.tabActive.val : theme.tabInactive.val;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : (options.title ?? route.name);

          return (
            <YStack
              key={route.key}
              flex={1}
              items="center"
              justify="center"
              gap={3}
              role="button"
              aria-label={label}
              aria-selected={isFocused}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (isFocused || event.defaultPrevented) return;
                haptics.select();
                navigation.navigate(route.name, route.params);
              }}
            >
              {options.tabBarIcon?.({ color, focused: isFocused, size: 21 })}
              <Paragraph
                color={color}
                fontSize={9.5}
                fontWeight={isFocused ? "600" : "500"}
                letterSpacing={0.1}
                numberOfLines={1}
              >
                {label}
              </Paragraph>
            </YStack>
          );
        })}
      </XStack>
    </View>
  );
}
