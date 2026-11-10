import { useState, type ReactNode } from "react";
import { Image } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Text, View, type ColorTokens } from "tamagui";
import { categoryTint } from "../finance/categoryTint";
import { useCategoryHue } from "../finance/emojiHue";
import { useThemeMode } from "../theme/ThemeMode";
import { motion } from "../theme/tokens";
import { fontFace } from "../theme/typography";

export interface MonogramProps {
  name: string;
  color?: ColorTokens;
  logoUrl?: string | null;
  icon?: ReactNode;
  emoji?: string | null;
  size?: 32 | 38 | 44 | 52 | 64;
  badge?: ReactNode;
}

export const MONOGRAM_RADIUS = 0.32;
const EMOJI_SCALE = 0.52;

export function Monogram({ name, logoUrl, icon, emoji, size = 38, badge }: MonogramProps) {
  const [failed, setFailed] = useState(false);
  const { themeMode } = useThemeMode();
  const showEmoji = !icon && Boolean(emoji?.trim());
  const hue = useCategoryHue(showEmoji ? emoji : null, name);
  const logoOpacity = useSharedValue(0);
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value }));
  const initial = name.trim().charAt(0).toUpperCase() || "·";
  const radius = Math.round(size * MONOGRAM_RADIUS);

  return (
    <View
      width={size}
      height={size}
      rounded={radius}
      bg={showEmoji ? undefined : "$surface"}
      style={showEmoji ? { backgroundColor: categoryTint(hue, themeMode) } : undefined}
      items="center"
      justify="center"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {icon ??
        (showEmoji ? (
          <Text
            allowFontScaling={false}
            style={{
              fontSize: Math.round(size * EMOJI_SCALE),
              lineHeight: Math.round(size * EMOJI_SCALE * 1.25),
              includeFontPadding: false,
              textAlign: "center",
            }}
          >
            {emoji}
          </Text>
        ) : (
          <Text
            allowFontScaling={false}
            color="$ink"
            style={{ fontFamily: fontFace.display[700], fontSize: Math.round(size * 0.45), includeFontPadding: false }}
          >
            {initial}
          </Text>
        ))}
      {logoUrl && !failed ? (
        <Animated.View style={[{ position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden" }, logoStyle]}>
          <Image
            source={{ uri: logoUrl }}
            style={{ width: size, height: size }}
            onLoad={() => {
              logoOpacity.value = withTiming(1, motion.fade);
            }}
            onError={() => setFailed(true)}
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
      ) : null}
      {badge ? (
        <View position="absolute" r={-2} b={-2}>
          {badge}
        </View>
      ) : null}
    </View>
  );
}
