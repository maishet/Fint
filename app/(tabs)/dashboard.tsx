import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronRight,
  Landmark,
  Sparkles,
} from "@tamagui/lucide-icons-2";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
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
import { formatMoney } from "../../src/api/mappers";
import type { Transaction } from "../../src/api/types";
import { DataStateCard } from "../../src/components/DataStateCard";
import { Screen } from "../../src/components/Screen";
import {
  SkeletonBlock,
  SkeletonContentCard,
  SkeletonGroup,
  SkeletonHero,
  SkeletonList,
  SkeletonSection,
} from "../../src/components/Skeleton";
import { getCategoryLabel } from "../../src/finance/categoryLabels";
import { getAppLocale } from "../../src/i18n";
import { FintButton, FintCard, FintSheetSelect } from "../../src/ui";
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
    queryFn: ({ signal }) => financeApi.getDashboardOverview(undefined, signal),
    retry: false,
  });
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
    enabled: Boolean(overviewQuery.data?.currency),
    retry: false,
  });
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
      isRefreshing={isRefreshing}
      onRefresh={() => {
        void overviewQuery.refetch();
        void expenseQuery.refetch();
      }}
    >
      {isLoading ? <DashboardSkeleton label={t("dashboard.loading")} /> : null}
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
          <HeroSummary
            currency={overview.currency}
            expenses={overview.currentMonth.expenses}
            income={overview.currentMonth.income}
            netWorth={overview.netWorth}
          />

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
            fontWeight="700"
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
          <Paragraph color="$color10" fontSize="$1" fontWeight="800">
            {number}
          </Paragraph>
        )}
      </YStack>
      <Paragraph
        flex={1}
        minW={0}
        color={complete ? "$color10" : "$color12"}
        fontWeight={complete ? "500" : "700"}
        lineHeight="$4"
      >
        {label}
      </Paragraph>
    </XStack>
  );
}

function HeroSummary({
  currency,
  expenses,
  income,
  netWorth,
}: {
  currency: string;
  expenses: number;
  income: number;
  netWorth: number;
}) {
  const { t } = useTranslation();
  const { formatSensitiveAmount } = useSensitiveMoney();
  const primaryText = "$heroForeground";
  const secondaryText = "$heroMuted";
  return (
    <FintCard bg="$heroBackground" borderColor="$heroBorder" p="$4">
      <YStack gap="$4">
        <XStack items="center" justify="space-between" gap="$3">
          <YStack gap="$1" flex={1}>
            <Paragraph
              color={secondaryText}
              fontFamily="$heading"
              fontSize="$2"
              fontWeight="700"
            >
              {t("dashboard.netWorth")}
            </Paragraph>
            <Paragraph
              color={primaryText}
              fontFamily="$body"
              fontSize="$9"
              fontWeight="800"
              letterSpacing={-1.6}
              lineHeight="$9"
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatSensitiveAmount(netWorth, currency)}
            </Paragraph>
          </YStack>
          <SensitiveAmountToggle color="$heroAccent" inverse />
        </XStack>

        <XStack gap="$4">
          <HeroMetric
            accent="$heroAccent"
            label={t("dashboard.monthlyIncome")}
            labelColor={secondaryText}
            textColor={primaryText}
            value={formatSensitiveAmount(income, currency)}
          />
          <HeroMetric
            accent="$heroMuted"
            label={t("dashboard.monthlyExpenses")}
            labelColor={secondaryText}
            textColor={primaryText}
            value={formatSensitiveAmount(expenses, currency)}
          />
        </XStack>
      </YStack>
    </FintCard>
  );
}

function HeroMetric({
  accent,
  label,
  labelColor,
  textColor,
  value,
}: {
  accent: string;
  label: string;
  labelColor: string;
  textColor: string;
  value: string;
}) {
  return (
    <YStack flex={1} gap="$1" minW={0}>
      <YStack height={4} rounded="$10" bg={accent as never} />
      <Paragraph color={labelColor as never} fontFamily="$body" fontSize="$1">
        {label}
      </Paragraph>
      <Paragraph
        color={textColor as never}
        fontFamily="$body"
        fontSize="$3"
        fontWeight="800"
        numberOfLines={1}
      >
        {value}
      </Paragraph>
    </YStack>
  );
}

function QuickActions() {
  const { t } = useTranslation();

  return (
    <XStack gap="$3">
      <Link
        href={{ pathname: "/transaction-form", params: { type: "income" } }}
        asChild
      >
        <FintButton
          flex={1}
          icon={<ArrowDownLeft size={16} color="$primaryForeground" />}
        >
          {t("actions.newIncome")}
        </FintButton>
      </Link>
      <Link
        href={{ pathname: "/transaction-form", params: { type: "expense" } }}
        asChild
      >
        <FintButton
          flex={1}
          variant="outlined"
          icon={<ArrowUpRight size={16} color="$primary" />}
        >
          {t("actions.newExpense")}
        </FintButton>
      </Link>
    </XStack>
  );
}

