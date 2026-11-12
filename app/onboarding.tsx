import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, Eye, EyeOff } from "@tamagui/lucide-icons-2";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Pressable, ScrollView, useWindowDimensions } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaFrame, useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, useTheme, View, XStack, YStack } from "tamagui";
import { financeApi } from "../src/api/finance";
import { getAccountRowIcon } from "../src/finance/accountTypes";
import { amountParts, formatAmount, THIN_SPACE } from "../src/finance/formatAmount";
import { getAppLocale, getCurrentAppLanguage } from "../src/i18n";
import { shortDay } from "../src/movement-form/DateSheet";
import { requestAndRegisterPushInstallation, type PushPermissionState } from "../src/notifications/pushNotifications";
import { DemoRound, Enter, useAfter, useDemoCycle, useTween } from "../src/onboarding/demoMotion";
import { ONBOARDING_SLIDES, primaryAction, slideAt, type OnboardingSlide } from "../src/onboarding/steps";
import { useThemeMode } from "../src/theme/ThemeMode";
import { COMPACT_FONT_SCALE, shadows, space } from "../src/theme/tokens";
import { fontFace, textStyles } from "../src/theme/typography";
import { FintButton, FintSpinner, FText, IconButton, Monogram, notify, PressableScale } from "../src/ui";
import { BrandSymbol } from "../src/ui/BrandSymbol";
import { MONOGRAM_RADIUS } from "../src/ui/Monogram";

/** Las cifras de las ilustraciones son de ejemplo y siempre en soles, como en el diseño. */
const SAMPLE_CURRENCY = "PEN";
/** Alto del pie (puntos, botón CTA de 56 y margen), sin el inset inferior; la última pantalla suma "Ahora no". */
const FOOTER_HEIGHT = 8 + 18 + 56 + 20;
const NOT_NOW_HEIGHT = 6 + 56;
/** Alto de la ilustración desde `COMPACT_FONT_SCALE`, cuando la pantalla se desplaza. */
const COMPACT_ART_HEIGHT = 230;
/**
 * Las dos piezas de la bienvenida van sobre la losa amarilla en los dos temas, así que sus colores no siguen al
 * tema: la boleta del patrimonio en papel blanco y el aviso de vencimiento en tinta.
 */
const WELCOME_PAPER = "#FFFFFF";
/** Los tonos de tinta sobre ese papel (los de `ink`, `inkMuted` e `inkFaint` del tema claro) y el verde del cambio sobre tinta. */
const PAPER_INK = "#141412";
const PAPER_MUTED = "#55534C";
const PAPER_FAINT = "#6B6960";
const PAPER_GAIN = "#3DD68C";
/** La pantalla bloqueada de la ilustración de recordatorios: oscura en los dos temas, como un teléfono de verdad. */
const LOCK_GRADIENT = ["#2A2A24", "#141412"] as const;
const LOCK_CLOCK = "#F4F3EE";
const LOCK_DATE = "#B4B1A7";
const LOCK_BODY = "#3A3934";
/** La ilustración se mueve a 1.2 veces la velocidad del texto: da profundidad sin animar nada más. */
const PARALLAX = 0.2;

type PushState = PushPermissionState | "error" | "skipped" | null;

