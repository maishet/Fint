import { ArrowDown, ArrowUp, Bell, ChevronDown, Ellipsis, Eye, EyeOff, ReceiptText, ScanLine, Search, Wallet } from "@tamagui/lucide-icons-2";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, View, XStack, YStack, useTheme } from "tamagui";
import { useUserAvatar } from "../auth/useUserAvatar";
import { amountParts, THIN_SPACE } from "../finance/formatAmount";
import { useSensitiveAmounts } from "../privacy/SensitiveAmountsProvider";
import { useThemeMode } from "../theme/ThemeMode";
import { fintPalette } from "../theme/palette";
import { COMPACT_FONT_SCALE, motion, radius, space } from "../theme/tokens";
import { fontFace, textStyles } from "../theme/typography";
import { isComingSoon } from "../config/comingSoon";
import { Amount, FText, PressableScale, SoonBadge } from "../ui";
import { SkeletonGroup } from "../components/Skeleton";
import { AmountSkeleton } from "../ui/AmountSkeleton";
import { riseIn } from "../ui/entering";
import { haptics } from "../ui/haptics";

export interface HeroPage {
  key: string;
  label: string;
  balance: number;
  currency: string;
  /** Variación del mes. Solo para "Todas las cuentas" mientras el backend no mande una por cuenta. */
  monthChange?: number | null;
}

interface HomeHeroProps {
  pages: HeroPage[];
  index: number;
  onIndexChange: (index: number) => void;
  scrollY: SharedValue<number>;
  attentionCount: number;
  /** Sin nada por hacer, un punto en la campana si hay avisos informativos sin leer. */
  hasUnread?: boolean;
  /** Cargando: la boleta sigue amarilla, con barras de tinta al 12 % en la forma del saldo y de las acciones. */
  loading?: boolean;
  /** Sin datos (error al cargar): la boleta muestra "S/ —" en lugar del saldo. */
  unavailable?: boolean;
  onProfile: () => void;
  onSearch: () => void;
  onNotifications: () => void;
  onAccounts: () => void;
  onScan: () => void;
  onPay: () => void;
  onMore: () => void;
  /** Con lector de pantalla no hay "tirar para refrescar": el saldo ofrece "Actualizar" como acción de accesibilidad. */
  onRefresh?: () => void;
}

const SWIPE_DISTANCE = 60;
/** Radio de la boleta y diámetro de sus muescas laterales. */
const TICKET_RADIUS = 26;
const NOTCH = 24;
/** Alto mínimo de la parte de arriba de la boleta (cuenta, saldo y cambio del mes); el filete va justo debajo. */
const TICKET_TOP = 172;
/** Lo que la boleta deja libre a la derecha para que asome la siguiente cuenta del carrusel. */
const PEEK = 10;
/** Tintas sobre la píldora tinta del cambio del mes: verde y naranja claros, ≥ 7:1 sobre `#141412`. */
const ON_INK_IN = "#7CE3AA";
const ON_INK_OUT = fintPalette.dark.flowOut;
/** La boleta de la cuenta siguiente que asoma detrás: amarillo apagado contra cada fondo. */
const PEEK_COLOR = { light: "#F2E3A8", dark: "#4A4126" } as const;
/** Fichas de la boleta: tinta al 8 % (acciones) y al 10 % (selector de cuenta, ojo y botones de la barra compacta). */
export const TICKET_CHIP = "rgba(20,20,18,0.08)";
export const TICKET_CONTROL = "rgba(20,20,18,0.10)";
const TICKET_RULE = "rgba(20,20,18,0.16)";
const TICKET_SKELETON = "rgba(20,20,18,0.12)";

/**
 * El Inicio de la marca D: arriba, el avatar, el buscador y la campana sobre `canvas`; debajo, la boleta amarilla
 * (igual en los dos temas) con la cuenta, el saldo, el cambio del mes y, tras el filete con sus dos muescas, las
 * cuatro acciones. Desde `COMPACT_FONT_SCALE` el buscador se vuelve un botón y las acciones pasan a una grilla 2 × 2.
 */
