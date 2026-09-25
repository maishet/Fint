import { Search } from "@tamagui/lucide-icons-2";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack, useTheme } from "tamagui";
import { DataStateCard } from "../../src/components/DataStateCard";
import { floatingTabBarHeight } from "../../src/components/FintTabBar";
import { MoreSheet } from "../../src/components/RecordSheet";
import { SkeletonBlock, SkeletonContentCard } from "../../src/components/Skeleton";
import { AttentionRail } from "../../src/home/AttentionRail";
import { GettingStartedCard } from "../../src/home/GettingStartedCard";
import { HomeHero, ProfileAvatar, SHEET_OVERLAP, type HeroPage } from "../../src/home/HomeHero";
import { RecentMovementsCard } from "../../src/home/RecentMovementsCard";
import { SpendingCard } from "../../src/home/SpendingCard";
import { useHomeData } from "../../src/home/useHomeData";
import { motion, radius, space } from "../../src/theme/tokens";
import { useScreenStatusBar } from "../../src/theme/useScreenStatusBar";
import { Amount, FintSpinner, FText, PressableScale } from "../../src/ui";
import { riseIn } from "../../src/ui/entering";
import { haptics } from "../../src/ui/haptics";

/** Tirón (ya con goma) que dispara el refresco. */
const PULL_TRIGGER = 80;
/** Lo que el hero queda abierto mientras refresca, con el spinner en el hueco. */
const PULL_HOLD = 56;
/** Cuánto hay que mover el dedo hacia abajo antes de que el tirón se active. */
const PULL_SLOP = 10;

/** Función de goma: cuanto más se tira, menos se estira. */
function rubberBand(distance: number) {
  "worklet";
  const dimension = 320;
  return (1 - 1 / ((distance * 0.55) / dimension + 1)) * dimension;
}

/**
 * Inicio v3. Responde tres preguntas, en orden: ¿cuánto tengo? (el hero),
 * ¿tengo algo que hacer? (los avisos) y ¿cómo voy este mes y en qué se me va?
 * (movimientos y gasto del mes). Todo el análisis vive en Reportes.
 */
