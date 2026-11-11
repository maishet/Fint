import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, ChevronLeft, CreditCard, EyeOff, House, Landmark, ShoppingBasket, Wallet, Zap } from "@tamagui/lucide-icons-2";
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
import { amountParts, formatAmount, THIN_SPACE } from "../src/finance/formatAmount";
import { getAppLocale, getCurrentAppLanguage } from "../src/i18n";
import { shortDay } from "../src/movement-form/DateSheet";
import { requestAndRegisterPushInstallation, type PushPermissionState } from "../src/notifications/pushNotifications";
import { ONBOARDING_SLIDES, primaryAction, slideAt, type OnboardingSlide } from "../src/onboarding/steps";
import { useThemeMode } from "../src/theme/ThemeMode";
import { COMPACT_FONT_SCALE, radius, shadows, space } from "../src/theme/tokens";
import { fontFace, textStyles } from "../src/theme/typography";
import { FintButton, FintCard, FintSpinner, FText, IconButton, Monogram, notify, PressableScale } from "../src/ui";
import { BrandSymbol } from "../src/ui/BrandSymbol";

/** Las cifras de las ilustraciones son de ejemplo y siempre en soles, como en el diseño. */
const SAMPLE_CURRENCY = "PEN";
/** Alto del pie (puntos, botón CTA de 56 y margen), sin el inset inferior; la última pantalla suma "Ahora no". */
const FOOTER_HEIGHT = 6 + 18 + 56 + 20;
const NOT_NOW_HEIGHT = 6 + 56;
/** Alto de la ilustración desde `COMPACT_FONT_SCALE`, cuando la pantalla se desplaza. */
const COMPACT_ART_HEIGHT = 230;
/**
 * Las dos piezas de la bienvenida van sobre la losa amarilla en los dos temas, así que sus colores no siguen al
 * tema: la boleta del patrimonio en papel blanco y el aviso de vencimiento en tinta.
 */