export function HomeHero(props: HomeHeroProps) {
  const { pages, index, onIndexChange, scrollY } = props;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { themeMode } = useThemeMode();
  const { fontScale } = useWindowDimensions();
  const large = fontScale >= COMPACT_FONT_SCALE;
  const [topHeight, setTopHeight] = useState(TICKET_TOP);
  const page = pages[Math.min(index, pages.length - 1)];
  // La moneda va en el selector: el saldo nunca suma monedas distintas, así que se dice en cuál está.
  const pillLabel = page ? `${page.label} · ${page.currency}` : t("home.accountsAll");

  // Al bajar, la boleta se apaga y sube un poco mientras la barra compacta toma su lugar.
  const ticketStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [80, 200], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [80, 200], [0, -16], Extrapolation.CLAMP) }],
  }));

  const actions = [
    { key: "accounts", icon: <Wallet size={21} color="$slabInk" strokeWidth={2} />, onPress: props.onAccounts },
    { key: "scan", icon: <ScanLine size={21} color="$slabInk" strokeWidth={2} />, onPress: props.onScan, soon: isComingSoon("photoCapture") },
    { key: "pay", icon: <ReceiptText size={21} color="$slabInk" strokeWidth={2} />, onPress: props.onPay },
    { key: "more", icon: <Ellipsis size={21} color="$slabInk" strokeWidth={2} />, onPress: props.onMore },
  ];

  return (
    <YStack pt={insets.top + 8}>
      <TopBar {...props} large={large} />

      <Animated.View style={ticketStyle}>
        {/* La boleta entra subiendo 12px con `spring-ui`. */}
        <Animated.View entering={riseIn({ distance: 12, reduceMotion })} style={{ marginTop: space[4], marginLeft: space[5], marginRight: space[5] + (pages.length > 1 && !large ? PEEK : 0) }}>
          {pages.length > 1 && !large ? (
            <View
              position="absolute"
              r={-PEEK}
              t={14}
              b={14}
              width={TICKET_RADIUS}
              style={{ backgroundColor: PEEK_COLOR[themeMode], borderTopRightRadius: 22, borderBottomRightRadius: 22 }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ) : null}

          <View bg="$slab" style={{ borderRadius: TICKET_RADIUS }}>
            <YStack
              minH={TICKET_TOP}
              px={space[5]}
              pt={18}
              pb={space[4]}
              onLayout={(e: LayoutChangeEvent) => setTopHeight(e.nativeEvent.layout.height)}
            >
              {props.loading ? (
                <SkeletonGroup label={t("states.loading")}>
                  <YStack>
                    <Bar width={130} height={30} rounded={999} />
                    <Bar width={190} height={44} rounded={12} mt={22} />
                    <Bar width={120} height={22} rounded={999} mt={12} />
                  </YStack>
                </SkeletonGroup>
              ) : (
              <>
              <XStack items="center" justify="space-between" gap={space[2]}>
                <PressableScale onPress={props.onAccounts} haptic="tap" accessibilityRole="button" accessibilityLabel={pillLabel} style={{ flexShrink: 1 }}>
                  <XStack minH={32} px={12} gap={4} items="center" rounded={radius.pill} style={{ backgroundColor: TICKET_CONTROL }}>
                    <FText
                      tone="slabInk"
                      numberOfLines={1}
                      maxFontSizeMultiplier={COMPACT_FONT_SCALE}
                      style={{ fontFamily: fontFace.sans[600], fontSize: 13, lineHeight: 18, flexShrink: 1 }}
                    >
                      {pillLabel}
                    </FText>
                    <ChevronDown size={15} color="$slabInk" strokeWidth={2.2} />
                  </XStack>
                </PressableScale>
                <EyeToggle large={large} />
              </XStack>

              {page ? (
                <SwipeableBalance
                  page={page}
                  index={index}
                  count={pages.length}
                  unavailable={props.unavailable}
                  onIndexChange={onIndexChange}
                  onRefresh={props.onRefresh}
                />
              ) : null}
              </>
              )}
            </YStack>

            {/* El filete separa saldo y acciones; las muescas, del color del fondo, lo cortan a los lados. */}
            <View position="absolute" l={22} r={22} t={topHeight} height={0} borderTopWidth={1.5} style={{ borderColor: TICKET_RULE }} />
            <View position="absolute" l={-NOTCH / 2} t={topHeight - NOTCH / 2} width={NOTCH} height={NOTCH} rounded={999} bg="$canvas" />
            <View position="absolute" r={-NOTCH / 2} t={topHeight - NOTCH / 2} width={NOTCH} height={NOTCH} rounded={999} bg="$canvas" />

            {props.loading ? (
              <XStack px={8} pt={22} pb={16} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {actions.map((action) => (
                  <YStack key={action.key} flex={1} items="center" gap={8}>
                    <Bar width={46} height={46} rounded={16} />
                    <Bar width={44} height={10} rounded={6} />
                  </YStack>
                ))}
              </XStack>
            ) : large ? (
              <XStack flexWrap="wrap" gap={8} px={18} pt={14} pb={16}>
                {actions.map((action, i) => (
                  <Animated.View key={action.key} entering={riseIn({ distance: 12, delay: i * 40, reduceMotion })} style={{ width: "48%", flexGrow: 1 }}>
                    <HeroAction label={t(`home.actions.${action.key}`)} icon={action.icon} onPress={action.onPress} soon={"soon" in action && action.soon} wide />
                  </Animated.View>
                ))}
              </XStack>
            ) : (
              // Entran subiendo 12px, escalonadas 40ms por acción.
              <XStack px={8} pt={22} pb={16}>
                {actions.map((action, i) => (
                  <Animated.View key={action.key} entering={riseIn({ distance: 12, delay: i * 40, reduceMotion })} style={{ flex: 1 }}>
                    <HeroAction label={t(`home.actions.${action.key}`)} icon={action.icon} onPress={action.onPress} soon={"soon" in action && action.soon} />
                  </Animated.View>
                ))}
              </XStack>
            )}
          </View>
        </Animated.View>

        <Dots count={pages.length} index={index} />
      </Animated.View>
    </YStack>
  );
}

