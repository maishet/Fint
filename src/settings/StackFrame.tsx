import { ChevronLeft } from "@tamagui/lucide-icons-2";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XStack, YStack } from "tamagui";
import { useThemeMode } from "../theme/ThemeMode";
import { space } from "../theme/tokens";
import { FText, IconButton } from "../ui";

/**
 * Marco de una pantalla apilada de Ajustes que muestra una página web (Mejoras,
 * Política de privacidad, Términos): volver y el título a 24px sobre `canvas`,
 * como Ajustes, y la barra de estado según el tema.
 */
export function StackFrame({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { themeMode } = useThemeMode();
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(themeMode === "dark" ? "light" : "dark");
      return () => setStatusBarStyle("light");
    }, [themeMode]),
  );
  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <XStack items="center" gap={space[3]} px={space[4]} pt={space[2]} pb={space[2]}>
        <IconButton label={t("settingsScreen.back")} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
        <FText variant="title" accessibilityRole="header" style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.5, flex: 1 }} numberOfLines={1}>
          {title}
        </FText>
      </XStack>
      <YStack flex={1}>{children}</YStack>
    </YStack>
  );
}
