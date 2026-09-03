import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronRight,
  Landmark,
  Sparkles,
} from "@tamagui/lucide-icons-2";
import { Link, useRouter } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { PieChart } from "react-native-gifted-charts";
import {
  Button,
  H3,
  Paragraph,
  ScrollView,
  useTheme,
  XStack,
  YStack,
} from "tamagui";
import { financeApi } from "../../src/api/finance";
import type { Transaction } from "../../src/api/types";
import { DataStateCard } from "../../src/components/DataStateCard";
import { Screen } from "../../src/components/Screen";
import {
  SkeletonBlock,
  SkeletonContentCard,
  SkeletonGroup,
  SkeletonList,
  SkeletonSection,
} from "../../src/components/Skeleton";
import { getCategoryLabel } from "../../src/finance/categoryLabels";
import { getAppLocale } from "../../src/i18n";
import { FintButton, FintCard, FintSheetSelect } from "../../src/ui";
import { haptics } from "../../src/ui/haptics";
import { SensitiveAmountToggle } from "../../src/privacy/SensitiveAmountToggle";
import { useSensitiveMoney } from "../../src/privacy/useSensitiveMoney";

const ALL_ACCOUNTS = "__all__";

interface CategorySlice {
  name: string;
  amount: number;
  color: string;
}

interface WeeklyFlowPoint {
  label: string;
  income: number;
  expenses: number;
}

export default function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [expenseAccountId, setExpenseAccountId] = useState(ALL_ACCOUNTS);
  const overviewQuery = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: ({ signal }) => financeApi.getDashboardOverview(undefined, signal),  });
  const expenseQuery = useQuery({
    queryKey: [
      "dashboard",
      "expense-categories",
      overviewQuery.data?.currency,
      expenseAccountId,
    ],
    queryFn: ({ signal }) =>
      financeApi.getDashboardExpenseCategories(
        {
          currency: overviewQuery.data!.currency,
          ...(expenseAccountId !== ALL_ACCOUNTS
            ? { accountId: expenseAccountId }
            : {}),
        },
        signal,
      ),
    enabled: Boolean(overviewQuery.data?.currency),  });
  const overview = overviewQuery.data;
  const locale = getAppLocale(i18n.resolvedLanguage);
  const categoryColors = [
    theme.chart1.val,
    theme.chart2.val,
    theme.chart3.val,
    theme.chart4.val,
    theme.chart5.val,
  ];
  const categorySlices = (expenseQuery.data?.categories ?? []).map(
    (item, index) => ({
      name: getCategoryLabel(item.name, t),
      amount: item.amount,
      color: categoryColors[index % categoryColors.length],
    }),
  );
  const weeklyFlow = (overview?.weeklyFlow ?? []).map((item) => ({
    label: formatWeekLabel(item.start, item.end, locale),
    income: item.income,
    expenses: item.expenses,
  }));
  const isLoading = overviewQuery.isLoading;
  const isRefreshing = overviewQuery.isRefetching || expenseQuery.isRefetching;
  const error = overviewQuery.error;

  return (
    <Screen
      gap="$5"
      isRefreshing={isRefreshing}
      onRefresh={() => {
        void overviewQuery.refetch();
        void expenseQuery.refetch();
      }}
      ground={
        <DashboardGround
          currency={overview?.currency}
          expenses={overview?.currentMonth.expenses}
          income={overview?.currentMonth.income}
          isLoading={isLoading}
          netWorth={overview?.netWorth}
        />
      }
    >
      {isLoading ? (
        <DashboardSkeleton label={t("dashboard.loading")} />
      ) : null}
      {error ? (
        <DataStateCard
          message={t("states.error")}
          onRetry={() => {
            void overviewQuery.refetch();
          }}
        />
      ) : null}

      {!isLoading && !error && overview ? (
        <>
          {overview.accountCount === 0 ||
          overview.recentTransactions.length === 0 ? (
            <GettingStartedCard
              accountCount={overview.accountCount}
              currency={overview.currency}
              hasMovements={overview.recentTransactions.length > 0}
            />
          ) : null}

          <QuickActions />

          <WeeklyFlowSection currency={overview.currency} data={weeklyFlow} />

          <ExpenseCategoryCard
            accounts={expenseQuery.data?.accounts ?? []}
            currency={overview.currency}
            isLoading={expenseQuery.isLoading}
            selectedAccountId={expenseAccountId}
            slices={categorySlices}
            onAccountChange={setExpenseAccountId}
          />

          <AdviceCarousel
            currency={overview.currency}
            expenses={overview.currentMonth.expenses}
            income={overview.currentMonth.income}
            previousExpenses={overview.previousMonth.expenses}
            previousIncome={overview.previousMonth.income}
            savings={overview.currentMonth.savings}
          />

          <RecentMovements
            locale={locale}
            transactions={overview.recentTransactions}
          />
        </>
      ) : null}
    </Screen>
  );
}

