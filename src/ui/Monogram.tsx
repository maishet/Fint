import { useState, type ReactNode } from "react";
import { Image } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Text, View, type ColorTokens } from "tamagui";
import { motion } from "../theme/tokens";
import { fontFace } from "../theme/typography";

export interface MonogramProps {
  /** Nombre del comercio, banco o categoría. Se usa su inicial. */
  name: string;
  /** Color de la inicial: `$chart1`..`$chart6` para la identidad de la categoría. */
  color?: ColorTokens;
  /** Logo del comercio o banco. Mientras carga, o si falla, se ve la inicial. */
  logoUrl?: string | null;
  /** Icono en lugar de la inicial (transferencias, categorías con icono). */
  icon?: ReactNode;
  size?: 32 | 38 | 52 | 64;
  /** Pequeña insignia abajo a la derecha (pendiente, automático). */
  badge?: ReactNode;
}

/**
 * Avatar de una fila: logo, inicial o icono sobre `surfaceSunken`. El logo que
 * termina de cargar aparece con un cruce de 180ms, nunca con un salto.
 */
export function Monogram({ name, color = "$inkMuted", logoUrl, icon, size = 38, badge }: MonogramProps) {
  const [failed, setFailed] = useState(false);
  const logoOpacity = useSharedValue(0);
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value }));
  const initial = name.trim().charAt(0).toUpperCase() || "·";

  return (
    <View width={size} height={size} rounded={999} bg="$surfaceSunken" items="center" justify="center">
      {icon ?? (
        <Text color={color} style={{ fontFamily: fontFace.display[600], fontSize: Math.round(size * 0.4) }}>
          {initial}
        </Text>
      )}
      {logoUrl && !failed ? (
        <Animated.View style={[{ position: "absolute", inset: 0, borderRadius: size / 2, overflow: "hidden" }, logoStyle]}>
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