/** Barra de esqueleto sobre la boleta. */
function Bar({ width, height, rounded, mt = 0 }: { width: number; height: number; rounded: number; mt?: number }) {
  return <View width={width} height={height} rounded={rounded} mt={mt} style={{ backgroundColor: TICKET_SKELETON }} />;
}

/** El ojo de la boleta: un interruptor de "Ocultar montos"; activo (montos ocultos), fondo tinta y ojo tachado en amarillo. */
function EyeToggle({ large }: { large: boolean }) {
  const { t } = useTranslation();
  const { amountsVisible, isHydrated, toggleAmountsVisibility } = useSensitiveAmounts();
  const hidden = isHydrated && !amountsVisible;
  const size = large ? 44 : 32;
  return (
    <PressableScale
      onPress={toggleAmountsVisibility}
      haptic="select"
      hitSlop={(44 - size) / 2}
      accessibilityRole="switch"
      accessibilityLabel={t("settingsScreen.hideAmounts")}
      accessibilityState={{ checked: hidden }}
    >
      <View width={size} height={size} rounded={999} items="center" justify="center" style={{ backgroundColor: hidden ? fintPalette.light.ink : TICKET_CONTROL }}>
        {hidden ? <EyeOff size={16} color="$slab" strokeWidth={2.2} /> : <Eye size={16} color="$slabInk" strokeWidth={2.2} />}
      </View>
    </PressableScale>
  );
}