function DashboardGround({
  currency,
  expenses,
  income,
  isLoading,
  netWorth,
}: {
  currency?: string;
  expenses?: number;
  income?: number;
  isLoading: boolean;
  netWorth?: number;
}) {
  const { t } = useTranslation();
  const { formatSensitiveAmount, formatSensitiveAmountOnly } =
    useSensitiveMoney();

  return (
    <YStack>
      {isLoading || netWorth === undefined ? (
        <YStack gap="$2">
          <SkeletonBlock height={14} width="40%" opacity={0.5} />
          <SkeletonBlock height={40} width="70%" opacity={0.5} />
        </YStack>
      ) : (
        <YStack gap="$5">
          <XStack items="flex-end" justify="space-between" gap="$4">
            <YStack flex={1} minW={0}>
              <Paragraph
                color="$heroMuted"
                fontSize={11}
                fontWeight="600"
                letterSpacing={1.4}
                textTransform="uppercase"
              >
                {t("dashboard.netWorth")}
              </Paragraph>
              <XStack items="baseline" gap="$2" mt="$2">
                <Paragraph color="$heroMuted" fontSize="$3" fontWeight="500">
                  {currency}
                </Paragraph>
                <Paragraph
                  color="$heroForeground"
                  fontFamily="$body"
                  fontSize={44}
                  fontWeight="600"
                  letterSpacing={-1.4}
                  lineHeight={46}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatSensitiveAmountOnly(netWorth)}
                </Paragraph>
              </XStack>
            </YStack>
            <SensitiveAmountToggle color="$heroAccent" inverse />
          </XStack>

          <YStack height={1} bg="rgba(246,251,252,0.13)" />

          <XStack gap="$5">
            <HeroMetric
              icon="income"
              label={t("dashboard.monthlyIncome")}
              value={formatSensitiveAmount(income ?? 0, currency)}
            />
            <YStack width={1} bg="rgba(246,251,252,0.13)" />
            <HeroMetric
              icon="expense"
              label={t("dashboard.monthlyExpenses")}
              value={formatSensitiveAmount(expenses ?? 0, currency)}
            />
          </XStack>
        </YStack>
      )}
    </YStack>
  );
}

function HeroMetric({
  icon,
  label,
  value,
}: {
  icon: "income" | "expense";
  label: string;
  value: string;
}) {
  const Icon = icon === "income" ? ArrowUp : ArrowDown;
  return (
    <YStack flex={1} gap="$1.5" minW={0}>
      <XStack items="center" gap="$1.5">
        <Icon
          size={13}
          color={icon === "income" ? "#8FD9BC" : "#E9A99F"}
          strokeWidth={2.2}
        />
        <Paragraph color="$heroMuted" fontSize="$1">
          {label}
        </Paragraph>
      </XStack>
      <Paragraph
        color="$heroForeground"
        fontFamily="$body"
        fontSize="$5"
        fontWeight="600"
        letterSpacing={-0.3}
        numberOfLines={1}
      >
        {value}
      </Paragraph>
    </YStack>
  );
}