/**
 * El recorrido de primera vez (marca D): Bienvenida sobre la losa amarilla
 * (igual en los dos temas) y Cuentas, Pagos, Privacidad y Notificaciones sobre
 * `canvas`, cada una con una ilustración hecha con piezas reales de la
 * interfaz en un panel `surface` de radio 28. Las pantallas siguen al dedo y el
 * pie (puntos y botón) pasa del tinta de la losa al amarillo del CTA con el
 * mismo desplazamiento. Desde `COMPACT_FONT_SCALE` cada pantalla se desplaza
 * en vertical y la ilustración tiene alto fijo, para no cortar el texto ni el
 * CTA.
 */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width, height } = useSafeAreaFrame();
  const { themeMode } = useThemeMode();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const [pushState, setPushState] = useState<PushState>(null);
  const [isRequestingPush, setIsRequestingPush] = useState(false);
  const last = ONBOARDING_SLIDES.length - 1;
  const action = primaryAction(index, pushState !== null);

  const completeMutation = useMutation({
    mutationFn: async () => {
      await financeApi.initializeMe(getCurrentAppLanguage());
      return financeApi.completeOnboarding();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.replace("/(tabs)/dashboard");
    },
    onError: () => notify.error(t("onboarding.completeError")),
  });

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });
  useAnimatedReaction(
    () => slideAt(scrollX.value, width),
    (current, previous) => {
      if (current !== previous) runOnJS(setIndex)(current);
    },
    [width],
  );

  const goTo = useCallback((next: number) => scrollRef.current?.scrollTo({ x: next * width, animated: true }), [scrollRef, width]);

  // La bienvenida va sobre la losa amarilla (iconos oscuros); las demás siguen el tema.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(index !== 0 && themeMode === "dark" ? "light" : "dark");
    }, [index, themeMode]),
  );
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (index === 0) return false;
        goTo(index - 1);
        return true;
      });
      return () => sub.remove();
    }, [goTo, index]),
  );

  const requestNotifications = async () => {
    setIsRequestingPush(true);
    try {
      setPushState(await requestAndRegisterPushInstallation());
    } catch {
      setPushState("error");
    } finally {
      setIsRequestingPush(false);
    }
  };

  const onPrimary = () => {
    if (action === "finish") completeMutation.mutate();
    else if (action === "enableNotifications") void requestNotifications();
    else goTo(index + 1);
  };

  const finishing = completeMutation.isPending || completeMutation.isSuccess;
  const primaryLabel = finishing
    ? t("onboarding.finishing")
    : action === "start"
      ? t("onboarding.start")
      : action === "next"
        ? t("onboarding.next")
        : action === "enableNotifications"
          ? isRequestingPush
            ? t("onboarding.notifications.requesting")
            : t("onboarding.notifications.enable")
          : t("onboarding.finish");
  const busy = finishing || isRequestingPush;

  const skip = () => {
    if (!finishing) completeMutation.mutate();
  };
  const footerSpace = (slide: number) => FOOTER_HEIGHT + (slide === last ? NOT_NOW_HEIGHT : 0) + Math.max(insets.bottom, space[4]);

  const topBar = (slide: number) => (
    <XStack items="center" justify="space-between" px={space[5]} pt={10} minH={50}>
      {slide === 0 ? (
        <View />
      ) : (
        <IconButton label={t("onboardingScreen.back")} onPress={() => goTo(slide - 1)} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} />
      )}
      {slide === last ? null : (
        <Pressable onPress={skip} disabled={finishing} hitSlop={12} accessibilityRole="button">
          <FText variant="label" tone={slide === 0 ? "slabInk" : "ink"} style={{ fontSize: 15, fontFamily: fontFace.display[700] }}>
            {t("onboarding.skip")}
          </FText>
        </Pressable>
      )}
    </XStack>
  );

  return (
    <View flex={1} bg="$background">
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {ONBOARDING_SLIDES.map((slide, i) => (
          <SlideFrame
            key={slide}
            slide={slide}
            index={i}
            active={i === index}
            width={width}
            height={height}
            topInset={insets.top}
            bottomSpace={footerSpace(i)}
            scrollX={scrollX}
            topBar={topBar(i)}
          />
        ))}
      </Animated.ScrollView>

      <YStack position="absolute" l={0} r={0} b={0} px={space[5]} pb={Math.max(insets.bottom, space[4]) + 20} gap={18} pointerEvents="box-none">
        <PageDots scrollX={scrollX} width={width} />
        <YStack gap={6}>
          <PrimaryButton scrollX={scrollX} width={width} label={primaryLabel} busy={busy} onSlab={index === 0} icon={null} onPress={onPrimary} />
          {index === last ? (
            pushState === null ? (
              <FintButton variant="ghost" pending={busy} onPress={() => setPushState("skipped")}>
                {t("onboardingScreen.notNow")}
              </FintButton>
            ) : (
              // Después de responder, la línea de estado en una tarjeta `surface` con el punto: `flowIn` si quedaron
              // activadas; si no, `inkFaint` (no es un error, pero tampoco algo logrado).
              <XStack minH={56} items="center" gap={10} px={14} py={10} rounded={16} bg="$surface">
                <View width={8} height={8} rounded={999} bg={pushState === "granted" ? "$flowIn" : "$inkFaint"} />
                <FText tone="inkMuted" style={{ flex: 1, fontSize: 13, lineHeight: 18 }} numberOfLines={3}>
                  {pushState === "skipped" ? t("onboardingScreen.notifications.later") : t(`onboarding.notifications.${pushStateKey(pushState)}`)}
                </FText>
              </XStack>
            )
          ) : null}
        </YStack>
      </YStack>
    </View>
  );
}

function pushStateKey(state: Exclude<PushState, null | "skipped">) {
  return state === "granted" ? "enabled" : state;
}

