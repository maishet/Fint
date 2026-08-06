import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { YStack } from "tamagui";
import { DataStateCard } from "../src/components/DataStateCard";

const featurebaseUrl = process.env.EXPO_PUBLIC_FEATUREBASE_URL ?? "https://fint.featurebase.app";

export default function ImprovementsScreen() {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  if (failed) {
    return (
      <YStack flex={1} bg="$background" p="$4" justify="center">
        <DataStateCard
          message={t("improvements.loadError")}
          onRetry={() => {
            setFailed(false);
            setRetryKey((value) => value + 1);
          }}
        />
      </YStack>
    );
  }

  return (
    <YStack flex={1} bg="$background">
      <WebView
        key={retryKey}
        source={{ uri: featurebaseUrl }}
        startInLoadingState
        renderLoading={() => (
          <YStack flex={1} items="center" justify="center">
            <ActivityIndicator />
          </YStack>
        )}
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
        onShouldStartLoadWithRequest={shouldOpenInsideFeaturebase}
      />
    </YStack>
  );
}

function shouldOpenInsideFeaturebase(request: ShouldStartLoadRequest) {
  try {
    const url = new URL(request.url);
    if (url.protocol !== "https:") return false;
    return url.hostname === "fint.featurebase.app" || url.hostname.endsWith(".featurebase.app") || url.hostname.endsWith(".featurebase-attachments.com");
  } catch {
    return false;
  }
}