export default function DashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [pageIndex, setPageIndex] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  // Primero se resuelve la cuenta mirada en el hero; con ella se filtra el gasto del mes.
  const [accountsForPages, setAccountsForPages] = useState<{ id: string; name: string }[]>([]);
  const selectedAccount = pageIndex > 0 ? (accountsForPages[pageIndex - 1] ?? null) : null;
  const home = useHomeData(selectedAccount);
  const { overview } = home;

  const sortedAccounts = useMemo(() => [...home.accounts].sort((a, b) => b.balance - a.balance), [home.accounts]);
  if (sortedAccounts.length !== accountsForPages.length || sortedAccounts.some((a, i) => a.id !== accountsForPages[i]?.id)) {
    setAccountsForPages(sortedAccounts.map((a) => ({ id: a.id, name: a.name })));
  }

  const pages: HeroPage[] = useMemo(
    () => [
      {
        key: "all",
        label: t("home.accountsAll"),
        balance: overview?.netWorth ?? 0,
        currency: overview?.currency ?? "PEN",
        // Mientras el backend no mande `netWorthChangeMonth`, lo más cercano es lo ahorrado en el mes.
        monthChange: overview?.currentMonth.savings ?? null,
      },
      ...sortedAccounts.map((a) => ({ key: a.id, label: a.name, balance: a.balance, currency: a.currency })),
    ],
    [overview, sortedAccounts, t],
  );
  const page = pages[Math.min(pageIndex, pages.length - 1)];

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [140, 200], [0, 1], Extrapolation.CLAMP),
  }));
  // La barra compacta solo recibe toques (y se anuncia al lector de pantalla) cuando ya se ve.
  const [compactActive, setCompactActive] = useState(false);
  useAnimatedReaction(
    () => scrollY.value > 170,
    (active, previous) => {
      if (active !== previous) runOnJS(setCompactActive)(active);
    },
  );
  // El hero y la barra compacta son oscuros en los dos temas: iconos claros.
  useScreenStatusBar("light");
  // Con la pestaña en segundo plano la pantalla se congela y ese aviso puede perderse: al volver, se resincroniza.
  useFocusEffect(
    useCallback(() => {
      setCompactActive(scrollY.value > 170);
    }, [scrollY]),
  );

  // Tirar hacia abajo desde el tope: el hero se estira con goma, la malla con él, y pasados 80px refresca.
  // El gesto solo se activa arriba del todo y hacia abajo; en cualquier otro caso falla enseguida y no le
  // quita nada al scroll, al carrusel del saldo ni al arrastre de Ritmo.
  const reduceMotion = useReducedMotion();
  const pull = useSharedValue(0);
  const touchStart = useSharedValue({ x: 0, y: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const refreshingNow = useSharedValue(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await home.refetchAll();
    } finally {
      setRefreshing(false);
    }
  }, [home]);
  useEffect(() => {
    refreshingNow.value = refreshing;
    if (!refreshing) pull.value = withSpring(0, motion.springUi);
  }, [pull, refreshing, refreshingNow]);

  const pullGesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((e, manager) => {
      const touch = e.allTouches[0];
      touchStart.value = { x: touch?.absoluteX ?? 0, y: touch?.absoluteY ?? 0 };
      if (scrollY.value > 0.5 || refreshingNow.value) manager.fail();
    })
    .onTouchesMove((e, manager) => {
      const touch = e.allTouches[0];
      if (!touch) return;
      const dx = touch.absoluteX - touchStart.value.x;
      const dy = touch.absoluteY - touchStart.value.y;
      if (Math.abs(dx) > PULL_SLOP && Math.abs(dx) > dy) manager.fail();
      else if (dy > PULL_SLOP) manager.activate();
      else if (dy < -4) manager.fail();
    })
    .onUpdate((e) => {
      pull.value = rubberBand(Math.max(0, e.translationY - PULL_SLOP));
    })
    .onEnd(() => {
      if (pull.value > PULL_TRIGGER) {
        pull.value = withSpring(PULL_HOLD, motion.springUi);
        refreshingNow.value = true;
        runOnJS(haptics.select)();
        runOnJS(refresh)();
      } else {
        pull.value = withSpring(0, { ...motion.springUi, velocity: 0 });
      }
    });

  const pullStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pull.value }] }));
  const spinnerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pull.value, [16, PULL_HOLD], [0, 1], Extrapolation.CLAMP),
    transform: [{ rotate: `${Math.min(pull.value / PULL_TRIGGER, 1) * 270}deg` }],
  }));

  const needsSetup = overview && (overview.accountCount === 0 || overview.recentTransactions.length === 0);

  return (
    <View flex={1} bg="$canvas">
      <GestureDetector gesture={pullGesture}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          // El estiramiento lo hace el tirón propio: sin el rebote de iOS ni el estirado de Android 12+.
          bounces={false}
          overScrollMode="never"
        >
          <Animated.View style={[{ flexGrow: 1 }, pullStyle]}>
            {/* Al tirar hacia abajo se ve losa, no el fondo claro: el hueco sobre el hero es losa. Se mete 2px
                bajo el hero porque con el desplazamiento fraccional quedaba una costura de 1px. */}
            <View position="absolute" t={-1000} l={0} r={0} height={1002} bg="$slab" />

            <HomeHero
              pages={pages}
              index={pageIndex}
              onIndexChange={setPageIndex}
              scrollY={scrollY}
              pull={pull}
              attentionCount={home.attention.length}
              onProfile={() => router.push("/settings")}
              onSearch={() => router.push("/(tabs)/movements")}
              onNotifications={() =>
                router.push(home.attention.length > 0 && home.attention.every((a) => a.kind === "review") ? "/pending-movements" : "/(tabs)/debts")
              }
              onAccounts={() => router.push("/accounts")}
              onScan={() => router.push("/capture-import")}
              onPay={() => router.push("/(tabs)/debts")}
              onMore={() => setMoreOpen(true)}
            />

            {/* La hoja entra subiendo 40px con spring-ui. */}
            <Animated.View entering={riseIn({ distance: 40, reduceMotion })} style={{ flexGrow: 1, marginTop: -SHEET_OVERLAP }}>
              <YStack
                flex={1}
                bg="$canvas"
                pt={space[3]}
                gap={space[6]}
                pb={floatingTabBarHeight(insets.bottom) + space[10]}
                style={{ borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }}
              >
                <View self="center" width={36} height={5} rounded={999} bg="$line" />

                {home.isLoading ? (
                  <YStack px={space[4]} gap={space[6]}>
                    <SkeletonBlock height={62} />
                    <SkeletonContentCard rows={3} />
                    <SkeletonBlock height={280} />
                  </YStack>
                ) : home.error ? (
                  <YStack px={space[4]}>
                    <DataStateCard message={t("states.error")} onRetry={() => void home.refetchAll()} />
                  </YStack>
                ) : overview && needsSetup ? (
                  <GettingStartedCard
                    accountCount={overview.accountCount}
                    currency={overview.currency}
                    hasMovements={overview.recentTransactions.length > 0}
                  />
                ) : overview ? (
                  <>
                    <AttentionRail
                      items={home.attention}
                      upcoming={home.upcoming}
                      onOpen={(item) => router.push(item.kind === "review" ? "/pending-movements" : "/(tabs)/debts")}
                    />
                    <RecentMovementsCard transactions={overview.recentTransactions} />
                    <SpendingCard
                      currency={overview.currency}
                      series={home.spending}
                      categories={home.categories}
                      accountLabel={page?.label ?? t("home.accountsAll")}
                      loading={home.isSpendingLoading}
                    />
                  </>
                ) : null}
              </YStack>
            </Animated.View>
          </Animated.View>
        </Animated.ScrollView>
      </GestureDetector>

      {/* El spinner del refresco, en el hueco que abre el tirón. */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: "absolute", top: insets.top + 12, left: 0, right: 0, alignItems: "center" }, spinnerStyle]}
      >
        {refreshing ? <FintSpinner color="$slabInk" size="large" /> : <View width={24} height={24} rounded={999} borderWidth={2.5} borderColor="$slabInk" style={{ borderTopColor: "transparent" }} />}
      </Animated.View>

      {/* Cuando la hoja cubre el hero, el saldo viaja a una barra compacta arriba, en el lugar del buscador:
          avatar, cuenta y saldo al centro, y el buscador como botón. */}
      <Animated.View
        pointerEvents={compactActive ? "auto" : "none"}
        accessibilityElementsHidden={!compactActive}
        importantForAccessibility={compactActive ? "auto" : "no-hide-descendants"}
        style={[{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top, backgroundColor: theme.slab.val }, compactStyle]}
      >
        <XStack height={56} items="center" gap={space[3]} px={space[4]}>
          <ProfileAvatar size={32} onPress={() => router.push("/settings")} />
          <YStack flex={1} minW={0} items="center">
            <FText variant="caption" tone="slabMuted" numberOfLines={1}>
              {page?.label}
            </FText>
            {page ? <Amount value={page.balance} currency={page.currency} variant="amount" onSlab /> : null}
          </YStack>
          <PressableScale
            onPress={() => router.push("/(tabs)/movements")}
            haptic="tap"
            accessibilityRole="search"
            accessibilityLabel={t("home.bar.search")}
          >
            <View width={32} height={32} rounded={999} bg="$glassSlab" borderWidth={1} borderColor="$glassSlabLine" items="center" justify="center">
              <Search size={15} color="$slabInk" strokeWidth={2} />
            </View>
          </PressableScale>
        </XStack>
      </Animated.View>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </View>
  );
}
