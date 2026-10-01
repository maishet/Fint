import { CircleAlert } from "@tamagui/lucide-icons-2";
import { useEffect } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import { XStack } from "tamagui";
import { fontFace } from "../theme/typography";
import { FText } from "./FText";

export interface ErrorLineProps {
  message: string;
  /** Margen superior respecto a lo que valida. 6 por defecto; 0 cuando el contenedor ya separa con `gap`. */
  mt?: number;
}

/**
 * El error de un campo o de un envío: icono y mensaje en `dangerHard`. Para el lector de pantalla el rol
 * `alert` no basta, porque Android no lo anuncia solo: el texto es una región viva asertiva (Android) y en iOS,
 * que no tiene regiones vivas, el mensaje se anuncia al aparecer o al cambiar.
 */
export function ErrorLine({ message, mt = 6 }: ErrorLineProps) {
  useEffect(() => {
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <XStack items="center" gap={5} mx={2} mt={mt} accessibilityRole="alert">
      <CircleAlert size={13} color="$dangerHard" strokeWidth={2.2} />
      <FText variant="caption" tone="dangerHard" accessibilityLiveRegion="assertive" style={{ flex: 1, fontFamily: fontFace.sans[600] }}>
        {message}
      </FText>
    </XStack>
  );
}
