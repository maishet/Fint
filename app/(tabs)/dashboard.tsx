import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, YStack, useTheme } from "tamagui";
import { DataStateCard } from "../../src/components/DataStateCard";
import { floatingTabBarHeight } from "../../src/components/FintTabBar";
import { MoreSheet } from "../../src/components/RecordSheet";
import { SkeletonBlock, SkeletonContentCard } from "../../src/components/Skeleton";
import { AttentionRail } from "../../src/home/AttentionRail";
import { GettingStartedCard } from "../../src/home/GettingStartedCard";
import { HomeHero, SHEET_OVERLAP, type HeroPage } from "../../src/home/HomeHero";
import { RecentMovementsCard } from "../../src/home/RecentMovementsCard";
import { SpendingCard } from "../../src/home/SpendingCard";
import { useHomeData } from "../../src/home/useHomeData";
import { radius, space } from "../../src/theme/tokens";
import { Amount, FText } from "../../src/ui";

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

  const needsSetup = overview && (overview.accountCount === 0 || overview.recentTransactions.length === 0);

  return (
    <View flex={1} bg="$canvas">
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={home.isRefreshing}
            onRefresh={() => void home.refetchAll()}
            tintColor={theme.slabInk.val}
            colors={[theme.brand.val]}
            progressBackgroundColor={theme.surface.val}
          />
        }
      >
        {/* Al tirar hacia abajo se ve losa, no el fondo claro. */}
        <View position="absolute" t={-1000} l={0} r={0} height={1000} bg="$slab" />

        <HomeHero
          pages={pages}
          index={pageIndex}
          onIndexChange={setPageIndex}
          scrollY={scrollY}
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

        <YStack
          flex={1}
          bg="$canvas"
          mt={-SHEET_OVERLAP}
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
      </Animated.ScrollView>

      {/* Cuando la hoja cubre el hero, el saldo viaja a una barra compacta arriba. */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top, backgroundColor: theme.slab.val }, compactStyle]}
      >
        <View height={48} items="center" justify="center" px={space[4]}>
          <FText variant="caption" tone="slabMuted" numberOfLines={1}>
            {page?.label}
          </FText>
          {page ? <Amount value={page.balance} currency={page.currency} variant="amount" onSlab /> : null}
        </View>
      </Animated.View>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </View>
  );
}
