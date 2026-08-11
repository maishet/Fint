import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { WebView } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { YStack } from "tamagui";
import { DataStateCard } from "../src/components/DataStateCard";
import { FintLoadingScreen } from "../src/ui";

const githubUrl = "https://github.com/maishet/Fint";

type ContentKey = "privacy" | "terms" | "github";

export default function WebContentScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ content?: string }>();
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const config = useMemo(() => contentConfig(params.content as ContentKey | undefined), [params.content]);

  if (!config.url) {
    return <YStack flex={1} bg="$background" p="$4" justify="center"><DataStateCard message={t("settings.legalUnavailable")} /></YStack>;
  }

  if (failed) {
    return <YStack flex={1} bg="$background" p="$4" justify="center"><DataStateCard message={t("webContent.loadError")} onRetry={() => { setFailed(false); setRetryKey((value) => value + 1); }} /></YStack>;
  }

  return (
    <YStack flex={1} bg="$background">
      <WebView
        key={retryKey}
        source={{ uri: config.url }}
        startInLoadingState
        renderLoading={() => (
          <FintLoadingScreen position="absolute" t={0} r={0} b={0} l={0} />
        )}
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
        onShouldStartLoadWithRequest={(request) => shouldOpenInside(request, config.allowedHosts)}
      />
    </YStack>
  );
}

function contentConfig(content: ContentKey | undefined) {
  if (content === "privacy") return { url: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL, allowedHosts: ["myfint.app"] };
  if (content === "terms") return { url: process.env.EXPO_PUBLIC_TERMS_URL, allowedHosts: ["myfint.app"] };
  if (content === "github") return { url: githubUrl, allowedHosts: ["github.com"] };
  return { url: undefined, allowedHosts: [] };
}

function shouldOpenInside(request: ShouldStartLoadRequest, allowedHosts: string[]) {
  try {
    const url = new URL(request.url);
    if (url.protocol !== "https:") return false;
    return allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}
