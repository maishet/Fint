import { Repeat } from "@tamagui/lucide-icons-2";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, YStack, type YStackProps } from "tamagui";
import { HeroMesh } from "../home/HeroMesh";
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
  /** `slab`: pantalla completa sobre la losa (arranque, login → Inicio). `canvas`: dentro de una pantalla. */
  surface?: "slab" | "canvas";
  /** La frase de la etapa real que se espera; cambia con `fade`. Por defecto, `states.loading`. */
  stage?: string;
  /** Llegaron los datos: el logo termina de armarse y sale; después se llama `onDone`. */
  ready?: boolean;
  onDone?: () => void;
  /** Con más de 8 s, "Reintentar" debajo de la frase. Sin esto, solo el aviso. */
  onRetry?: () => void;
  /** Arranca desde el logo completo (al relevar a la pantalla nativa de arranque). */
  startComplete?: boolean;
}

/**
 * La pantalla de carga v3 (`PantallaCarga` del design system): el logo se arma
 * con `FintLogoLoader` y debajo va la frase de la etapa. Sobre la losa lleva la
 * malla del hero y "My Fint" al pie; dentro de una pantalla, el logo chico en
 * el centro del área de contenido. Si la espera dura menos de 400 ms no se ve
 * nada y `onDone` se llama enseguida. Para contenido cuya forma se conoce (listas,
 * tarjetas) van los esqueletos de `src/components/Skeleton.tsx`.
 */
export function FintLoadingScreen({
  surface = "canvas",
  stage,
  ready = false,
  onDone,
  onRetry,
  startComplete,
  ...props
}: FintLoadingScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [shown, setShown] = useState(false);
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

  return (
    <YStack
      flex={1}
      bg={onSlab ? "$slab" : "$canvas"}
      items="center"
      justify="center"
      overflow="hidden"
      {...props}
    >
      {onSlab ? <HeroMesh width={width} height={height} /> : null}
      {shown ? (
        <YStack items="center" width="100%" px={28}>
          {/* El logo y la frase se anuncian juntos como barra de progreso; "Reintentar" queda aparte. */}
          <YStack items="center" gap={onSlab ? 22 : 16} accessible accessibilityRole="progressbar" accessibilityLabel={text}>
            <FintLogoLoader
              size={onSlab ? 132 : 76}
              surface={surface}
              startComplete={startComplete}
              ready={ready}
              onLeave={() => setLeaving(true)}
              onDone={finish}
            />
            <Animated.View style={captionStyle}>
              <Animated.View key={text} entering={FadeIn.duration(motion.fade.duration)}>
                <FText variant="caption" tone={onSlab ? "slabMuted" : "inkMuted"} style={{ fontSize: 13, lineHeight: 20, textAlign: "center" }}>
                  {text}
                </FText>
              </Animated.View>
            </Animated.View>
          </YStack>
          {showSlow ? (
            // Debajo del grupo, sin empujarlo: el logo no se mueve cuando aparece el aviso.
            <Animated.View
              entering={FadeIn.duration(motion.fade.duration)}
              style={{ position: "absolute", top: "100%", left: 28, right: 28, alignItems: "center", marginTop: 24 }}
            >
              <FText tone={onSlab ? "slabMuted" : "inkMuted"} style={{ fontSize: 13, lineHeight: 19, textAlign: "center" }}>
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
                    bg={onSlab ? "$glassSlab" : "transparent"}
                    borderWidth={1}
                    borderColor={onSlab ? "$glassSlabLine" : "$lineStrong"}
                  >
                    <Repeat size={15} color={onSlab ? "$slabInk" : "$ink"} strokeWidth={2} />
                    <FText variant="body-strong" tone={onSlab ? "slabInk" : "ink"} style={{ fontSize: 14 }}>
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
          <Text color="$slabInk" style={{ fontFamily: fontFace.display[600], fontSize: 16, letterSpacing: -0.6 }}>
            <Text color="$slabMuted">My </Text>
            Fint
          </Text>
        </YStack>
      ) : null}
    </YStack>
  );
}
