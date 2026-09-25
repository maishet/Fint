import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { YStack } from "tamagui";
import { DataStateCard } from "../src/components/DataStateCard";
import { LoadingWebView } from "../src/settings/LoadingWebView";
import { StackFrame } from "../src/settings/StackFrame";

const githubUrl = "https://github.com/maishet/Fint";

type ContentKey = "privacy" | "terms" | "github";

export default function WebContentScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ content?: string }>();
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const config = useMemo(() => contentConfig(params.content as ContentKey | undefined), [params.content]);
  // El título según la página: el mismo texto de su fila en Ajustes.
  const title =
    params.content === "privacy"
      ? t("settings.privacy")
      : params.content === "terms"
        ? t("settings.terms")
        : params.content === "github"
          ? "GitHub"
          : t("webContent.title");

  if (!config.url) {
    return (
      <StackFrame title={title}>
        <YStack flex={1} p="$4" justify="center">
          <DataStateCard message={t("settings.legalUnavailable")} />
        </YStack>
      </StackFrame>
    );
  }

  if (failed) {
    return (
      <StackFrame title={title}>
        <YStack flex={1} p="$4" justify="center">
          <DataStateCard
            message={t("webContent.loadError")}
            onRetry={() => {
              setFailed(false);
              setRetryKey((value) => value + 1);
            }}
          />
        </YStack>
      </StackFrame>
    );
  }

  return (
    <StackFrame title={title}>
      <LoadingWebView
        key={retryKey}
        stage={t("loadingScreen.page")}
        source={{ uri: config.url }}
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
        onShouldStartLoadWithRequest={(request) => shouldOpenInside(request, config.allowedHosts)}
      />
    </StackFrame>
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