/**
 * Una pantalla: barra de arriba, ilustración (con paralaje) y texto. La
 * bienvenida va sobre la losa con dos piezas inclinadas (la boleta en papel y
 * el aviso en tinta); las demás, sobre `canvas` con la ilustración en un panel
 * `surface` de radio 28, el título a 32 y las viñetas con check tinta.
 */
function SlideFrame({
  slide,
  index,
  active,
  width,
  height,
  topInset,
  bottomSpace,
  scrollX,
  topBar,
}: {
  slide: OnboardingSlide;
  index: number;
  /** La pantalla a la vista: solo ella corre su demostración. */
  active: boolean;
  width: number;
  height: number;
  topInset: number;
  bottomSpace: number;
  scrollX: SharedValue<number>;
  topBar: ReactNode;
}) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const compact = fontScale >= COMPACT_FONT_SCALE;
  const onSlab = slide === "welcome";
  const parallax = useAnimatedStyle(() => ({
    transform: [{ translateX: -(scrollX.value - index * width) * PARALLAX }],
  }));
  const bullets =
    onSlab || slide === "notifications"
      ? []
      : (t(`onboardingScreen.${slide}.bullets`, {
          returnObjects: true,
        }) as string[]);
  // Hasta 1.3 la ilustración ocupa lo que sobra; desde 1.3 tiene alto fijo y la pantalla se desplaza.
  const artStyle = compact ? { height: COMPACT_ART_HEIGHT, marginTop: 8 } : { flex: 1, maxHeight: onSlab ? 300 : 330, marginTop: 8 };

  return (
    <YStack width={width} height={height} bg={onSlab ? "$slab" : "$canvas"} pt={topInset} pb={bottomSpace} overflow="hidden">
      {topBar}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: space[4] }}
        scrollEnabled={compact}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <Animated.View style={[artStyle, parallax]}>
          {onSlab ? (
            <WelcomeCards active={active} />
          ) : (
            <View flex={1} mx={space[5]} rounded={28} bg={slide === "notifications" ? undefined : "$surface"} overflow="hidden" justify="center">
              {slide === "accounts" ? <AccountsIllustration active={active} /> : null}
              {slide === "payments" ? <PaymentsIllustration active={active} /> : null}
              {slide === "privacy" ? <PrivacyIllustration active={active} /> : null}
              {slide === "notifications" ? <NotificationsIllustration active={active} /> : null}
            </View>
          )}
        </Animated.View>
        <YStack px={onSlab ? space[6] : space[5]} mt={onSlab ? space[2] : 26}>
          {onSlab ? (
            <View mb={14}>
              <BrandSymbol size={40} />
            </View>
          ) : null}
          <Text
            color={onSlab ? "$slabInk" : "$ink"}
            maxFontSizeMultiplier={1.3}
            style={{
              fontFamily: fontFace.display[700],
              fontSize: onSlab ? 40 : 32,
              lineHeight: onSlab ? 42 : 35,
              letterSpacing: onSlab ? -1.4 : -1,
            }}
            accessibilityRole="header"
          >
            {t(`onboardingScreen.${slide}.title`)}
          </Text>
          <FText
            tone={onSlab ? "slabMuted" : "inkMuted"}
            style={
              onSlab
                ? {
                    marginTop: 12,
                    fontSize: 16,
                    lineHeight: 24,
                    fontFamily: fontFace.sans[500],
                  }
                : { marginTop: 10, fontSize: 15, lineHeight: 22 }
            }
          >
            {t(`onboardingScreen.${slide}.body`)}
          </FText>
          {bullets.length ? (
            <YStack gap={10} mt={16}>
              {bullets.map((bullet) => (
                <XStack key={bullet} items={compact ? "flex-start" : "center"} gap={10}>
                  <View width={22} height={22} rounded={999} bg="$ink" items="center" justify="center">
                    <Check size={13} color="$canvas" strokeWidth={3} />
                  </View>
                  <FText
                    variant="label"
                    tone="ink"
                    style={{
                      flex: 1,
                      fontSize: 15,
                      lineHeight: 20,
                      fontFamily: fontFace.display[600],
                    }}
                  >
                    {bullet}
                  </FText>
                </XStack>
              ))}
            </YStack>
          ) : null}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

/**
 * La bienvenida (K-00): la boleta del patrimonio en papel con su emoji arriba a la derecha y el cambio del mes en una
 * píldora tinta, y debajo, corrido a la derecha, el aviso de vencimiento en tinta con el emoji del servicio. Van sobre
 * la losa en los dos temas, así que sus colores son fijos. En bucle: la boleta entra, el saldo sube desde cero, aparece
 * el cambio del mes y llega el aviso; así se lee como un ejemplo y no como el saldo de la persona.
 */
