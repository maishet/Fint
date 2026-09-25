import { ChevronLeft } from "@tamagui/lucide-icons-2";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { WebView } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DataStateCard } from "../src/components/DataStateCard";
import { useThemeMode } from "../src/theme/ThemeMode";
import { space } from "../src/theme/tokens";
import { FintLoadingScreen, FText, IconButton } from "../src/ui";

const featurebaseUrl = process.env.EXPO_PUBLIC_FEATUREBASE_URL ?? "https://fint.featurebase.app";

export default function ImprovementsScreen() {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const { themeMode } = useThemeMode();

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(themeMode === "dark" ? "light" : "dark");
      return () => setStatusBarStyle("light");
    }, [themeMode]),
  );

  if (failed) {
    return (
      <Frame>
        <YStack flex={1} p="$4" justify="center">
          <DataStateCard
            message={t("improvements.loadError")}
            onRetry={() => {
              setFailed(false);
              setRetryKey((value) => value + 1);
            }}
          />
        </YStack>
      </Frame>
    );
  }

  return (
    <Frame>
      <WebView
        key={retryKey}
        source={{ uri: featurebaseUrl }}
        startInLoadingState
        renderLoading={() => <FintLoadingScreen position="absolute" t={0} r={0} b={0} l={0} />}
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
        onShouldStartLoadWithRequest={shouldOpenInsideFeaturebase}
      />
    </Frame>
  );
}

function shouldOpenInsideFeaturebase(request: ShouldStartLoadRequest) {
  try {
    const url = new URL(request.url);
    if (url.protocol !== "https:") return false;
    return (
      url.hostname === "fint.featurebase.app" || url.hostname.endsWith(".featurebase.app") || url.hostname.endsWith(".featurebase-attachments.com")
    );
  } catch {
    return false;
  }
}

/** Volver y título sobre la página de Featurebase, como el resto de las pantallas de Ajustes. */
function Frame({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <XStack items="center" gap={space[3]} px={space[4]} pt={space[2]} pb={space[2]}>
        <IconButton label={t("settingsScreen.back")} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
        <FText variant="title" accessibilityRole="header" style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.5, flex: 1 }} numberOfLines={1}>
          {t("improvementsScreen.title")}
        </FText>
      </XStack>
      <YStack flex={1}>{children}</YStack>
    </YStack>
  );
}
