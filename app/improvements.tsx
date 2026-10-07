import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking } from "react-native";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { YStack } from "tamagui";
import { DataStateCard } from "../src/components/DataStateCard";
import { LoadingWebView } from "../src/settings/LoadingWebView";
import { StackFrame } from "../src/settings/StackFrame";
import { httpsHostname, isAllowedInsideWebView, shouldOpenOutside } from "../src/settings/webViewHosts";

const featurebaseUrl = process.env.EXPO_PUBLIC_FEATUREBASE_URL ?? "https://my-fint.featurebase.app";
const featurebaseHost = httpsHostname(featurebaseUrl);

export default function ImprovementsScreen() {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  return (
    <StackFrame title={t("improvementsScreen.title")}>
      {failed ? (
        <YStack flex={1} p="$4" justify="center">
          <DataStateCard
            message={t("improvements.loadError")}
            onRetry={() => {
              setFailed(false);
              setRetryKey((value) => value + 1);
            }}
          />
        </YStack>
      ) : (
        <LoadingWebView
          key={retryKey}
          stage={t("loadingScreen.improvements")}
          source={{ uri: featurebaseUrl }}
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
          onShouldStartLoadWithRequest={shouldOpenInsideFeaturebase}
        />
      )}
    </StackFrame>
  );
}

function shouldOpenInsideFeaturebase(request: ShouldStartLoadRequest) {
  if (featurebaseHost && isAllowedInsideWebView(request.url, { hosts: [featurebaseHost] })) return true;
  if (shouldOpenOutside(request.url, request.isTopFrame)) void Linking.openURL(request.url).catch(() => undefined);
  return false;
}