function WelcomeCards({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const cycle = useDemoCycle(active, 6500);
  const worth = amountParts(useTween(18420.65, { from: 0, duration: 1300, delay: 300, run: cycle }), SAMPLE_CURRENCY);
  return (
    <DemoRound cycle={cycle} style={{ paddingHorizontal: 30 }}>
      <Enter from="down">
        <YStack
          py={16}
          px={18}
          rounded={24}
          style={{
            backgroundColor: WELCOME_PAPER,
            transform: [{ rotate: "-3deg" }],
            boxShadow: "0 20px 40px -22px rgba(20,20,18,0.55)",
          }}
        >
          <XStack items="center" justify="space-between">
            <Text
              maxFontSizeMultiplier={COMPACT_FONT_SCALE}
              style={{
                fontFamily: fontFace.display[700],
                fontSize: 12,
                color: PAPER_MUTED,
              }}
            >
              {t("onboardingScreen.welcome.netWorth")}
            </Text>
            <EmojiTile emoji="💼" size={28} hue={30} />
          </XStack>
          <Text
            allowFontScaling={false}
            style={{
              ...textStyles["amount-hero"],
              fontSize: 36,
              lineHeight: 42,
              letterSpacing: -0.7,
              color: PAPER_INK,
              marginTop: 8,
            }}
          >
            <Text
              style={{
                fontFamily: fontFace.mono[500],
                fontSize: 18,
                letterSpacing: 0,
                color: PAPER_FAINT,
              }}
            >
              {worth.symbol}
              {THIN_SPACE}
            </Text>
            {worth.integer}
            <Text style={{ fontSize: 21, color: PAPER_FAINT }}>.{worth.fraction}</Text>
          </Text>
          <XStack items="center" gap={6} mt={6}>
            <Enter from="pop" delay={1500}>
              <View height={22} px={8} rounded={999} items="center" justify="center" style={{ backgroundColor: PAPER_INK }}>
                <Text
                  allowFontScaling={false}
                  style={{
                    fontFamily: fontFace.mono[600],
                    fontSize: 12,
                    color: PAPER_GAIN,
                  }}
                >
                  {formatAmount(1240, SAMPLE_CURRENCY, { sign: "always" })}
                </Text>
              </View>
            </Enter>
            <Text
              maxFontSizeMultiplier={COMPACT_FONT_SCALE}
              style={{
                fontFamily: fontFace.display[700],
                fontSize: 12,
                color: PAPER_MUTED,
              }}
            >
              {t("onboardingScreen.welcome.thisMonth")}
            </Text>
          </XStack>
        </YStack>
      </Enter>
      <Enter from="right" delay={1900}>
        <XStack
          mt={-10}
          ml={70}
          px={14}
          py={12}
          rounded={18}
          items="center"
          gap={10}
          style={{
            backgroundColor: PAPER_INK,
            transform: [{ rotate: "2deg" }],
            boxShadow: "0 16px 30px -18px rgba(20,20,18,0.7)",
          }}
        >
          <EmojiTile emoji="💡" size={34} hue={50} />
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={COMPACT_FONT_SCALE}
            style={{
              flex: 1,
              fontFamily: fontFace.display[700],
              fontSize: 14,
              color: WELCOME_PAPER,
            }}
          >
            {t("onboardingScreen.welcome.dueTomorrow", {
              name: t("onboardingScreen.payments.power"),
            })}
          </Text>
        </XStack>
      </Enter>
    </DemoRound>
  );
}

/** El cuadro del emoji con el fondo pastel de su tono, fijo: va sobre papel o tinta que no cambian con el tema. */
function EmojiTile({ emoji, size, hue }: { emoji: string; size: number; hue: number }) {
  return (
    <View
      width={size}
      height={size}
      rounded={Math.round(size * MONOGRAM_RADIUS)}
      items="center"
      justify="center"
      style={{ backgroundColor: `hsl(${hue}, 90%, 93%)` }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        allowFontScaling={false}
        style={{
          fontSize: Math.round(size * 0.54),
          lineHeight: Math.round(size * 0.68),
          includeFontPadding: false,
        }}
      >
        {emoji}
      </Text>
    </View>
  );
}

/** Una fila de ejemplo como las de la app: cuadro (emoji o ícono), nombre, detalle y lo de la derecha. */
function SampleRow({
  leading,
  name,
  detail,
  trailing,
  divider = false,
}: {
  leading: ReactNode;
  name: string;
  detail: ReactNode;
  trailing: ReactNode;
  divider?: boolean;
}) {
  return (
    <XStack items="center" gap={10} py={10} borderTopWidth={divider ? 1 : 0} borderColor="$line">
      {leading}
      <YStack flex={1} minW={0}>
        <FText
          numberOfLines={1}
          maxFontSizeMultiplier={COMPACT_FONT_SCALE}
          style={{
            fontFamily: fontFace.display[700],
            fontSize: 14,
            lineHeight: 19,
          }}
        >
          {name}
        </FText>
        {typeof detail === "string" ? (
          <FText variant="caption" tone="inkMuted" numberOfLines={1} maxFontSizeMultiplier={COMPACT_FONT_SCALE}>
            {detail}
          </FText>
        ) : (
          detail
        )}
      </YStack>
      {trailing}
    </XStack>
  );
}

/** El monto de una fila de ejemplo: en tinta, o en `flowOut` si es un gasto o un saldo en negativo. */
function SampleAmount({ value }: { value: number }) {
  return (
    <FText variant="amount-sm" color={value < 0 ? "$flowOut" : "$ink"} style={{ fontSize: 14 }}>
      {formatAmount(value, SAMPLE_CURRENCY)}
    </FText>
  );
}

/** La tarjeta de las ilustraciones: `canvas` sobre el panel `surface`, con sombra y filas separadas por filete. */
function SampleCard({ children, offset = 0, tilt = 0, mt = 0 }: { children: ReactNode; offset?: number; tilt?: number; mt?: number }) {
  const { themeMode } = useThemeMode();
  return (
    <YStack
      bg="$canvas"
      rounded={20}
      px={14}
      py={6}
      ml={offset}
      mt={mt}
      style={{
        boxShadow: shadows[themeMode].raised,
        transform: tilt ? [{ rotate: `${tilt}deg` }] : undefined,
      }}
    >
      {children}
    </YStack>
  );
}

function accountTile(type: string) {
  const Icon = getAccountRowIcon(type);
  return <Monogram name={type} size={38} icon={<Icon size={18} color="$ink" strokeWidth={2} />} />;
}

/**
 * Cuentas (K-01): tres cuentas con el ícono de su tipo y, corrida e inclinada, la última compra con su emoji. En bucle:
 * entran las cuentas una tras otra, llega la compra y el saldo de Sueldo baja lo que costó.
 */
function AccountsIllustration({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const cycle = useDemoCycle(active, 5000);
  const salary = useTween(4820.3, {
    from: 4906.7,
    duration: 700,
    delay: 1100,
    run: cycle,
  });
  return (
    <DemoRound cycle={cycle} style={{ paddingHorizontal: 18 }}>
      <SampleCard>
        <Enter from="left">
          <SampleRow
            leading={accountTile("savings_account")}
            name={t("onboardingScreen.accounts.salary")}
            detail={t("onboardingScreen.accounts.savings")}
            trailing={<SampleAmount value={salary} />}
          />
        </Enter>
        <Enter from="left" delay={120}>
          <SampleRow
            divider
            leading={accountTile("credit_card")}
            name="Visa"
            detail={t("onboardingScreen.accounts.card")}
            trailing={<SampleAmount value={-1240} />}
          />
        </Enter>
        <Enter from="left" delay={240}>
          <SampleRow
            divider
            leading={accountTile("cash")}
            name={t("onboardingScreen.accounts.cash")}
            detail={t("onboardingScreen.accounts.cashType")}
            trailing={<SampleAmount value={180} />}
          />
        </Enter>
      </SampleCard>
      <Enter from="down" delay={700}>
        <SampleCard offset={34} tilt={-2} mt={12}>
          <SampleRow
            leading={<Monogram name={t("onboardingScreen.accounts.grocery")} emoji="🛒" size={38} />}
            name={t("onboardingScreen.accounts.grocery")}
            detail={t("onboardingScreen.accounts.groceryDetail")}
            trailing={<SampleAmount value={-86.4} />}
          />
        </SampleCard>
      </Enter>
    </DemoRound>
  );
}

/**
 * Pagos (K-02): una tarjeta con el pago que vence mañana, el alquiler y uno automático ya pagado. En bucle: entran los
 * tres y el de mañana se paga solo: el botón Pagar se hunde y cambia a "Pagado".
 */
function PaymentsIllustration({ active }: { active: boolean }) {
  const { t, i18n } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const cycle = useDemoCycle(active, 5000);
  const pressing = useAfter(1300, cycle);
  const paid = useAfter(1650, cycle) && cycle > 0;
  const now = new Date();
  const firstOfNext = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return (
    <DemoRound cycle={cycle} style={{ paddingHorizontal: 18 }}>
      <SampleCard>
        <Enter from="left">
          <SampleRow
            leading={<Monogram name={t("onboardingScreen.payments.power")} emoji="💡" size={38} />}
            name={t("onboardingScreen.payments.power")}
            detail={
              paid ? (
                t("onboardingScreen.payments.monthly", {
                  date: shortDay(firstOfNext, locale),
                })
              ) : (
                <FText
                  variant="caption"
                  color="$dangerHard"
                  numberOfLines={1}
                  maxFontSizeMultiplier={COMPACT_FONT_SCALE}
                  style={{ fontFamily: fontFace.display[700] }}
                >
                  {t("onboardingScreen.payments.dueTomorrow")}
                </FText>
              )
            }
            trailing={
              paid ? (
                <Enter from="pop">
                  <PaidPill label={t("onboardingScreen.payments.paid")} />
                </Enter>
              ) : (
                <View
                  height={32}
                  px={14}
                  rounded={999}
                  bg="$brand"
                  items="center"
                  justify="center"
                  style={{
                    transform: [{ scale: pressing && cycle > 0 ? 0.9 : 1 }],
                  }}
                >
                  <FText color="$onBrand" maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.display[700], fontSize: 14 }}>
                    {t("onboardingScreen.payments.pay")}
                  </FText>
                </View>
              )
            }
          />
        </Enter>
        <Enter from="left" delay={120}>
          <SampleRow
            divider
            leading={<Monogram name={t("onboardingScreen.payments.rent")} emoji="🏠" size={38} />}
            name={t("onboardingScreen.payments.rent")}
            detail={t("onboardingScreen.payments.monthly", {
              date: shortDay(firstOfNext, locale),
            })}
            trailing={<SampleAmount value={1450} />}
          />
        </Enter>
        <Enter from="left" delay={240}>
          <SampleRow
            divider
            leading={<Monogram name={t("onboardingScreen.payments.streaming")} emoji="🎬" size={38} />}
            name={t("onboardingScreen.payments.streaming")}
            detail={t("onboardingScreen.payments.automatic")}
            trailing={<PaidPill label={t("onboardingScreen.payments.paid")} />}
          />
        </Enter>
      </SampleCard>
    </DemoRound>
  );
}

function PaidPill({ label }: { label: string }) {
  return (
    <XStack height={26} px={10} gap={4} rounded={999} bg="$ink" items="center">
      <Check size={12} color="$canvas" strokeWidth={3} />
      <FText color="$canvas" maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.display[700], fontSize: 12 }}>
        {label}
      </FText>
    </XStack>
  );
}