const WELCOME_PAPER = "#FFFFFF";
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
        <XStack items="center" gap={10}>
          <BrandSymbol size={34} />
          <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fontFace.display[700], fontSize: 20, letterSpacing: -0.6 }}>
            <Text color="$slabMuted">My </Text>
            <Text color="$slabInk">Fint</Text>
          </Text>
        </XStack>
      ) : (
        <IconButton
          label={t("onboardingScreen.back")}
          onPress={() => goTo(slide - 1)}
          icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />}
        />
      )}
      {slide === last ? null : (
        <Pressable onPress={skip} disabled={finishing} hitSlop={12} accessibilityRole="button">
          <FText variant="label" tone={slide === 0 ? "slabMuted" : "inkMuted"} style={{ fontSize: 14, fontFamily: fontFace.sans[600] }}>
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
          <PrimaryButton
            scrollX={scrollX}
            width={width}
            label={primaryLabel}
            busy={busy}
            onSlab={index === 0}
            icon={action === "enableNotifications" && !isRequestingPush ? <Bell size={18} color="$onBrand" strokeWidth={2} /> : null}
            onPress={onPrimary}
          />
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
  width,
  height,
  topInset,
  bottomSpace,
  scrollX,
  topBar,
}: {
  slide: OnboardingSlide;
  index: number;
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
  const parallax = useAnimatedStyle(() => ({ transform: [{ translateX: -(scrollX.value - index * width) * PARALLAX }] }));
  const bullets = onSlab || slide === "notifications" ? [] : (t(`onboardingScreen.${slide}.bullets`, { returnObjects: true }) as string[]);
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
            <WelcomeCards />
          ) : (
            <View flex={1} mx={space[5]} rounded={28} bg="$surface" overflow="hidden" justify="center">
              {slide === "accounts" ? <AccountsIllustration /> : null}
              {slide === "payments" ? <PaymentsIllustration /> : null}
              {slide === "privacy" ? <PrivacyIllustration /> : null}
              {slide === "notifications" ? <NotificationsIllustration /> : null}
            </View>
          )}
        </Animated.View>
        <YStack px={space[5]} mt={onSlab ? space[2] : 26}>
          <Text
            color={onSlab ? "$slabInk" : "$ink"}
            maxFontSizeMultiplier={1.3}
            style={{
              fontFamily: fontFace.display[700],
              fontSize: onSlab ? 40 : 32,
              lineHeight: onSlab ? 44 : 37,
              letterSpacing: onSlab ? -1.4 : -1,
            }}
            accessibilityRole="header"
          >
            {t(`onboardingScreen.${slide}.title`)}
          </Text>
          <FText tone={onSlab ? "slabMuted" : "inkMuted"} style={{ marginTop: 10 }}>
            {t(`onboardingScreen.${slide}.body`)}
          </FText>
          {bullets.length ? (
            <YStack gap={10} mt={18}>
              {bullets.map((bullet) => (
                <XStack key={bullet} items={compact ? "flex-start" : "center"} gap={10}>
                  <View width={24} height={24} rounded={999} bg="$ink" items="center" justify="center">
                    <Check size={13} color="$canvas" strokeWidth={2.8} />
                  </View>
                  <FText variant="label" tone="inkMuted" style={{ flex: 1, fontSize: 14 }}>
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

function WelcomeCards() {
  const { t } = useTranslation();
  const worth = amountParts(18420.65, SAMPLE_CURRENCY);
  return (
    <YStack flex={1} justify="center" px={space[6]} gap={space[4]}>
      <YStack p={18} rounded={22} style={{ backgroundColor: WELCOME_PAPER, transform: [{ rotate: "-3deg" }] }}>
        <FText variant="overline" tone="slabMuted">
          {t("onboardingScreen.welcome.netWorth")}
        </FText>
        <Text color="$slabInk" mt={6} allowFontScaling={false} style={{ ...textStyles["amount-hero"], fontSize: 34, lineHeight: 40, letterSpacing: -1.4 }}>
          <Text color="$slabMuted" style={{ fontSize: 18, letterSpacing: 0 }}>
            {worth.symbol}
            {THIN_SPACE}
          </Text>
          {worth.integer}.{worth.fraction}
        </Text>
        <FText variant="caption" tone="flowInSlab" style={{ marginTop: 4 }}>
          <Text color="$flowInSlab" style={{ fontFamily: fontFace.mono[500] }}>
            {formatAmount(1240, SAMPLE_CURRENCY, { sign: "always" })}
          </Text>{" "}
          {t("onboardingScreen.welcome.thisMonth")}
        </FText>
      </YStack>
      <XStack
        mx={space[6]}
        px={space[4]}
        py={space[3]}
        rounded={18}
        bg="$slabInk"
        items="center"
        justify="space-between"
        gap={space[3]}
        style={{ transform: [{ rotate: "2deg" }] }}
      >
        <FText variant="label" numberOfLines={1} style={{ flex: 1, color: WELCOME_PAPER, fontFamily: fontFace.sans[600] }}>
          {t("onboardingScreen.welcome.dueTomorrow", { name: t("onboardingScreen.payments.power") })}
        </FText>
        <FText variant="amount-sm" color="$slab">
          {formatAmount(128.4, SAMPLE_CURRENCY)}
        </FText>
      </XStack>
    </YStack>
  );
}

/** Una fila de ejemplo como las de la app: monograma, nombre, detalle y monto. */
function SampleRow({
  icon,
  name,
  detail,
  amount,
  tag,
  color = "$inkMuted",
}: {
  icon?: ReactNode;
  name: string;
  detail: string;
  amount: string;
  tag?: ReactNode;
  color?: string;
}) {
  return (
    <XStack items="center" gap={12}>
      <Monogram name={name} icon={icon} color={color as never} />
      <YStack flex={1} minW={0}>
        <FText variant="body-strong" numberOfLines={1} style={{ fontSize: 14, lineHeight: 20 }}>
          {name}
        </FText>
        <FText variant="caption" tone="inkFaint" numberOfLines={1}>
          {detail}
        </FText>
      </YStack>
      <YStack items="flex-end">
        <FText variant="amount-sm" style={{ fontSize: 14 }}>
          {amount}
        </FText>
        {tag}
      </YStack>
    </XStack>
  );
}

/** Las tarjetas de las ilustraciones van en `canvas`: sobre el panel `surface` una tarjeta `surface` no se vería. */
function FloatingCard({ children, inset = "center" }: { children: ReactNode; inset?: "center" | "right" }) {
  const { themeMode } = useThemeMode();
  return (
    <FintCard
      bg="$canvas"
      px={14}
      py={12}
      ml={inset === "right" ? 36 : 20}
      mr={inset === "right" ? 4 : 20}
      style={{ boxShadow: shadows[themeMode].raised }}
    >
      {children}
    </FintCard>
  );
}

function AccountsIllustration() {
  const { t } = useTranslation();
  const rows = [
    {
      key: "salary",
      icon: <Landmark size={16} color="$chart2" strokeWidth={2} />,
      name: t("onboardingScreen.accounts.salary"),
      detail: t("onboardingScreen.accounts.savings"),
      amount: formatAmount(4820.3, SAMPLE_CURRENCY),
    },
    {
      key: "card",
      icon: <CreditCard size={16} color="$chart4" strokeWidth={2} />,
      name: "Visa",
      detail: t("onboardingScreen.accounts.card"),
      amount: formatAmount(-1240, SAMPLE_CURRENCY),
    },
    {
      key: "cash",
      icon: <Wallet size={16} color="$chart1" strokeWidth={2} />,
      name: t("onboardingScreen.accounts.cash"),
      detail: t("onboardingScreen.accounts.cashType"),
      amount: formatAmount(180, SAMPLE_CURRENCY),
    },
  ];
  return (
    <YStack gap={14}>
      <FintCard p={0} mx={20} bg="$canvas">
        {rows.map((row, i) => (
          <View key={row.key} px={14} py={12} borderTopWidth={i === 0 ? 0 : 1} borderColor="$line">
            <SampleRow icon={row.icon} name={row.name} detail={row.detail} amount={row.amount} />
          </View>
        ))}
      </FintCard>
      <FloatingCard inset="right">
        <SampleRow
          icon={<ShoppingBasket size={16} color="$chart3" strokeWidth={2} />}
          name={t("onboardingScreen.accounts.grocery")}
          detail={t("onboardingScreen.accounts.groceryDetail")}
          amount={formatAmount(-86.4, SAMPLE_CURRENCY)}
        />
      </FloatingCard>
    </YStack>
  );
}

function PaymentsIllustration() {
  const { t, i18n } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const now = new Date();
  const firstOfNext = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return (
    <YStack gap={14}>
      <FloatingCard>
        <SampleRow
          icon={<Zap size={16} color="$chart4" strokeWidth={2} />}
          name={t("onboardingScreen.payments.power")}
          detail={t("onboardingScreen.payments.dueTomorrow")}
          amount={formatAmount(128.4, SAMPLE_CURRENCY)}
        />
      </FloatingCard>
      <FloatingCard inset="right">
        <SampleRow
          icon={<House size={16} color="$chart2" strokeWidth={2} />}
          name={t("onboardingScreen.payments.rent")}
          detail={t("onboardingScreen.payments.monthly", { date: shortDay(firstOfNext, locale) })}
          amount={formatAmount(1450, SAMPLE_CURRENCY)}
        />
      </FloatingCard>
      <FloatingCard>
        <SampleRow
          name={t("onboardingScreen.payments.streaming")}
          color="$chart6"
          detail={t("onboardingScreen.payments.automatic")}
          amount={formatAmount(44.9, SAMPLE_CURRENCY)}
          tag={
            <FText variant="caption" tone="flowIn" style={{ fontSize: 11, fontFamily: fontFace.sans[600] }}>
              {t("onboardingScreen.payments.paid")}
            </FText>
          }
        />
      </FloatingCard>
    </YStack>
  );
}

/** El hero con los montos ocultos (un punto por dígito, como en el Inicio) y filas con la cifra tapada. */
function PrivacyIllustration() {
  const { t } = useTranslation();
  const masked = `${amountParts(0, SAMPLE_CURRENCY).symbol}${THIN_SPACE}••••`;
  return (
    <YStack gap={14}>
      <YStack mx={20} p={18} rounded={radius.lg} bg="$slab" gap={12}>
        <XStack items="center" justify="space-between">
          <FText variant="overline" tone="slabMuted">
            {t("onboardingScreen.privacy.netWorth")}
          </FText>
          <View
            width={34}
            height={34}
            rounded={999}
            bg="$glassSlab"
            borderWidth={1}
            borderColor="$glassSlabLine"
            items="center"
            justify="center"
            accessibilityLabel={t("onboardingScreen.privacy.hidden")}
          >
            <EyeOff size={16} color="$slabInk" strokeWidth={2} />
          </View>
        </XStack>
        <XStack gap={9} height={40} items="center">
          {Array.from({ length: 7 }, (_, i) => (
            <View key={i} width={11} height={11} rounded={999} bg="$slabMuted" />
          ))}
        </XStack>
      </YStack>
      <FintCard p={0} mx={20} bg="$canvas">
        {[
          {
            key: "salary",
            icon: <Landmark size={16} color="$chart2" strokeWidth={2} />,
            name: t("onboardingScreen.accounts.salary"),
            detail: t("onboardingScreen.accounts.savings"),
          },
          { key: "card", icon: <CreditCard size={16} color="$chart4" strokeWidth={2} />, name: "Visa", detail: t("onboardingScreen.accounts.card") },
        ].map((row, i) => (
          <View key={row.key} px={14} py={12} borderTopWidth={i === 0 ? 0 : 1} borderColor="$line">
            <SampleRow icon={row.icon} name={row.name} detail={row.detail} amount={masked} />
          </View>
        ))}
      </FintCard>
    </YStack>
  );
}

/**
 * La pantalla bloqueada con dos avisos tal como los manda el backend: un movimiento detectado (con monto y la
 * descripción del correo) y un pago que vence mañana.
 */
function NotificationsIllustration() {
  const { t, i18n } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const now = new Date();
  const clock = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hour12: false }).format(now);
  const dateText = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(now);
  const morning = new Date(now);
  morning.setHours(9, 0, 0, 0);
  const morningText = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(morning);

  return (
    <YStack gap={12} px={18}>
      <YStack items="center" mb={10}>
        <Text color="$ink" allowFontScaling={false} style={{ fontFamily: fontFace.mono[500], fontSize: 60, lineHeight: 66, letterSpacing: -1.5, opacity: 0.9 }}>
          {clock}
        </Text>
        <FText variant="label" tone="inkMuted">
          {dateText.charAt(0).toUpperCase() + dateText.slice(1)}
        </FText>
      </YStack>
      <LockNotification
        when={t("onboardingScreen.notifications.now")}
        title={t("onboardingScreen.notifications.detectedTitle")}
        body={`${formatAmount(64.9, SAMPLE_CURRENCY)} · ${t("onboardingScreen.notifications.detectedSample")}`}
      />
      <View style={{ opacity: 0.7, transform: [{ scale: 0.96 }] }}>
        <LockNotification
          when={morningText}
          title={t("onboardingScreen.notifications.dueTitle")}
          body={t("onboardingScreen.notifications.dueBody", { name: t("onboardingScreen.payments.power") })}
        />
      </View>
    </YStack>
  );
}

function LockNotification({ when, title, body }: { when: string; title: string; body: string }) {
  const { themeMode } = useThemeMode();
  return (
    <XStack
      gap={12}
      px={14}
      py={12}
      rounded={20}
      bg="$canvas"
      items="flex-start"
      style={{ boxShadow: shadows[themeMode].raised }}
    >
      <BrandSymbol size={34} tile />
      <YStack flex={1} minW={0}>
        <XStack justify="space-between" gap={8}>
          <FText variant="label" style={{ fontFamily: fontFace.sans[600] }}>
            My Fint
          </FText>
          <FText variant="caption" tone="inkFaint">
            {when}
          </FText>
        </XStack>
        <FText variant="label" style={{ fontFamily: fontFace.sans[600] }} numberOfLines={1}>
          {title}
        </FText>
        <FText variant="label" tone="inkMuted" numberOfLines={2}>
          {body}
        </FText>
      </YStack>
    </XStack>
  );
}

/** Los puntos de página: el activo mide 20px; ancho y color siguen al dedo. Sobre la losa, `slabInk`; después, `ink`. */
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
  const colors = { slabInk: theme.slabInk.val, slabMuted: theme.slabMuted.val, ink: theme.ink.val, lineStrong: theme.lineStrong.val };
  const style = useAnimatedStyle(() => {
    const w = Math.max(width, 1);
    const page = scrollX.value / w;
    const active = interpolate(Math.abs(page - index), [0, 1], [1, 0], Extrapolation.CLAMP);
    const offSlab = interpolate(page, [0, 1], [0, 1], Extrapolation.CLAMP);
    const on = interpolateColor(offSlab, [0, 1], [colors.slabInk, colors.ink]);
    const off = interpolateColor(offSlab, [0, 1], [colors.slabMuted, colors.lineStrong]);
    return {
      width: 6 + 14 * active,
      opacity: 0.45 + 0.55 * active,
      backgroundColor: interpolateColor(active, [0, 1], [off, on]),
    };
  });
  return <Animated.View style={[{ height: 6, borderRadius: 3 }, style]} />;
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
  const colors = { slabInk: theme.slabInk.val, slab: theme.slab.val, brand: theme.brand.val, onBrand: theme.onBrand.val };
  const bg = useAnimatedStyle(() => {
    const p = interpolate(scrollX.value / Math.max(width, 1), [0, 1], [0, 1], Extrapolation.CLAMP);
    return { backgroundColor: interpolateColor(p, [0, 1], [colors.slabInk, colors.brand]) };
  });
  const fg = useAnimatedStyle(() => {
    const p = interpolate(scrollX.value / Math.max(width, 1), [0, 1], [0, 1], Extrapolation.CLAMP);
    return { color: interpolateColor(p, [0, 1], [colors.slab, colors.onBrand]) };
  });
  return (
    <PressableScale
      onPress={onPress}
      disabled={busy}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
    >
      <Animated.View
        style={[{ height: 56, borderRadius: 999, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, bg]}
      >
        {busy ? <FintSpinner color={onSlab ? "$slab" : "$onBrand"} /> : icon}
        <Animated.Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[{ fontFamily: fontFace.display[700], fontSize: 16, letterSpacing: -0.1 }, fg]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </PressableScale>
  );
}