function WeeklyFlowSection({
  currency,
  data,
}: {
  currency: string;
  data: WeeklyFlowPoint[];
}) {
  const { t } = useTranslation();
  const { formatSensitiveAmount } = useSensitiveMoney();
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, data.length - 1),
  );
  const chartHeight = 94;
  const totalIncome = data.reduce((sum, point) => sum + point.income, 0);
  const totalExpenses = data.reduce((sum, point) => sum + point.expenses, 0);
  const isPositive = totalIncome >= totalExpenses;
  const maximum = Math.max(
    1,
    ...data.flatMap((point) => [point.income, point.expenses]),
  );
  const selectedPoint =
    data[Math.min(selectedIndex, Math.max(0, data.length - 1))];
  return (
    <YStack gap="$3">
      <XStack items="center" justify="space-between" gap="$3">
        <H3
          color="$color12"
          fontFamily="$heading"
          letterSpacing={-0.4}
          size="$6"
        >
          {t("dashboard.weeklyFlow")}
        </H3>
        <YStack bg="$secondary" px="$3" py="$1" rounded="$10">
          <Paragraph
            color={isPositive ? "$success" : "$destructive"}
            fontSize="$1"
            fontWeight="800"
          >
            {isPositive ? t("dashboard.positive") : t("dashboard.negative")}
          </Paragraph>
        </YStack>
      </XStack>

      <FintCard gap="$3" p="$3" raised rounded={22}>
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
            <YStack flex={1} minW={0}>
              <Paragraph color="$color12" fontWeight="800">
                {selectedPoint.label}
              </Paragraph>
              <Paragraph color="$color9" fontSize="$1">
                {t("dashboard.tapWeek")}
              </Paragraph>
            </YStack>
            <YStack items="flex-end">
              <Paragraph color="$success" fontSize="$1" fontWeight="800">
                {formatSensitiveAmount(selectedPoint.income, currency)}
              </Paragraph>
              <Paragraph color="$destructive" fontSize="$1" fontWeight="800">
                {formatSensitiveAmount(selectedPoint.expenses, currency)}
              </Paragraph>
            </YStack>
          </XStack>
        ) : null}
        <XStack height={136} items="flex-end" gap="$2">
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
                px="$1"
                py="$2"
                rounded="$4"
                pressStyle={{ bg: "$muted" }}
                onPress={() => setSelectedIndex(index)}
                role="button"
                aria-label={t("dashboard.weekAccessibility", {
                  week: point.label,
                  income: formatSensitiveAmount(point.income, currency),
                  expenses: formatSensitiveAmount(point.expenses, currency),
                })}
              >
                <XStack height={chartHeight} items="flex-end" gap={4}>
                  <YStack
                    transition="200ms"
                    width={12}
                    height={
                      point.income > 0
                        ? Math.max(
                            3,
                            Math.round((point.income / maximum) * chartHeight),
                          )
                        : 0
                    }
                    bg="$success"
                    rounded="$2"
                    opacity={isSelected ? 1 : 0.76}
                  />
                  <YStack
                    transition="200ms"
                    width={12}
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
                    rounded="$2"
                    opacity={isSelected ? 1 : 0.76}
                  />
                </XStack>
                <Paragraph
                  color={isSelected ? "$primary" : "$color10"}
                  fontSize={9}
                  fontWeight={isSelected ? "800" : "500"}
                  numberOfLines={1}
                >
                  {point.label}
                </Paragraph>
              </YStack>
            );
          })}
        </XStack>
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
      <Paragraph color={color as never} fontSize="$2" fontWeight="800">
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
    <H3 color="$color12" fontFamily="$heading" size="$6">
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
  const toneBackground = tone === "positive" ? "$green2" : "$red2";
  const toneColor = tone === "positive" ? "$green11" : "$red11";
  const Icon =
    icon === "savings"
      ? Landmark
      : icon === "balance"
        ? ChartNoAxesCombined
        : icon === "up"
          ? ArrowUpRight
          : ArrowDownLeft;

  return (
    <FintCard width={248} height={148} gap="$2" p="$3" justify="space-between">
      <XStack items="flex-start" justify="space-between" gap="$3">
        <YStack
          width={32}
          height={32}
          rounded="$7"
          bg={toneBackground}
          items="center"
          justify="center"
        >
          <Icon size={17} color={toneColor} />
        </YStack>
        <YStack bg={toneBackground} px="$2" py="$1" rounded="$10">
          <Paragraph
            color={toneColor}
            fontSize={9}
            fontWeight="800"
            maxW={145}
            numberOfLines={1}
          >
            {trend}
          </Paragraph>
        </YStack>
      </XStack>
      <YStack gap="$1">
        <Paragraph
          color="$color12"
          fontFamily="$heading"
          fontSize="$3"
          fontWeight="700"
          numberOfLines={1}
        >
          {title}
        </Paragraph>
        <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>
          {subtitle}
        </Paragraph>
      </YStack>
      <Paragraph
        color={toneColor}
        fontFamily="$body"
        fontSize="$6"
        fontWeight="800"
        lineHeight="$6"
        numberOfLines={1}
      >
        {value}
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
      <XStack items="center" justify="space-between" gap="$3">
        <SectionTitle>{t("dashboard.spendingByCategory")}</SectionTitle>
        <Paragraph color="$color10" fontSize="$1">
          {t("dashboard.currentMonth")}
        </Paragraph>
      </XStack>
      <FintCard p="$3" gap="$3" overflow="hidden">
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
          <YStack minH={150} items="center" justify="center" px="$4">
            <Paragraph color="$color10" text="center">
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
            <YStack flex={1} gap="$2">
              {slices.map((slice, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <XStack
                    key={slice.name}
                    items="center"
                    justify="space-between"
                    gap="$2"
                    px="$2"
                    py="$1"
                    rounded="$4"
                    bg={isSelected ? "$secondary" : "transparent"}
                    borderColor={isSelected ? "$primary" : "transparent"}
                    borderWidth={1}
                    pressStyle={{ opacity: 0.75 }}
                    role="button"
                    onPress={() => setSelectedIndex(index)}
                  >
                    <XStack items="center" gap="$2" flex={1} minW={0}>
                      <YStack
                        width={9}
                        height={9}
                        rounded="$10"
                        bg={slice.color as never}
                      />
                      <Paragraph
                        color={isSelected ? "$color12" : "$color10"}
                        fontSize="$2"
                        fontWeight={isSelected ? "700" : "500"}
                        numberOfLines={1}
                      >
                        {slice.name}
                      </Paragraph>
                    </XStack>
                    <Paragraph color="$color12" fontSize="$2" fontWeight="800">
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
    <YStack width={122} height={122} items="center" justify="center">
      <PieChart
        data={chartData}
        donut
        radius={54}
        innerRadius={34}
        focusOnPress
        toggleFocusOnPress={false}
        selectedIndex={selectedIndex}
        setSelectedIndex={onSelect}
        extraRadius={5}
        isAnimated
        animationDuration={250}
        showGradient={false}
        strokeWidth={2}
        strokeColor="rgba(255,255,255,0.72)"
        innerCircleColor="transparent"
        backgroundColor="transparent"
      />
      <YStack
        position="absolute"
        width={70}
        height={70}
        rounded="$12"
        bg="$card"
        borderColor="$borderColor"
        borderWidth={1}
        items="center"
        justify="center"
      >
        <Paragraph color="$color12" fontSize="$7" fontWeight="900">
          {selectedPercent}%
        </Paragraph>
        <Paragraph
          color="$color9"
          fontSize="$1"
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
  const { formatSensitiveAmount } = useSensitiveMoney();

  return (
    <YStack gap="$3">
      <XStack items="center" justify="space-between" gap="$3">
        <H3 color="$color12" fontFamily="$heading" size="$6" flex={1}>
          {t("dashboard.recentActivity")}
        </H3>
        <Link href="/(tabs)/movements" asChild>
          <Button chromeless size="$2" px="$2">
            <XStack items="center" gap="$1">
              <Paragraph color="$primary" fontWeight="800" fontSize="$2">
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
            return (
              <XStack
                key={transaction.id}
                items="center"
                justify="space-between"
                gap="$3"
                p="$3"
                borderBottomColor="$borderColor"
                borderBottomWidth={index < transactions.length - 1 ? 1 : 0}
              >
                <XStack items="center" gap="$3" flex={1} minW={0}>
                  <YStack
                    width={36}
                    height={36}
                    rounded="$8"
                    bg={isIncome ? "$green2" : "$red2"}
                    items="center"
                    justify="center"
                    shrink={0}
                  >
                    {isIncome ? (
                      <ArrowDownLeft size={18} color="$green10" />
                    ) : (
                      <ArrowUpRight size={18} color="$red10" />
                    )}
                  </YStack>
                  <YStack flex={1} minW={0}>
                    <Paragraph
                      color="$color12"
                      fontSize="$3"
                      fontWeight="800"
                      numberOfLines={1}
                    >
                      {getCategoryLabel(transaction.category, t)}
                    </Paragraph>
                    <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>
                      {formatTransactionMeta(transaction, locale)}
                    </Paragraph>
                  </YStack>
                </XStack>
                <Paragraph
                  color={isIncome ? "$green11" : "$red11"}
                  fontSize="$2"
                  fontWeight="800"
                  shrink={0}
                >
                  {formatSensitiveAmount(
                    transaction.amount,
                    transaction.currency,
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
      <SkeletonHero />
      <XStack gap="$3">
        <SkeletonBlock flex={1} height={44} rounded="$6" />
        <SkeletonBlock flex={1} height={44} rounded="$6" />
      </XStack>
      <SkeletonSection height={286} />
      <SkeletonContentCard rows={3} />
      <YStack gap="$3">
        <SkeletonBlock height={20} width="48%" />
        <XStack>
          <FintCard width={248} height={148} gap="$3">
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