/**
 * Privacidad (K-03): la losa del patrimonio con el ojo y dos gastos. En bucle, los montos se muestran y se ocultan
 * con el ojo, como el botón del Inicio; con "reducir movimiento" quedan ocultos.
 */
function PrivacyIllustration({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const tick = useDemoCycle(active, 1800);
  const hidden = tick % 2 === 0;
  const symbol = amountParts(0, SAMPLE_CURRENCY).symbol;
  const worth = amountParts(18420.65, SAMPLE_CURRENCY);
  const Icon = hidden ? EyeOff : Eye;
  const rowAmount = (value: number) =>
    hidden ? (
      <Text
        allowFontScaling={false}
        color="$ink"
        style={{
          fontFamily: fontFace.mono[600],
          fontSize: 14,
          letterSpacing: 1,
        }}
      >
        <Text
          color="$ink"
          style={{
            fontFamily: fontFace.mono[500],
            fontSize: 11,
            letterSpacing: 0,
          }}
        >
          {symbol}
          {THIN_SPACE}
        </Text>
        ••••••
      </Text>
    ) : (
      <SampleAmount value={value} />
    );
  return (
    <YStack px={18}>
      <YStack py={16} px={18} rounded={24} bg="$slab">
        <XStack items="center" justify="space-between">
          <FText color="$slabMuted" maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.display[700], fontSize: 12 }}>
            {t("onboardingScreen.privacy.netWorth")}
          </FText>
          <View width={34} height={34} rounded={999} bg="$slabInk" items="center" justify="center" accessibilityLabel={t("onboardingScreen.privacy.hidden")}>
            <Icon size={17} color="$slab" strokeWidth={2} />
          </View>
        </XStack>
        <Text
          allowFontScaling={false}
          color="$slabInk"
          mt={8}
          style={{
            fontFamily: fontFace.mono[600],
            fontSize: 34,
            lineHeight: 40,
            letterSpacing: hidden ? 2.5 : -0.7,
          }}
        >
          <Text
            color="$slabMuted"
            style={{
              fontFamily: fontFace.mono[500],
              fontSize: 17,
              letterSpacing: 0,
            }}
          >
            {symbol}
            {THIN_SPACE}
          </Text>
          {hidden ? "••••••" : `${worth.integer}.${worth.fraction}`}
        </Text>
        <View
          height={24}
          px={10}
          mt={8}
          rounded={999}
          items="center"
          justify="center"
          style={{
            alignSelf: "flex-start",
            backgroundColor: "rgba(20,20,18,0.1)",
            opacity: hidden ? 1 : 0,
          }}
        >
          <FText color="$slabInk" maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.display[700], fontSize: 12 }}>
            {t("onboardingScreen.privacy.hidden")}
          </FText>
        </View>
      </YStack>
      <SampleCard mt={12}>
        <SampleRow
          leading={<Monogram name={t("onboardingScreen.privacy.food")} emoji="🍔" size={38} />}
          name={t("onboardingScreen.privacy.food")}
          detail={t("onboardingScreen.privacy.foodCategory")}
          trailing={rowAmount(-42.9)}
        />
        <SampleRow
          divider
          leading={<Monogram name={t("onboardingScreen.privacy.taxi")} emoji="🚕" size={38} />}
          name={t("onboardingScreen.privacy.taxi")}
          detail={t("onboardingScreen.privacy.taxiCategory")}
          trailing={rowAmount(-18.5)}
        />
      </SampleCard>
    </YStack>
  );
}

