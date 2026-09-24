import { ArrowDown, ArrowUp, Bell, ChevronDown, Ellipsis, ReceiptText, ScanLine, Search, Wallet } from "@tamagui/lucide-icons-2";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, View, XStack, YStack, useTheme } from "tamagui";
import { useAuth } from "../auth/AuthProvider";
import { resolveDisplayName } from "../auth/displayName";
import { amountParts, THIN_SPACE } from "../finance/formatAmount";
import { useSensitiveAmounts } from "../privacy/SensitiveAmountsProvider";
import { motion, radius, space } from "../theme/tokens";
import { fontFace, textStyles } from "../theme/typography";
import { Amount, FText, PressableScale } from "../ui";
import { AmountSkeleton } from "../ui/AmountSkeleton";
import { riseIn } from "../ui/entering";
import { haptics } from "../ui/haptics";
import { HeroMesh } from "./HeroMesh";

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
  /** Tirón hacia abajo desde el tope, para que la malla se estire con el hero. */
  pull?: SharedValue<number>;
  attentionCount: number;
  onProfile: () => void;
  onSearch: () => void;
  onNotifications: () => void;
  onAccounts: () => void;
  onScan: () => void;
  onPay: () => void;
  onMore: () => void;
}

/** Espacio que la hoja de contenido monta sobre el borde del hero. */
export const SHEET_OVERLAP = 26;
const SWIPE_DISTANCE = 60;

/**
 * El hero de tinta: saldo centrado, píldora de cuenta, variación del mes,
 * puntos de página y cuatro acciones. Es oscuro en los dos temas.
 */
export function HomeHero(props: HomeHeroProps) {
  const { pages, index, onIndexChange, scrollY, attentionCount } = props;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const page = pages[Math.min(index, pages.length - 1)];
  // La moneda va en la píldora: el saldo nunca suma monedas distintas, así que se dice en cuál está.
  const pillLabel = page ? `${page.label} · ${page.currency}` : t("home.accountsAll");

  const actionsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 120], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(scrollY.value, [0, 120], [1, 0.94], Extrapolation.CLAMP) }],
  }));
  const balanceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [60, 180], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [60, 180], [0, -30], Extrapolation.CLAMP) }],
  }));

  return (
    <View
      bg="$slab"
      pt={insets.top + 8}
      pb={SHEET_OVERLAP + space[6]}
      onLayout={(e: LayoutChangeEvent) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {/* Sin overflow oculto: al tirar, la malla sube al hueco sobre el hero; abajo la tapa la hoja. */}
      <HeroMesh width={size.width} height={size.height} scrollY={scrollY} pull={props.pull} />

      <TopBar {...props} attentionCount={attentionCount} />

      <Animated.View style={balanceStyle}>
        <YStack items="center" mt={space[5]} gap={space[2]}>
          <PressableScale onPress={props.onAccounts} haptic="tap" accessibilityRole="button" accessibilityLabel={pillLabel}>
            <XStack
              height={32}
              px={14}
              gap={6}
              items="center"
              rounded={radius.pill}
              bg="$glassSlab"
              borderWidth={1}
              borderColor="$glassSlabLine"
            >
              <FText variant="label" tone="slabInk" numberOfLines={1} style={{ maxWidth: 220 }}>
                {pillLabel}
              </FText>
              <ChevronDown size={14} color="$slabInk" strokeWidth={2.2} />
            </XStack>
          </PressableScale>

          {page ? <SwipeableBalance page={page} index={index} count={pages.length} onIndexChange={onIndexChange} /> : null}

          <Dots count={pages.length} index={index} />
        </YStack>
      </Animated.View>

      <Animated.View style={actionsStyle}>
        {/* Entran subiendo 12px, escalonadas 40ms por botón. */}
        <XStack justify="space-between" px={space[6]} mt={space[6]}>
          {[
            { key: "accounts", icon: <Wallet size={20} color="$slabInk" strokeWidth={1.8} />, onPress: props.onAccounts },
            { key: "scan", icon: <ScanLine size={20} color="$slabInk" strokeWidth={1.8} />, onPress: props.onScan },
            { key: "pay", icon: <ReceiptText size={20} color="$slabInk" strokeWidth={1.8} />, onPress: props.onPay },
            { key: "more", icon: <Ellipsis size={20} color="$slabInk" strokeWidth={1.8} />, onPress: props.onMore },
          ].map((action, i) => (
            <Animated.View key={action.key} entering={riseIn({ distance: 12, delay: i * 40, reduceMotion })}>
              <HeroAction label={t(`home.actions.${action.key}`)} icon={action.icon} onPress={action.onPress} />
            </Animated.View>
          ))}
        </XStack>
      </Animated.View>
    </View>
  );
}