function GettingStartedCard({
  accountCount,
  currency,
  hasMovements,
}: {
  accountCount: number;
  currency: string;
  hasMovements: boolean;
}) {
  const { t } = useTranslation();
  const needsAccount = accountCount === 0;
  return (
    <FintCard bg="$secondary" borderColor="$ring" gap="$4">
      <XStack items="center" gap="$3">
        <YStack
          width={42}
          height={42}
          rounded="$9"
          bg="$primary"
          items="center"
          justify="center"
        >
          <Sparkles size={21} color="$primaryForeground" />
        </YStack>
        <YStack flex={1} minW={0} gap="$1">
          <Paragraph
            color="$color12"
            fontFamily="$heading"
            fontSize="$5"
            fontWeight="600"
          >
            {t("onboarding.title")}
          </Paragraph>
          <Paragraph color="$color10" fontSize="$2">
            {t("onboarding.baseCurrency", { currency })}
          </Paragraph>
        </YStack>
      </XStack>
      <YStack gap="$2">
        <OnboardingStep
          complete={!needsAccount}
          label={t("onboarding.firstAccount")}
          number="1"
        />
        <OnboardingStep
          complete={hasMovements}
          label={t("onboarding.firstMovement")}
          number="2"
        />
      </YStack>
      <Link href={needsAccount ? "/account-form" : "/transaction-form"} asChild>
        <FintButton>
          {t(
            needsAccount
              ? "onboarding.createAccount"
              : "onboarding.createMovement",
          )}
        </FintButton>
      </Link>
    </FintCard>
  );
}

function OnboardingStep({
  complete,
  label,
  number,
}: {
  complete: boolean;
  label: string;
  number: string;
}) {
  return (
    <XStack items="center" gap="$2">
      <YStack
        width={26}
        height={26}
        rounded="$10"
        bg={complete ? "$green3" : "$muted"}
        items="center"
        justify="center"
      >
        {complete ? (
          <CheckCircle2 size={16} color="$green10" />
        ) : (
          <Paragraph color="$color10" fontSize="$1" fontWeight="600">
            {number}
          </Paragraph>
        )}
      </YStack>
      <Paragraph
        flex={1}
        minW={0}
        color={complete ? "$color10" : "$color12"}
        fontWeight={complete ? "500" : "600"}
        lineHeight="$4"
      >
        {label}
      </Paragraph>
    </XStack>
  );
}

function QuickActions() {
  const { t } = useTranslation();
  const actions: Array<{
    type: "income" | "expense" | "transfer";
    labelKey: string;
    icon: ReactNode;
  }> = [
    {
      type: "income",
      labelKey: "actions.newIncome",
      icon: <ArrowUp size={21} color="$success" strokeWidth={1.8} />,
    },
    {
      type: "expense",
      labelKey: "actions.newExpense",
      icon: <ArrowDown size={21} color="$destructive" strokeWidth={1.8} />,
    },
    {
      type: "transfer",
      labelKey: "actions.newTransfer",
      icon: <ArrowLeftRight size={21} color="$primary" strokeWidth={1.8} />,
    },
  ];

  return (
    <FintCard p={0} flexDirection="row" overflow="hidden">
      {actions.map((action, index) => (
        <XStack key={action.type} items="center" flex={1}>
          {index > 0 ? <YStack width={1} height={36} bg="$borderColor" /> : null}
          <Link
            href={{ pathname: "/transaction-form", params: { type: action.type } }}
            asChild
          >
            <YStack
              flex={1}
              height={76}
              items="center"
              justify="center"
              gap="$2"
              role="button"
              bg="transparent"
              transition="quick"
              pressStyle={{ scale: 0.97, bg: "$secondary" }}
              onPress={() => haptics.select()}
            >
              {action.icon}
              <Paragraph
                color="$color12"
                fontSize={12}
                fontWeight="500"
                numberOfLines={1}
              >
                {t(action.labelKey)}
              </Paragraph>
            </YStack>
          </Link>
        </XStack>
      ))}
    </FintCard>
  );
}

const WEEK_SPRING = { damping: 18, stiffness: 220, mass: 0.9 };