/**
 * Recordatorios (K-04): la pantalla bloqueada de un teléfono, oscura en los dos temas, con la hora, la fecha y dos
 * avisos tal como los manda el backend: un movimiento detectado (con monto y la descripción del correo) y un pago
 * que vence mañana. En bucle, los avisos bajan uno tras otro como llegan al teléfono.
 */
function NotificationsIllustration({ active }: { active: boolean }) {
  const { t, i18n } = useTranslation();
  const cycle = useDemoCycle(active, 5000);
  const locale = getAppLocale(i18n.resolvedLanguage);
  const now = new Date();
  const clock = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const dateText = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const morning = new Date(now);
  morning.setHours(9, 0, 0, 0);
  const morningText = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(morning);

  return (
    <LinearGradient colors={LOCK_GRADIENT} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1, paddingVertical: 22, paddingHorizontal: 14 }}>
      <Text
        allowFontScaling={false}
        style={{
          textAlign: "center",
          color: LOCK_CLOCK,
          fontFamily: fontFace.mono[600],
          fontSize: 54,
          lineHeight: 60,
          letterSpacing: -1.5,
        }}
      >
        {clock}
      </Text>
      <Text
        maxFontSizeMultiplier={COMPACT_FONT_SCALE}
        style={{
          textAlign: "center",
          color: LOCK_DATE,
          fontFamily: fontFace.display[600],
          fontSize: 13,
          marginTop: 8,
          marginBottom: 22,
        }}
      >
        {dateText.charAt(0).toUpperCase() + dateText.slice(1)}
      </Text>
      <DemoRound cycle={cycle} style={{ justifyContent: "flex-start", gap: 8 }}>
        <Enter from="up" delay={300}>
          <LockNotification
            when={t("onboardingScreen.notifications.now")}
            title={t("onboardingScreen.notifications.detectedTitle")}
            body={`${formatAmount(64.9, SAMPLE_CURRENCY)} · ${t("onboardingScreen.notifications.detectedSample")}`}
          />
        </Enter>
        <Enter from="up" delay={1100}>
          <LockNotification
            when={morningText}
            title={t("onboardingScreen.notifications.dueTitle")}
            body={t("onboardingScreen.notifications.dueBody", {
              name: t("onboardingScreen.payments.power"),
            })}
          />
        </Enter>
      </DemoRound>
    </LinearGradient>
  );
}

