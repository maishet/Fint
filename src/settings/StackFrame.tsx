import { ChevronLeft } from "@tamagui/lucide-icons-2";
import { useRouter } from "expo-router";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XStack, YStack } from "tamagui";
import { COMPACT_FONT_SCALE, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { useScreenStatusBar } from "../theme/useScreenStatusBar";
import { FText, IconButton } from "../ui";

/**
 * Marco de una pantalla apilada (Importar, Mejoras, Política de privacidad, Términos): volver y el título de pantalla
 * secundaria de la marca D (26 en Figtree Bold, tope 1.3, hasta dos líneas) sobre `canvas`, como Ajustes, y la barra
 * de estado según el tema.
 */
export function StackFrame({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useScreenStatusBar();
  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <XStack items="center" gap={10} px={space[5]} pt={space[2]} pb={space[1]}>
        <IconButton label={t("settingsScreen.back")} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
        <FText
          accessibilityRole="header"
          maxFontSizeMultiplier={COMPACT_FONT_SCALE}
          numberOfLines={2}
          style={{ fontFamily: fontFace.display[700], fontSize: 26, lineHeight: 31, letterSpacing: -0.6, flex: 1 }}
        >
          {title}
        </FText>
      </XStack>
      <YStack flex={1}>{children}</YStack>
    </YStack>
  );
}