function WeeklyFlowSection({
  currency,
  data,
}: {
  currency: string;
  data: WeeklyFlowPoint[];
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatSensitiveAmount } = useSensitiveMoney();
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, data.length - 1),
  );
  const chartHeight = 104;
  const totalIncome = data.reduce((sum, point) => sum + point.income, 0);
  const totalExpenses = data.reduce((sum, point) => sum + point.expenses, 0);
  const isPositive = totalIncome >= totalExpenses;
  const maximum = Math.max(
    1,
    ...data.flatMap((point) => [point.income, point.expenses]),
  );
  const selectedPoint =
    data[Math.min(selectedIndex, Math.max(0, data.length - 1))];

  const containerWidth = useSharedValue(0);
  const columnCount = Math.max(1, data.length);
  // La posición real se fija en handleLayout, en cuanto se conoce el ancho.
  const lensX = useSharedValue(0);
  const lastReportedIndex = useSharedValue(selectedIndex);

  const selectFromX = (x: number) => {
    "worklet";
    const columnWidth = containerWidth.value / columnCount;
    if (columnWidth <= 0) return;
    const clamped = Math.min(
      Math.max(x, 0),
      containerWidth.value - columnWidth,
    );
    lensX.value = clamped;
    const index = Math.min(
      columnCount - 1,
      Math.max(0, Math.round(clamped / columnWidth)),
    );
    if (index !== lastReportedIndex.value) {
      lastReportedIndex.value = index;
      runOnJS(setSelectedIndex)(index);
      runOnJS(haptics.select)();
    }
  };

  const snapToIndex = (index: number) => {
    "worklet";
    const columnWidth = containerWidth.value / columnCount;
    lensX.value = withSpring(index * columnWidth, WEEK_SPRING);
  };

  const pan = Gesture.Pan()
    .minDistance(4)
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onStart((event) => {
      selectFromX(event.x);
    })
    .onUpdate((event) => {
      selectFromX(event.x);
    })
    .onEnd(() => {
      snapToIndex(lastReportedIndex.value);
    });

  const lensStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: lensX.value }],
    width: containerWidth.value > 0 ? containerWidth.value / columnCount : 0,
  }));

  const handleLayout = (width: number) => {
    const wasZero = containerWidth.value === 0;
    containerWidth.value = width;
    if (wasZero) {
      lensX.value = selectedIndex * (width / columnCount);
    }
  };

  return (
    <YStack gap="$3">
      <XStack items="baseline" justify="space-between" gap="$3">
        <H3
          color="$color12"
          fontFamily="$heading"
          letterSpacing={-0.4}
          fontWeight="600"
          size="$6"
        >
          {t("dashboard.weeklyFlow")}
        </H3>
        <Paragraph
          color={isPositive ? "$success" : "$destructive"}
          fontSize="$2"
          fontWeight="600"
        >
          {isPositive ? t("dashboard.positive") : t("dashboard.negative")}
        </Paragraph>
      </XStack>

      <FintCard gap="$3" p="$4" raised rounded={24}>
        <XStack gap="$4">
          <LegendDot color="$success" label={t("dashboard.income")} />
          <LegendDot color="$destructive" label={t("dashboard.expenses")} />
        </XStack>
        {selectedPoint ? (
          <XStack
            bg="$secondary"
            rounded="$5"
            p="$3"
            items="center"
            justify="space-between"
            gap="$3"
          >
            {}
            <YStack flex={1} minW={0}>
              <Paragraph color="$color12" fontWeight="600">
                {selectedPoint.label}
              </Paragraph>
            </YStack>
            <YStack items="flex-end">
              <Paragraph color="$success" fontSize="$1" fontWeight="600">
                {formatSensitiveAmount(selectedPoint.income, currency)}
              </Paragraph>
              <Paragraph color="$destructive" fontSize="$1" fontWeight="600">
                {formatSensitiveAmount(selectedPoint.expenses, currency)}
              </Paragraph>
            </YStack>
          </XStack>
        ) : null}

        <GestureDetector gesture={pan}>
          <View
            style={{ height: chartHeight + 40 }}
            onLayout={(event) => handleLayout(event.nativeEvent.layout.width)}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: chartHeight + 8,
                  borderRadius: 14,
                  backgroundColor: theme.secondary.val,
                },
                lensStyle,
              ]}
            />
            <XStack height="100%" items="flex-end">
              {data.map((point, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <YStack
                    key={point.label}
                    flex={1}
                    height="100%"
                    items="center"
                    justify="flex-end"
                    gap="$2"
                    role="button"
                    aria-label={t("dashboard.weekAccessibility", {
                      week: point.label,
                      income: formatSensitiveAmount(point.income, currency),
                      expenses: formatSensitiveAmount(point.expenses, currency),
                    })}
                    onPress={() => {
                      setSelectedIndex(index);
                      lastReportedIndex.value = index;
                      const columnWidth = containerWidth.value / columnCount;
                      lensX.value = withSpring(
                        index * columnWidth,
                        WEEK_SPRING,
                      );
                      haptics.select();
                    }}
                  >
                    <XStack height={chartHeight} items="flex-end" gap={5}>
                      <YStack
                        width={11}
                        height={
                          point.income > 0
                            ? Math.max(
                                3,
                                Math.round(
                                  (point.income / maximum) * chartHeight,
                                ),
                              )
                            : 0
                        }
                        bg="$success"
                        rounded={5.5}
                        opacity={isSelected ? 1 : 0.42}
                      />
                      <YStack
                        width={11}
                        height={
                          point.expenses > 0
                            ? Math.max(
                                3,
                                Math.round(
                                  (point.expenses / maximum) * chartHeight,
                                ),
                              )
                            : 0
                        }
                        bg="$destructive"
                        rounded={5.5}
                        opacity={isSelected ? 1 : 0.42}
                      />
                    </XStack>
                    <Paragraph
                      color={isSelected ? "$primary" : "$color10"}
                      fontSize={10}
                      fontWeight={isSelected ? "600" : "400"}
                      numberOfLines={1}
                    >
                      {point.label}
                    </Paragraph>
                  </YStack>
                );
              })}
            </XStack>
          </View>
        </GestureDetector>
        <Paragraph color="$color9" fontSize="$1" text="center">
          {t("dashboard.tapWeek")}
        </Paragraph>

        <XStack
          borderTopColor="$borderColor"
          borderTopWidth={1}
          pt="$3"
          justify="space-between"
          gap="$3"
        >
          <FlowTotal
            color="$success"
            label={t("dashboard.totalIncome")}
            value={formatSensitiveAmount(totalIncome, currency)}
          />
          <FlowTotal
            align="right"
            color="$destructive"
            label={t("dashboard.totalExpenses")}
            value={formatSensitiveAmount(totalExpenses, currency)}
          />
        </XStack>
      </FintCard>
    </YStack>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <XStack items="center" gap="$2">
      <YStack width={9} height={9} rounded="$10" bg={color as never} />
      <Paragraph color="$color10" fontSize="$1">
        {label}
      </Paragraph>
    </XStack>
  );
}