/** Un aviso de la pantalla bloqueada: papel casi opaco con el ícono de la app; colores fijos, como el teléfono. */
function LockNotification({ when, title, body }: { when: string; title: string; body: string }) {
  return (
    <XStack gap={10} px={13} py={11} rounded={20} items="flex-start" style={{ backgroundColor: "rgba(255,255,255,0.92)" }}>
      <BrandSymbol size={34} tile />
      <YStack flex={1} minW={0}>
        <XStack justify="space-between" gap={8}>
          <Text
            maxFontSizeMultiplier={COMPACT_FONT_SCALE}
            style={{
              fontFamily: fontFace.display[700],
              fontSize: 12,
              color: PAPER_INK,
            }}
          >
            My Fint
          </Text>
          <Text
            maxFontSizeMultiplier={COMPACT_FONT_SCALE}
            style={{
              fontFamily: fontFace.sans[500],
              fontSize: 12,
              color: PAPER_MUTED,
            }}
          >
            {when}
          </Text>
        </XStack>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={COMPACT_FONT_SCALE}
          style={{
            fontFamily: fontFace.display[700],
            fontSize: 14,
            color: PAPER_INK,
            marginTop: 1,
          }}
        >
          {title}
        </Text>
        <Text
          numberOfLines={2}
          maxFontSizeMultiplier={COMPACT_FONT_SCALE}
          style={{
            fontFamily: fontFace.sans[500],
            fontSize: 13,
            lineHeight: 17,
            color: LOCK_BODY,
          }}
        >
          {body}
        </Text>
      </YStack>
    </XStack>
  );
}

