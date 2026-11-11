import { Repeat } from "@tamagui/lucide-icons-2";
import { SplashScreen } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useColorScheme, useWindowDimensions } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, Theme, YStack, type YStackProps } from "tamagui";
import { useThemeMode } from "../theme/ThemeMode";
import { motion, radius } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FintLogoLoader } from "./FintLogoLoader";
import { FText } from "./FText";
import { PressableScale } from "./PressableScale";

/** Menos que esto, no se muestra nada: la espera no se nota. */
const SHOW_AFTER_MS = 400;
/** Más que esto, aparece el aviso de conexión con "Reintentar". */
const SLOW_AFTER_MS = 8000;

export interface FintLoadingScreenProps extends YStackProps {
  /**
   * `slab`: pantalla completa sobre `launchBg` (arranque, login → Inicio): la losa amarilla en claro y casi negro
   * en oscuro, como la pantalla nativa. `canvas`: dentro de una pantalla.
   */
  surface?: "slab" | "canvas";
  /** La frase de la etapa real que se espera; cambia con `fade`. Por defecto, `states.loading`. */
  stage?: string;
  /** Llegaron los datos: el logo termina de armarse y sale; después se llama `onDone`. */
  ready?: boolean;
  onDone?: () => void;
  /** Con más de 8 s, "Reintentar" debajo de la frase. Sin esto, solo el aviso. */
  onRetry?: () => void;
  /**
   * Releva a la pantalla nativa de arranque (el logo D completo, 132 px, en el centro; en oscuro, dentro de su
   * cuadrado amarillo): se ve desde el primer cuadro con el logo completo en el mismo lugar y, ya dibujada, oculta
   * la pantalla nativa.
   */
  startComplete?: boolean;
  /**
   * Con `false`, al llegar los datos `onDone` se llama enseguida y el logo sigue animándose (no sale): la pantalla
   * que sigue lo tapa con su `fade` cuando ya está montada. Así no queda la losa vacía mientras monta.
   */
  exitOnReady?: boolean;
}

/**
 * La pantalla de carga (marca D, J-03 a J-06): el logo D se arma con
 * `FintLogoLoader` y debajo va la frase de la etapa. A pantalla completa va
 * sobre `launchBg` con "My Fint" al pie (en claro, monedas sobre la losa; en
 * oscuro, el cuadrado amarillo sobre casi negro); dentro de una pantalla, el
 * logo chico en su cuadrado, en el centro del área de contenido. Si la espera dura menos de 400 ms no se ve
 * nada y `onDone` se llama enseguida (salvo con `startComplete`: el logo ya estaba en la pantalla nativa). Para contenido cuya forma se conoce (listas,
 * tarjetas) van los esqueletos de `src/components/Skeleton.tsx`.
 */
export function FintLoadingScreen({
  surface = "canvas",
  stage,
  ready = false,
  onDone,
  onRetry,
  startComplete,
  exitOnReady = true,
  ...props
}: FintLoadingScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [shown, setShown] = useState(!!startComplete);
  const [slow, setSlow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);
  const onSlab = surface === "slab";
  const text = stage ?? t("states.loading");

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone?.();
  };

  useEffect(() => {
    const showTimer = setTimeout(() => setShown(true), SHOW_AFTER_MS);
    const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(slowTimer);
    };
  }, []);

  // Si los datos llegan antes de mostrar el logo, no hay nada que cerrar.
  useEffect(() => {
    if (ready && !shown) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, shown]);

  const captionStyle = useAnimatedStyle(() => ({ opacity: withTiming(leaving ? 0 : 1, motion.fade) }), [leaving]);
  const showSlow = slow && !ready;
  // La pantalla nativa de arranque sigue el tema del sistema (se dibuja antes que la app). La carga que la releva usa
  // el mismo, aunque Fint esté en otro: así el tono de la losa no salta entre las dos. Lo que sigue ya va en el de Fint.
  const systemScheme = useColorScheme();
  const nativeTheme = startComplete && onSlab && (systemScheme === "dark" || systemScheme === "light") ? systemScheme : null;

  const { themeMode } = useThemeMode();
  // `launchBg` es amarillo solo en claro: ahí los textos van en los tonos de la losa; en oscuro, en los del tema.
  const onYellow = onSlab && (nativeTheme ?? themeMode) === "light";

  const screen = (
    <YStack
      flex={1}
      bg={onSlab ? "$launchBg" : "$canvas"}
      items="center"
      justify="center"
      overflow="hidden"
      {...props}
    >
      {shown ? (
        <YStack items="center" width="100%" px={28}>
          {/* El logo y la frase se anuncian juntos como barra de progreso; "Reintentar" queda aparte. */}
          {/* El logo queda en el centro exacto (donde lo deja la pantalla nativa); la frase cuelga debajo. */}
          <YStack
            items="center"
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={text}
            onLayout={startComplete ? () => void SplashScreen.hideAsync() : undefined}
          >
            <FintLogoLoader
              size={onSlab ? 132 : 76}
              surface={surface}
              startComplete={startComplete}
              ready={ready}
              exitOnReady={exitOnReady}
              onLeave={() => setLeaving(true)}
              onDone={finish}
            />
            <Animated.View style={[{ position: "absolute", top: "100%", marginTop: onSlab ? 22 : 16, width: width - 56, alignItems: "center" }, captionStyle]}>
              <Animated.View key={text} entering={FadeIn.duration(motion.fade.duration)}>
                <FText variant="caption" tone={onYellow ? "slabMuted" : "inkMuted"} style={{ fontSize: 13, lineHeight: 20, textAlign: "center" }}>
                  {text}
                </FText>
              </Animated.View>
            </Animated.View>
          </YStack>
          {showSlow ? (
            // Debajo del grupo, sin empujarlo: el logo no se mueve cuando aparece el aviso.
            <Animated.View
              entering={FadeIn.duration(motion.fade.duration)}
              style={{ position: "absolute", top: "100%", left: 28, right: 28, alignItems: "center", marginTop: (onSlab ? 22 : 16) + 20 + 24 }}
            >
              <FText tone={onYellow ? "slabMuted" : "inkMuted"} style={{ fontSize: 13, lineHeight: 19, textAlign: "center" }}>
                {t("loadingScreen.slow")}
              </FText>
              {onRetry ? (
                <PressableScale onPress={onRetry} accessibilityRole="button" haptic="tap" style={{ marginTop: 12 }}>
                  <YStack
                    flexDirection="row"
                    items="center"
                    gap={8}
                    height={40}
                    px={18}
                    rounded={radius.pill}
                    bg="$ink"
                  >
                    {/* "Reintentar" en tinta: en oscuro, `ink` es el papel claro con el texto casi negro. */}
                    <Repeat size={15} color="$canvas" strokeWidth={2} />
                    <FText variant="body-strong" color="$canvas" style={{ fontSize: 14 }}>
                      {t("loadingScreen.retry")}
                    </FText>
                  </YStack>
                </PressableScale>
              ) : null}
            </Animated.View>
          ) : null}
        </YStack>
      ) : null}
      {onSlab ? (
        <YStack position="absolute" l={0} r={0} b={insets.bottom + 44} items="center" opacity={0.75} pointerEvents="none">
          <Text color={onYellow ? "$slabInk" : "$ink"} style={{ fontFamily: fontFace.display[600], fontSize: 16, letterSpacing: -0.6 }}>
            <Text color={onYellow ? "$slabMuted" : "$inkMuted"}>My </Text>
            Fint
          </Text>
        </YStack>
      ) : null}
    </YStack>
  );

  return nativeTheme ? <Theme name={nativeTheme}>{screen}</Theme> : screen;
}