/** El avatar de la persona: abre Ajustes y perfil. Lo usan la barra de arriba y la barra compacta. */
export function ProfileAvatar({ onPress, size = 44, onTicket = false }: { onPress: () => void; size?: number; onTicket?: boolean }) {
  const { t } = useTranslation();
  const { avatarUrl, initials } = useUserAvatar();

  return (
    <PressableScale onPress={onPress} haptic="tap" hitSlop={Math.max(0, (44 - size) / 2)} accessibilityRole="button" accessibilityLabel={t("home.bar.profile")}>
      <View
        width={size}
        height={size}
        rounded={999}
        overflow="hidden"
        bg={onTicket ? undefined : "$surface"}
        style={onTicket ? { backgroundColor: TICKET_CONTROL } : undefined}
        items="center"
        justify="center"
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
        ) : (
          <Text color={onTicket ? "$slabInk" : "$ink"} allowFontScaling={false} style={{ fontFamily: fontFace.display[700], fontSize: Math.round(size * 0.36) }}>
            {initials}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

/** Barra de arriba sobre `canvas`: avatar, buscador (desde 1.3, un botón) y la campana con su contador amarillo. */
function TopBar({ onProfile, onSearch, onNotifications, attentionCount, hasUnread = false, large }: HomeHeroProps & { large: boolean }) {
  const { t } = useTranslation();

  return (
    <XStack items="center" gap={10} px={space[5]}>
      <ProfileAvatar onPress={onProfile} />

      {large ? (
        <>
          <View flex={1} />
          <PressableScale onPress={onSearch} haptic="tap" accessibilityRole="search" accessibilityLabel={t("home.bar.search")}>
            <View width={44} height={44} rounded={999} bg="$surface" items="center" justify="center">
              <Search size={20} color="$ink" strokeWidth={2} />
            </View>
          </PressableScale>
        </>
      ) : (
        <PressableScale onPress={onSearch} style={{ flex: 1 }} scaleTo={0.99} accessibilityRole="search" accessibilityLabel={t("home.bar.search")}>
          <XStack height={44} px={space[4]} gap={8} items="center" rounded={radius.pill} bg="$surface">
            <Search size={18} color="$inkFaint" strokeWidth={2} />
            <FText tone="inkFaint" numberOfLines={1} maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontSize: 15, lineHeight: 20 }}>
              {t("home.bar.search")}
            </FText>
          </XStack>
        </PressableScale>
      )}

      <PressableScale
        onPress={onNotifications}
        haptic="tap"
        accessibilityRole="button"
        accessibilityLabel={t("home.bar.notifications", { count: attentionCount })}
      >
        <View width={44} height={44} rounded={999} bg="$surface" items="center" justify="center">
          <Bell size={20} color="$ink" strokeWidth={2} />
          {attentionCount > 0 ? (
            <View
              position="absolute"
              t={-3}
              r={-3}
              minW={20}
              height={20}
              px={4}
              rounded={999}
              bg="$brand"
              items="center"
              justify="center"
              borderWidth={2}
              borderColor="$canvas"
            >
              <Text color="$onBrand" allowFontScaling={false} style={{ ...textStyles["figure-caption"], fontFamily: fontFace.mono[600], fontSize: 11, lineHeight: 13 }}>
                {attentionCount > 9 ? "9+" : attentionCount}
              </Text>
            </View>
          ) : hasUnread ? (
            <View position="absolute" t={2} r={2} width={12} height={12} rounded={999} bg="$brand" borderWidth={2} borderColor="$canvas" />
          ) : null}
        </View>
      </PressableScale>
    </XStack>
  );
}

/**
 * El saldo, como un carrusel circular de cuentas: "Todas las cuentas" y luego
 * cada cuenta; después de la última vuelve a la primera. El número sigue al
 * dedo 1:1; al soltar sale hacia el lado del gesto heredando su velocidad y
 * la siguiente página entra desde el lado contrario con `spring-gesture`.
 * Un toque oculta o muestra los montos. El saldo va a 50/700 y no escala con
 * el tamaño de letra del sistema.
 */