/** El avatar de la persona sobre la losa: abre Ajustes y perfil. Lo usan la barra del hero y la barra colapsada. */
export function ProfileAvatar({ onPress, size = 40 }: { onPress: () => void; size?: number }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const metadata = session?.user.user_metadata ?? {};
  const avatarUrl =
    typeof metadata.avatar_url === "string" ? metadata.avatar_url : typeof metadata.picture === "string" ? metadata.picture : null;
  const displayName = resolveDisplayName(session);
  const initials =
    displayName
      ?.split(/[\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "F";

  return (
    <PressableScale onPress={onPress} haptic="tap" accessibilityRole="button" accessibilityLabel={t("home.bar.profile")}>
      <View width={size} height={size} rounded={999} overflow="hidden" bg="$glassSlab" borderWidth={1} borderColor="$glassSlabLine" items="center" justify="center">
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
        ) : (
          <Text color="$slabInk" style={{ fontFamily: fontFace.display[600], fontSize: Math.round(size * 0.35) }}>
            {initials}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

function TopBar({ onProfile, onSearch, onNotifications, attentionCount }: HomeHeroProps) {
  const { t } = useTranslation();

  return (
    <XStack items="center" gap={space[2]} px={space[4]}>
      <ProfileAvatar onPress={onProfile} />

      <PressableScale onPress={onSearch} style={{ flex: 1 }} scaleTo={0.99} accessibilityRole="search" accessibilityLabel={t("home.bar.search")}>
        <XStack height={40} px={14} gap={8} items="center" rounded={radius.pill} bg="$glassSlab" borderWidth={1} borderColor="$glassSlabLine">
          <Search size={16} color="$slabInk" strokeWidth={2} />
          <FText variant="label" tone="slabInk" numberOfLines={1} style={{ opacity: 0.86 }}>
            {t("home.bar.search")}
          </FText>
        </XStack>
      </PressableScale>

      <PressableScale
        onPress={onNotifications}
        haptic="tap"
        accessibilityRole="button"
        accessibilityLabel={t("home.bar.notifications", { count: attentionCount })}
      >
        <View width={40} height={40} rounded={999} bg="$glassSlab" borderWidth={1} borderColor="$glassSlabLine" items="center" justify="center">
          <Bell size={18} color="$slabInk" strokeWidth={1.8} />
          {attentionCount > 0 ? (
            <View
              position="absolute"
              t={-2}
              r={-2}
              minW={18}
              height={18}
              px={4}
              rounded={999}
              bg="$slabInk"
              items="center"
              justify="center"
              borderWidth={2}
              borderColor="$slab"
            >
              <Text color="$slab" style={{ ...textStyles["figure-caption"], fontFamily: fontFace.mono[600], fontSize: 10, lineHeight: 12 }}>
                {attentionCount > 9 ? "9+" : attentionCount}
              </Text>
            </View>
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
 * Un toque oculta o muestra los montos.
 */
function SwipeableBalance({
  page,
  index,
  count,
  onIndexChange,
}: {
  page: HeroPage;
  index: number;
  count: number;
  onIndexChange: (i: number) => void;
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
  const digitCount = parts.integer.replaceAll(THIN_SPACE, "").length + parts.fraction.length;
  // Ancho aproximado del saldo en Geist Mono: la parte entera a 48px y el símbolo y los decimales a 26px.
  const skeletonWidth = Math.round(parts.integer.length * 48 * 0.6 + (parts.symbol.length + parts.fraction.length + 2) * 26 * 0.6);
  const hero = textStyles["amount-hero"];
  const minor = { ...textStyles["amount-hero-cents"], lineHeight: undefined, letterSpacing: -0.4 };

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[{ alignSelf: "stretch" }, style]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={visible ? `${page.label}: ${parts.sign}${parts.symbol} ${parts.integer.replaceAll(THIN_SPACE, "")}.${parts.fraction}` : t("privacy.amounts.hiddenLabel")}
        accessibilityHint={t("home.balanceHint")}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }, { name: "activate" }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "increment") commit(1);
          else if (e.nativeEvent.actionName === "decrement") commit(-1);
          else toggle();
        }}
      >
        <Pressable onPress={toggle} accessible={false}>
          {visible ? (
            // Un solo Text con tramos anidados: el símbolo, la parte entera y los decimales comparten línea base.
            <Animated.View key="shown" entering={FadeIn.duration(motion.fade.duration)}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                style={{ ...hero, color: theme.slabInk.val, textAlign: "center", includeFontPadding: false, paddingHorizontal: space[4] }}
              >
                <Text style={{ ...minor, color: theme.slabMuted.val }}>
                  {parts.sign}
                  {parts.symbol}
                  {THIN_SPACE}
                </Text>
                {parts.integer}
                <Text style={{ ...minor, color: theme.slabInk.val }}>.{parts.fraction}</Text>
              </Text>
            </Animated.View>
          ) : isHydrated ? (
            <HiddenDigits count={digitCount} lineHeight={hero.lineHeight} reduceMotion={reduceMotion} />
          ) : (
            // Mientras se lee la preferencia de montos, un esqueleto del ancho del saldo: ni puntos que luego saltan ni un hueco.
            <XStack height={hero.lineHeight} items="center" justify="center">
              <AmountSkeleton onSlab width={skeletonWidth} height={40} />
            </XStack>
          )}

          {visible && page.monthChange != null && page.monthChange !== 0 ? (
            <XStack justify="center" items="center" gap={6} mt={4}>
              {page.monthChange > 0 ? (
                <ArrowUp size={14} color="$flowInSlab" strokeWidth={2.2} />
              ) : (
                <ArrowDown size={14} color="$flowOutSlab" strokeWidth={2.2} />
              )}
              <Amount
                value={page.monthChange}
                currency={page.currency}
                kind={page.monthChange > 0 ? "income" : "expense"}
                tone={page.monthChange > 0 ? "flowInSlab" : "flowOutSlab"}
                variant="amount-sm"
                onSlab
              />
              <FText variant="caption" tone="slabMuted">
                {t("home.thisMonth")}
              </FText>
            </XStack>
          ) : !isHydrated ? (
            <XStack height={22} mt={4} items="center" justify="center">
              <AmountSkeleton onSlab width={150} height={12} />
            </XStack>
          ) : (
            <View height={22} />
          )}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Montos ocultos: cada dígito se vuelve un punto de 12px en `slabMuted`. Los
 * puntos giran a su lugar con `spring-ui`, escalonados 24ms de derecha a
 * izquierda. Ocupa el mismo alto que el saldo para que el hero no salte.
 */
function HiddenDigits({ count, lineHeight, reduceMotion }: { count: number; lineHeight: number; reduceMotion: boolean }) {
  const theme = useTheme();
  const spring = motion.springUi;
  const duration = motion.fade.duration;
  return (
    <XStack height={lineHeight} items="center" justify="center" gap={10} px={space[4]}>
      {Array.from({ length: count }, (_, i) => {
        const delay = (count - 1 - i) * 24;
        const entering = () => {
          "worklet";
          if (reduceMotion) return { initialValues: { opacity: 0 }, animations: { opacity: withTiming(1, { duration }) } };
          return {
            initialValues: { opacity: 0, transform: [{ rotateX: "90deg" }, { scale: 0.4 }] },
            animations: {
              opacity: withDelay(delay, withTiming(1, { duration: 120 })),
              transform: [{ rotateX: withDelay(delay, withSpring("0deg", spring)) }, { scale: withDelay(delay, withSpring(1, spring)) }],
            },
          };
        };
        return (
          <Animated.View
            key={i}
            entering={entering}
            style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.slabMuted.val }}
          />
        );
      })}
    </XStack>
  );
}

function Dots({ count, index }: { count: number; index: number }) {
  if (count < 2) return null;
  return (
    <XStack gap={6} mt={space[2]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} active={i === index} />
      ))}
    </XStack>
  );
}

/** La marca activa se estira y las demás se encogen con `spring-ui`. */
function Dot({ active }: { active: boolean }) {
  const theme = useTheme();
  const w = useSharedValue(active ? 16 : 6);
  useEffect(() => {
    w.value = withSpring(active ? 16 : 6, motion.springUi);
  }, [active, w]);
  const style = useAnimatedStyle(() => ({ width: w.value }));
  return (
    <Animated.View
      style={[{ height: 6, borderRadius: 3, backgroundColor: active ? theme.slabInk.val : theme.glassSlabLine.val }, style]}
    />
  );
}

function HeroAction({ label, icon, onPress }: { label: string; icon: ReactNode; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} haptic="tap" scaleTo={0.94} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: "center", width: 64 }}>
      <YStack items="center" gap={6}>
        <View width={52} height={52} rounded={999} bg="$glassSlab" borderWidth={1} borderColor="$glassSlabLine" items="center" justify="center">
          {icon}
        </View>
        <FText variant="label" tone="slabInk" numberOfLines={1}>
          {label}
        </FText>
      </YStack>
    </PressableScale>
  );
}