function FlowTotal({
  align = "left",
  color,
  label,
  value,
}: {
  align?: "left" | "right";
  color: string;
  label: string;
  value: string;
}) {
  return (
    <YStack flex={1} items={align === "right" ? "flex-end" : "flex-start"}>
      <Paragraph color={color as never} fontSize="$2" fontWeight="600">
        {value}
      </Paragraph>
      <Paragraph color="$color10" fontSize="$1">
        {label}
      </Paragraph>
    </YStack>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <H3 color="$color12" fontFamily="$heading" fontWeight="600" size="$6">
      {children}
    </H3>
  );
}

function AdviceCarousel({
  currency,
  expenses,
  income,
  previousExpenses,
  previousIncome,
  savings,
}: {
  currency: string;
  expenses: number;
  income: number;
  previousExpenses: number;
  previousIncome: number;
  savings: number;
}) {
  const { t } = useTranslation();
  const { formatSensitiveAmount } = useSensitiveMoney();
  const expenseChange = calculatePercentChange(expenses, previousExpenses);
  const previousSavings = previousIncome - previousExpenses;
  const savingsChange = calculatePercentChange(savings, previousSavings);
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;
  const insights = [
    {
      icon: expenseChange !== null && expenseChange > 0 ? "up" : "down",
      title:
        expenseChange === null
          ? t("dashboard.expensesSnapshot")
          : expenseChange > 0
            ? t("dashboard.expensesIncreasing")
            : t("dashboard.expensesControlled"),
      subtitle: t("dashboard.comparedPreviousMonth"),
      value:
        expenseChange === null
          ? formatSensitiveAmount(expenses, currency)
          : `${Math.abs(expenseChange)}%`,
      trend:
        expenseChange === null
          ? t("dashboard.noPreviousData")
          : `${expenseChange > 0 ? "+" : ""}${expenseChange}% ${t("dashboard.vsPreviousMonth")}`,
      tone:
        expenseChange !== null && expenseChange > 0 ? "negative" : "positive",
    },
    {
      icon: "savings",
      title:
        savings >= 0
          ? t("dashboard.savingsGrowing")
          : t("dashboard.savingsNeedsAttention"),
      subtitle: t("dashboard.currentSavingsRate"),
      value: `${savingsRate}%`,
      trend:
        savingsChange === null
          ? t("dashboard.noPreviousData")
          : `${savingsChange > 0 ? "+" : ""}${savingsChange}% ${t("dashboard.vsPreviousMonth")}`,
      tone: savings >= 0 ? "positive" : "negative",
    },
    {
      icon: "balance",
      title: t("dashboard.monthlyBalance"),
      subtitle: t("dashboard.incomeMinusExpenses"),
      value: formatSensitiveAmount(savings, currency),
      trend:
        savings >= 0
          ? t("dashboard.positiveFlow")
          : t("dashboard.negativeFlow"),
      tone: savings >= 0 ? "positive" : "negative",
    },
  ] as const;

  return (
    <YStack gap="$3">
      <SectionTitle>{t("dashboard.recommendations")}</SectionTitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      >
        {insights.map((insight) => (
          <InsightCard key={insight.title} {...insight} />
        ))}
      </ScrollView>
    </YStack>
  );
}