function SwipeableBalance({
  page,
  index,
  count,
  unavailable,
  onIndexChange,
  onRefresh,
}: {
  page: HeroPage;
  index: number;
  count: number;
  unavailable?: boolean;
  onIndexChange: (i: number) => void;
  onRefresh?: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const { amountsVisible, isHydrated, toggleAmountsVisibility } = useSensitiveAmounts();
  const visible = isHydrated && amountsVisible;
  const [width, setWidth] = useState(0);
  const dx = useSharedValue(0);
  const enterFrom = useRef(0);

  // Cuando React ya pintó la página nueva, entra desde el lado contrario al gesto.
  useEffect(() => {
    if (enterFrom.current === 0) return;
    const from = enterFrom.current;
    enterFrom.current = 0;
    if (reduceMotion) {
      dx.value = 0;
      return;
    }
    dx.value = from * Math.max(width, 1) * 0.45;
    dx.value = withSpring(0, motion.springGesture);
  }, [index, dx, reduceMotion, width]);

  const commit = (direction: 1 | -1) => {
    haptics.select();
    enterFrom.current = direction;
    onIndexChange((index + direction + count) % count);
  };
  const toggle = () => {
    haptics.select();
    toggleAmountsVisibility();
  };

  const pan = Gesture.Pan()
    .enabled(count > 1)
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      dx.value = e.translationX;
    })
    .onEnd((e) => {
      const passed = Math.abs(e.translationX) > SWIPE_DISTANCE || Math.abs(e.velocityX) > 600;
      if (!passed) {
        dx.value = withSpring(0, { ...motion.springGesture, velocity: e.velocityX });
        return;
      }
      const direction = e.translationX < 0 ? 1 : -1;
      // Sale del lado hacia donde iba el dedo, con su velocidad, y al terminar cambia de página.
      dx.value = withSpring(
        -direction * Math.max(width, 1) * 0.6,
        { damping: 28, stiffness: 420, mass: 0.8, velocity: e.velocityX, overshootClamping: true },
        (finished) => {
          if (finished) runOnJS(commit)(direction as 1 | -1);
        },
      );
    });
  // El toque para ocultar montos va en un `Pressable` de RN y no en un `Gesture.Tap`: en Android el Tap de
  // gesture-handler se activaba aunque el dedo cayera sobre un toast encima (el "Deshacer" tras registrar).
  // Cuando el Pan se activa, gesture-handler cancela el toque de RN, así deslizar no oculta nada.

  const style = useAnimatedStyle(() => {
    const w = Math.max(width, 1);
    return {
      transform: [{ translateX: dx.value }],
      opacity: interpolate(Math.abs(dx.value), [0, w * 0.6], [1, 0], Extrapolation.CLAMP),
    };
  });

  const parts = amountParts(page.balance, page.currency);
  // Ancho aproximado del saldo (los dígitos de Plex miden 0.6em): la parte entera a 50px y el símbolo y los decimales a 29px.
  const skeletonWidth = Math.round(parts.integer.length * 50 * 0.6 + (parts.symbol.length + parts.fraction.length + 2) * 29 * 0.6);
  const hero = { fontFamily: fontFace.mono[600], fontSize: 50, lineHeight: 56, letterSpacing: -1 };
  const minor = { fontFamily: fontFace.mono[500], fontSize: 25, letterSpacing: 0 };
  const cents = { fontFamily: fontFace.mono[600], fontSize: 29, letterSpacing: 0 };
  const change = page.monthChange;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[{ alignSelf: "stretch", marginTop: 16 }, style]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={
          unavailable
            ? `${page.label}: ${t("states.errorTitle")}`
            : visible
              ? `${page.label}: ${parts.sign}${parts.symbol} ${parts.integer.replaceAll(THIN_SPACE, "")}.${parts.fraction}`
              : t("privacy.amounts.hiddenLabel")
        }
        accessibilityHint={t("home.balanceHint")}
        accessibilityActions={[
          { name: "increment" },
          { name: "decrement" },
          { name: "activate" },
          ...(onRefresh ? [{ name: "refresh", label: t("home.refresh.action") }] : []),
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "increment") commit(1);
          else if (e.nativeEvent.actionName === "decrement") commit(-1);
          else if (e.nativeEvent.actionName === "refresh") onRefresh?.();
          else toggle();
        }}
      >
        <Pressable onPress={toggle} accessible={false}>
          {unavailable ? (
            <Text allowFontScaling={false} numberOfLines={1} style={{ ...hero, color: theme.slabMuted.val }}>
              {`${parts.symbol}${THIN_SPACE}—`}
            </Text>
          ) : visible ? (
            // Un solo Text con tramos anidados: el símbolo, la parte entera y los decimales comparten línea base.
            <Animated.View key="shown" entering={FadeIn.duration(motion.fade.duration)}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                allowFontScaling={false}
                style={{ ...hero, color: theme.slabInk.val, includeFontPadding: false }}
              >
                <Text allowFontScaling={false} style={{ ...minor, color: theme.slabMuted.val }}>
                  {parts.sign}
                  {parts.symbol}
                  {THIN_SPACE}
                </Text>
                {parts.integer}
                <Text allowFontScaling={false} style={{ ...cents, color: theme.slabMuted.val }}>.{parts.fraction}</Text>
              </Text>
            </Animated.View>
          ) : isHydrated ? (
            // Montos ocultos: el símbolo se queda y los dígitos pasan a "••••••", a 40 para que no salte el alto.
            <Animated.View key="hidden" entering={FadeIn.duration(motion.fade.duration)}>
              <Text allowFontScaling={false} numberOfLines={1} style={{ ...hero, fontSize: 40, color: theme.slabInk.val }}>
                <Text allowFontScaling={false} style={{ ...minor, fontSize: 20, color: theme.slabMuted.val }}>
                  {parts.symbol}
                  {THIN_SPACE}
                </Text>
                ••••••
              </Text>
            </Animated.View>
          ) : (
            // Mientras se lee la preferencia de montos, un esqueleto del ancho del saldo: ni puntos que luego saltan ni un hueco.
            <XStack height={hero.lineHeight} items="center">
              <AmountSkeleton onSlab width={skeletonWidth} height={40} />
            </XStack>
          )}

          <XStack items="center" gap={8} mt={6} minH={24} flexWrap="wrap">
            {unavailable ? null : visible && change != null && change !== 0 ? (
              <XStack height={24} px={8} gap={3} items="center" rounded={radius.pill} style={{ backgroundColor: fintPalette.light.ink }}>
                {change > 0 ? <ArrowUp size={12} color={ON_INK_IN} strokeWidth={2.6} /> : <ArrowDown size={12} color={ON_INK_OUT} strokeWidth={2.6} />}
                <Amount
                  value={change}
                  currency={page.currency}
                  kind={change > 0 ? "income" : "expense"}
                  variant="amount-sm"
                  maxFontSizeMultiplier={COMPACT_FONT_SCALE}
                  style={{ fontFamily: fontFace.mono[600], fontSize: 12, lineHeight: 16, color: change > 0 ? ON_INK_IN : ON_INK_OUT }}
                />
              </XStack>
            ) : !isHydrated ? (
              <AmountSkeleton onSlab width={110} height={14} />
            ) : null}
            {!unavailable && visible && change != null && change !== 0 ? (
              <FText tone="slabMuted" maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.sans[600], fontSize: 13, lineHeight: 18 }}>
                {t("home.thisMonth")}
              </FText>
            ) : null}
          </XStack>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

