import { useRef, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";
import { WebView, type WebViewProps } from "react-native-webview";
import { useTheme, YStack } from "tamagui";
import { motion } from "../theme/tokens";
import { FintLoadingScreen } from "../ui";

/**
 * Un `WebView` con la pantalla de carga v3 encima (`surface="canvas"`) hasta
 * que la página termina de cargar: el logo se completa, sale, y el velo se
 * desvanece sobre la página ya lista. Lo usan Solicitar una mejora y las
 * páginas legales.
 */
export function LoadingWebView({ stage, onLoadEnd, style, ...props }: WebViewProps & { stage: string }) {
  const theme = useTheme();
  const webView = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
  const [veil, setVeil] = useState(true);

  return (
    <YStack flex={1}>
      <WebView
        ref={webView}
        {...props}
        style={[{ flex: 1, backgroundColor: theme.canvas.val }, style]}
        onLoadEnd={(event) => {
          setLoaded(true);
          onLoadEnd?.(event);
        }}
      />
      {veil ? (
        <Animated.View exiting={FadeOut.duration(motion.fade.duration)} style={StyleSheet.absoluteFill}>
          <FintLoadingScreen stage={stage} ready={loaded} onDone={() => setVeil(false)} onRetry={() => webView.current?.reload()} />
        </Animated.View>
      ) : null}
    </YStack>
  );
}
