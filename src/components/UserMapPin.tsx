import { Image } from "react-native";
import { Text, View } from "tamagui";
import { useUserAvatar } from "../auth/useUserAvatar";
import { useThemeMode } from "../theme/ThemeMode";
import { shadows } from "../theme/tokens";
import { fontFace } from "../theme/typography";

/** Cuánto baja la punta por debajo del círculo: la punta es el punto exacto del mapa. */
export const USER_PIN_TIP = 5;

/**
 * El pin de los mapas con la cara de la persona, como el avatar del Inicio: su
 * foto (o sus iniciales sobre la losa) en un círculo con aro `surface` y una
 * punta que marca el lugar. Mide `size` de ancho y `size + USER_PIN_TIP` de
 * alto; quien lo usa lo ubica para que la punta caiga en el centro del mapa.
 */
export function UserMapPin({ size = 40 }: { size?: number }) {
  const { avatarUrl, initials } = useUserAvatar();
  const { themeMode } = useThemeMode();
  const inner = size - 6;
  return (
    <View width={size} height={size + USER_PIN_TIP} items="center" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* La punta: un cuadrado girado debajo del círculo, del mismo color que el aro. */}
      <View position="absolute" t={size - 10} width={12} height={12} rounded={2} bg="$surface" style={{ transform: [{ rotate: "45deg" }] }} />
      <View
        width={size}
        height={size}
        rounded={999}
        bg="$surface"
        items="center"
        justify="center"
        style={{ boxShadow: shadows[themeMode].float }}
      >
        <View width={inner} height={inner} rounded={999} overflow="hidden" bg="$slab" items="center" justify="center">
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: inner, height: inner }} accessibilityIgnoresInvertColors />
          ) : (
            <Text color="$slabInk" style={{ fontFamily: fontFace.display[600], fontSize: Math.round(inner * 0.38) }}>
              {initials}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