function InsightCard({
  icon,
  subtitle,
  title,
  tone,
  trend,
  value,
}: {
  icon: "up" | "down" | "savings" | "balance";
  subtitle: string;
  title: string;
  tone: "positive" | "negative";
  trend: string;
  value: string;
}) {
  const toneColor = tone === "positive" ? "$green11" : "$red11";
  const Icon =
    icon === "savings"
      ? Landmark
      : icon === "balance"
        ? ChartNoAxesCombined
        : icon === "up"
          ? ArrowUp
          : ArrowDown;

  return (
    <FintCard width={236} height={148} gap="$2" p="$4" justify="space-between">
      <YStack gap="$1">
        <Paragraph
          color="$color12"
          fontFamily="$heading"
          fontSize="$3"
          fontWeight="600"
          numberOfLines={1}
        >
          {title}
        </Paragraph>
        <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>
          {subtitle}
        </Paragraph>
      </YStack>
      <XStack items="flex-end" justify="space-between" gap="$2">
        <Paragraph
          color={toneColor}
          fontFamily="$body"
          fontSize="$8"
          fontWeight="600"
          letterSpacing={-0.9}
          numberOfLines={1}
        >
          {value}
        </Paragraph>
        <Icon size={17} color={toneColor} strokeWidth={2} />
      </XStack>
      <Paragraph color="$color9" fontSize={9} numberOfLines={1}>
        {trend}
      </Paragraph>
    </FintCard>
  );
}