function Dots({ count, index }: { count: number; index: number }) {
  if (count < 2) return null;
  return (
    <XStack gap={6} mt={space[3]} self="center" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} active={i === index} />
      ))}
    </XStack>
  );
}

/** La marca activa se estira y las demás se encogen con `spring-ui`. Tinta la activa y `line` las demás. */
function Dot({ active }: { active: boolean }) {
  const theme = useTheme();
  const w = useSharedValue(active ? 16 : 6);
  useEffect(() => {
    w.value = withSpring(active ? 16 : 6, motion.springUi);
  }, [active, w]);
  const style = useAnimatedStyle(() => ({ width: w.value }));
  return <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: active ? theme.ink.val : theme.lineStrong.val }, style]} />;
}

/**
 * Acción de la boleta: ficha de 46 con radio 16 en tinta al 8 % y la etiqueta debajo. `wide` es la versión de la
 * grilla 2 × 2 de texto grande: ícono y etiqueta en línea, 44 de alto como mínimo. Con `soon`, se ve pero no se
 * puede usar: atenuada y con "Pronto" sobre la ficha.
 */
function HeroAction({ label, icon, onPress, soon = false, wide = false }: { label: string; icon: ReactNode; onPress: () => void; soon?: boolean; wide?: boolean }) {
  const { t } = useTranslation();
  const badge = soon ? (
    <View position="absolute" t={-8} self="center">
      <SoonBadge onSlab />
    </View>
  ) : null;
  return (
    <PressableScale
      onPress={onPress}
      soon={soon}
      haptic="tap"
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={soon ? t("comingSoon.tapHint") : undefined}
      style={wide ? undefined : { alignItems: "center" }}
    >
      {wide ? (
        <XStack minH={44} gap={10} p={10} items="center" rounded={16} style={{ backgroundColor: TICKET_CHIP }}>
          {icon}
          <FText tone="slabInk" maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.sans[600], fontSize: 16, lineHeight: 21, flexShrink: 1 }}>
            {label}
          </FText>
          {badge}
        </XStack>
      ) : (
        <YStack items="center" gap={6}>
          <View width={46} height={46} rounded={16} items="center" justify="center" style={{ backgroundColor: TICKET_CHIP }}>
            {icon}
            {badge}
          </View>
          <FText tone="slabInk" numberOfLines={1} maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.sans[600], fontSize: 12, lineHeight: 16 }}>
            {label}
          </FText>
        </YStack>
      )}
    </PressableScale>
  );
}