/** Los puntos de página (8 de alto): el activo mide 20px; ancho y color siguen al dedo. Sobre la losa, `slabInk`; después, `ink`. */
function PageDots({ scrollX, width }: { scrollX: SharedValue<number>; width: number }) {
  return (
    <XStack justify="center" gap={6} pointerEvents="none">
      {ONBOARDING_SLIDES.map((slide, i) => (
        <Dot key={slide} index={i} scrollX={scrollX} width={width} />
      ))}
    </XStack>
  );
}

function Dot({ index, scrollX, width }: { index: number; scrollX: SharedValue<number>; width: number }) {
  const theme = useTheme();
  const colors = {
    slabInk: theme.slabInk.val,
    slabMuted: theme.slabMuted.val,
    ink: theme.ink.val,
    lineStrong: theme.lineStrong.val,
  };
  const style = useAnimatedStyle(() => {
    const w = Math.max(width, 1);
    const page = scrollX.value / w;
    const active = interpolate(Math.abs(page - index), [0, 1], [1, 0], Extrapolation.CLAMP);
    const offSlab = interpolate(page, [0, 1], [0, 1], Extrapolation.CLAMP);
    const on = interpolateColor(offSlab, [0, 1], [colors.slabInk, colors.ink]);
    const off = interpolateColor(offSlab, [0, 1], [colors.slabMuted, colors.lineStrong]);
    return {
      width: 8 + 12 * active,
      opacity: 0.45 + 0.55 * active,
      backgroundColor: interpolateColor(active, [0, 1], [off, on]),
    };
  });
  return <Animated.View style={[{ height: 8, borderRadius: 4 }, style]} />;
}

/**
 * El botón principal (CTA de 56): en la bienvenida, tinta con texto amarillo; después, amarillo (`brand`) con texto
 * `onBrand`, mezclados con el desplazamiento.
 */
function PrimaryButton({
  scrollX,
  width,
  label,
  busy,
  onSlab,
  icon,
  onPress,
}: {
  scrollX: SharedValue<number>;
  width: number;
  label: string;
  busy: boolean;
  onSlab: boolean;
  icon: ReactNode;
  onPress: () => void;
}) {
  const theme = useTheme();
  const colors = {
    slabInk: theme.slabInk.val,
    slab: theme.slab.val,
    brand: theme.brand.val,
    onBrand: theme.onBrand.val,
  };
  const bg = useAnimatedStyle(() => {
    const p = interpolate(scrollX.value / Math.max(width, 1), [0, 1], [0, 1], Extrapolation.CLAMP);
    return {
      backgroundColor: interpolateColor(p, [0, 1], [colors.slabInk, colors.brand]),
    };
  });
  const fg = useAnimatedStyle(() => {
    const p = interpolate(scrollX.value / Math.max(width, 1), [0, 1], [0, 1], Extrapolation.CLAMP);
    return {
      color: interpolateColor(p, [0, 1], [colors.slab, colors.onBrand]),
    };
  });
  return (
    <PressableScale onPress={onPress} disabled={busy} haptic="tap" accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy }}>
      <Animated.View
        style={[
          {
            height: 56,
            borderRadius: 999,
            paddingHorizontal: 24,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          },
          bg,
        ]}
      >
        {busy ? <FintSpinner color={onSlab ? "$slab" : "$onBrand"} /> : icon}
        <Animated.Text
          maxFontSizeMultiplier={1.3}
          numberOfLines={1}
          style={[
            {
              fontFamily: fontFace.display[700],
              fontSize: 17,
              letterSpacing: -0.1,
            },
            fg,
          ]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </PressableScale>
  );
}