function ExpenseCategoryCard({
  accounts,
  currency,
  isLoading,
  onAccountChange,
  selectedAccountId,
  slices,
}: {
  accounts: Array<{ id: string; name: string }>;
  currency: string;
  isLoading: boolean;
  onAccountChange: (value: string) => void;
  selectedAccountId: string;
  slices: CategorySlice[];
}) {
  const { t } = useTranslation();
  const { formatSensitiveAmount } = useSensitiveMoney();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0);

  useEffect(() => setSelectedIndex(0), [selectedAccountId]);

  return (
    <YStack gap="$3">
      <XStack items="baseline" justify="space-between" gap="$3">
        <SectionTitle>{t("dashboard.spendingByCategory")}</SectionTitle>
        <Paragraph color="$color10" fontSize="$1">
          {t("dashboard.currentMonth")}
        </Paragraph>
      </XStack>
      <FintCard p="$4" gap="$4" overflow="hidden">
        <FintSheetSelect
          label={t("forms.account")}
          placeholder={t("dashboard.allAccounts")}
          value={selectedAccountId}
          options={[
            { value: ALL_ACCOUNTS, label: t("dashboard.allAccounts") },
            ...accounts.map((account) => ({
              value: account.id,
              label: account.name,
            })),
          ]}
          onValueChange={onAccountChange}
        />
        {isLoading ? (
          <SkeletonGroup label={t("dashboard.loading")}>
            <SkeletonSection height={180} />
          </SkeletonGroup>
        ) : null}
        {!isLoading && slices.length === 0 ? (
          <YStack minH={150} items="center" justify="center" gap="$3" px="$4">
            <YStack
              width={44}
              height={44}
              rounded="$10"
              bg="$secondary"
              items="center"
              justify="center"
            >
              <ChartNoAxesCombined size={22} color="$color10" />
            </YStack>
            <Paragraph color="$color10" text="center" maxW={280}>
              {t("dashboard.emptyCategoriesForAccount")}
            </Paragraph>
          </YStack>
        ) : null}
        {!isLoading && slices.length ? (
          <XStack items="center" gap="$4">
            <DonutChart
              onSelect={setSelectedIndex}
              selectedIndex={Math.min(selectedIndex, slices.length - 1)}
              slices={slices}
              total={total}
            />
            <YStack flex={1} gap="$1.5">
              {slices.map((slice, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <XStack
                    key={slice.name}
                    items="center"
                    justify="space-between"
                    gap="$2"
                    px="$2"
                    py="$2"
                    rounded="$4"
                    bg={isSelected ? "$secondary" : "transparent"}
                    transition="quick"
                    pressStyle={{ scale: 0.98 }}
                    role="button"
                    onPress={() => setSelectedIndex(index)}
                  >
                    <XStack items="center" gap="$2" flex={1} minW={0}>
                      <YStack
                        width={7}
                        height={7}
                        rounded={4}
                        bg={slice.color as never}
                      />
                      <Paragraph
                        color={isSelected ? "$color12" : "$color10"}
                        fontSize="$2"
                        fontWeight={isSelected ? "600" : "400"}
                        numberOfLines={1}
                      >
                        {slice.name}
                      </Paragraph>
                    </XStack>
                    <Paragraph color="$color12" fontSize="$2" fontWeight="600">
                      {formatSensitiveAmount(slice.amount, currency)}
                    </Paragraph>
                  </XStack>
                );
              })}
            </YStack>
          </XStack>
        ) : null}
      </FintCard>
    </YStack>
  );
}

function DonutChart({
  onSelect,
  selectedIndex,
  slices,
  total,
}: {
  onSelect: (index: number) => void;
  selectedIndex: number;
  slices: CategorySlice[];
  total: number;
}) {
  const theme = useTheme();
  const selectedSlice = slices[selectedIndex];
  const selectedPercent =
    total > 0 && selectedSlice
      ? Math.round((selectedSlice.amount / total) * 100)
      : 0;
  const chartData = slices.map((slice, index) => ({
    value: slice.amount,
    color: slice.color,
    onPress: () => onSelect(index),
  }));

  return (
    <YStack width={128} height={128} items="center" justify="center">
      <PieChart
        data={chartData}
        donut
        radius={56}
        innerRadius={38}
        focusOnPress
        toggleFocusOnPress={false}
        selectedIndex={selectedIndex}
        setSelectedIndex={onSelect}
        extraRadius={5}
        isAnimated
        animationDuration={250}
        showGradient={false}
        strokeWidth={2}
        strokeColor={theme.background.val}
        innerCircleColor="transparent"
        backgroundColor="transparent"
      />
      <YStack
        position="absolute"
        width={72}
        height={72}
        rounded={36}
        bg="$card"
        items="center"
        justify="center"
      >
        <Paragraph
          color="$color12"
          fontSize="$7"
          fontWeight="600"
          letterSpacing={-0.6}
        >
          {selectedPercent}%
        </Paragraph>
        <Paragraph
          color="$color9"
          fontSize={10}
          numberOfLines={1}
          maxW={64}
          text="center"
        >
          {selectedSlice?.name ?? ""}
        </Paragraph>
      </YStack>
    </YStack>
  );
}

function RecentMovements({
  locale,
  transactions,
}: {
  locale: string;
  transactions: Transaction[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { formatSignedAmount } = useSensitiveMoney();

  return (
    <YStack gap="$3">
      <XStack items="baseline" justify="space-between" gap="$3">
        <H3 color="$color12" fontFamily="$heading" fontWeight="600" size="$6" flex={1}>
          {t("dashboard.recentActivity")}
        </H3>
        <Link href="/(tabs)/movements" asChild>
          <Button chromeless size="$2" px="$2">
            <XStack items="center" gap="$1">
              <Paragraph color="$primary" fontWeight="600" fontSize="$2">
                {t("actions.viewAll")}
              </Paragraph>
              <ChevronRight size={14} color="$primary" />
            </XStack>
          </Button>
        </Link>
      </XStack>
      {transactions.length === 0 ? (
        <FintCard>
          <Paragraph color="$color10">
            {t("dashboard.emptyMovements")}
          </Paragraph>
        </FintCard>
      ) : (
        <FintCard p={0} overflow="hidden">
          {transactions.map((transaction, index) => {
            const type = transaction.type;
            const isIncome = type === "income";
            const canOpen = type === "income" || type === "expense";
            return (
              <XStack
                key={transaction.id}
                items="center"
                justify="space-between"
                gap="$3"
                p="$4"
                borderBottomColor="$borderColor"
                borderBottomWidth={index < transactions.length - 1 ? 1 : 0}
                role={canOpen ? "button" : undefined}
                bg="transparent"
                transition="quick"
                pressStyle={canOpen ? { bg: "$secondary" } : undefined}
                onPress={
                  canOpen
                    ? () =>
                        router.push({
                          pathname: "/transaction-detail",
                          params: {
                            id: transaction.id,
                            type: type as "income" | "expense",
                            amount: String(transaction.amount),
                            currency: transaction.currency,
                            category: transaction.category,
                            account: transaction.account,
                            note: transaction.note ?? "",
                            date: transaction.date,
                          },
                        })
                    : undefined
                }
              >
                <XStack items="center" gap="$3" flex={1} minW={0}>
                  <YStack
                    width={38}
                    height={38}
                    rounded={19}
                    bg="$background"
                    items="center"
                    justify="center"
                    shrink={0}
                  >
                    {isIncome ? (
                      <ArrowUp size={17} color="$success" strokeWidth={2} />
                    ) : (
                      <ArrowDown size={17} color="$destructive" strokeWidth={2} />
                    )}
                  </YStack>
                  <YStack flex={1} minW={0}>
                    <Paragraph
                      color="$color12"
                      fontSize="$3"
                      fontWeight="600"
                      numberOfLines={1}
                    >
                      {getCategoryLabel(transaction.category, t)}
                    </Paragraph>
                    <Paragraph color="$color9" fontSize={11} numberOfLines={1}>
                      {formatTransactionMeta(transaction, locale)}
                    </Paragraph>
                  </YStack>
                </XStack>
                <Paragraph
                  color={isIncome ? "$green11" : "$red11"}
                  fontSize="$3"
                  fontWeight="600"
                  shrink={0}
                >
                  {formatSignedAmount(
                    transaction.amount,
                    transaction.currency,
                    isIncome ? "income" : "expense",
                  )}
                </Paragraph>
              </XStack>
            );
          })}
        </FintCard>
      )}
    </YStack>
  );
}

function calculatePercentChange(current: number, previous: number) {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function formatWeekLabel(start: string, end: string, locale: string) {
  const labelFormatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  });
  return `${labelFormatter.format(new Date(`${start}T12:00:00`))}-${labelFormatter.format(new Date(`${end}T12:00:00`))}`;
}

function formatTransactionMeta(transaction: Transaction, locale: string) {
  const date = parseTransactionDate(transaction.date);
  const dateLabel = date
    ? new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date)
    : "";
  return [dateLabel, transaction.note || transaction.account]
    .filter(Boolean)
    .join(" · ");
}

function parseTransactionDate(value: string) {
  if (!value) return null;
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}


function DashboardSkeleton({ label }: { label: string }) {
  return (
    <SkeletonGroup label={label}>
      <XStack gap="$3">
        <SkeletonBlock flex={1} height={76} rounded="$6" />
      </XStack>
      <SkeletonSection height={286} />
      <SkeletonContentCard rows={3} />
      <YStack gap="$3">
        <SkeletonBlock height={20} width="48%" />
        <XStack>
          <FintCard width={236} height={148} gap="$3">
            <SkeletonBlock height={32} rounded="$7" width={32} />
            <SkeletonBlock height={13} width="72%" />
            <SkeletonBlock height={24} width="48%" />
          </FintCard>
        </XStack>
      </YStack>
      <YStack gap="$3">
        <SkeletonBlock height={20} width="44%" />
        <SkeletonList grouped rows={4} />
      </YStack>
    </SkeletonGroup>
  );
}
