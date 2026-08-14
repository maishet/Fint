import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Landmark,
  Percent,
  PiggyBank,
  Table2,
  Target,
  WalletCards,
} from "@tamagui/lucide-icons-2";
import { useNotify } from "../../src/ui/notify";
import * as Sentry from "@sentry/react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  Button,
  Paragraph,
  ScrollView,
  XStack,
  YStack,
} from "tamagui";
import { financeApi } from "../../src/api/finance";
import { formatMoney } from "../../src/api/mappers";
import type {
  FinancialReport,
  FinancialReportPeriod,
  FinancialReportPosition,
  FinancialTopTransaction,
} from "../../src/api/types";
import { DataStateCard } from "../../src/components/DataStateCard";
import { Screen } from "../../src/components/Screen";
import {
  SkeletonBlock,
  SkeletonContentCard,
  SkeletonGroup,
  SkeletonMetricGrid,
  SkeletonSection,
} from "../../src/components/Skeleton";
import { getCategoryLabel } from "../../src/finance/categoryLabels";
import { suggestedCategoryIcons } from "../../src/finance/categoryIcons";
import {
  exportFinancialReportXlsx,
  exportFinancialReportPdf,
  type ReportExportLabels,
} from "../../src/finance/report-export";
import {
  getPresetRange,
  type ReportPeriodPreset,
} from "../../src/finance/reports";
import { getAppLocale, type AppLanguage } from "../../src/i18n";
import { FintCard, FintSheetSelect, FintSpinner } from "../../src/ui";
import { useSensitiveMoney } from "../../src/privacy/useSensitiveMoney";
import { SensitiveAmountToggle } from "../../src/privacy/SensitiveAmountToggle";

const ALL_ACCOUNTS = "__all__";

const REPORT_TEXT_KEYS = [
  "title",
  "subtitle",
  "closing",
  "filters",
  "period",
  "account",
  "currency",
  "allAccounts",
  "currentMonth",
  "previousMonth",
  "last3Months",
  "last6Months",
  "updated",
  "mixed",
  "loading",
  "error",
  "empty",
  "exportTitle",
  "exportPdf",
  "exportExcel",
  "exporting",
  "exported",
  "exportError",
  "executiveSummary",
  "financialStatus",
  "income",
  "expenses",
  "net",
  "savingsRate",
  "transactions",
  "previousPeriod",
  "flow",
  "categories",
  "accountActivity",
  "currentPosition",
  "accounts",
  "debts",
  "topTransactions",
  "category",
  "date",
  "type",
  "amount",
  "balance",
  "outstanding",
  "dueDate",
  "progress",
  "noData",
  "currentSnapshotNote",
  "incomeType",
  "expenseType",
  "viewMovements",
  "comparison",
  "topCategory",
  "largestMovement",
  "noPrevious",
] as const;

type ReportStatus = FinancialReportPeriod["summary"]["status"];
type ReportText = Record<(typeof REPORT_TEXT_KEYS)[number], string> & {
  statuses: Record<ReportStatus, string>;
  statusMessages: Record<ReportStatus, string>;
};

function getReportText(t: TFunction): ReportText {
  const labels = Object.fromEntries(
    REPORT_TEXT_KEYS.map((key) => [key, t(`reports.${key}`)]),
  ) as Record<(typeof REPORT_TEXT_KEYS)[number], string>;
  return {
    ...labels,
    statuses: t("reports.statuses", { returnObjects: true }) as Record<
      ReportStatus,
      string
    >,
    statusMessages: t("reports.statusMessages", {
      returnObjects: true,
    }) as Record<ReportStatus, string>,
  };
}

export default function ReportsScreen() {
  const { i18n, t } = useTranslation();
  const language = (
    i18n.resolvedLanguage === "en" || i18n.resolvedLanguage === "pt"
      ? i18n.resolvedLanguage
      : "es"
  ) as AppLanguage;
  const text = getReportText(t);
  const locale = getAppLocale(language);
  const queryClient = useQueryClient();
  const toast = useNotify();
  const router = useRouter();
  const [preset, setPreset] = useState<ReportPeriodPreset>("currentMonth");
  const [accountId, setAccountId] = useState(ALL_ACCOUNTS);
  const [currency, setCurrency] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const range = getPresetRange(preset);
  const reportFilters = {
    ...range,
    grouping:
      preset === "currentMonth" || preset === "previousMonth"
        ? ("week" as const)
        : ("month" as const),
    ...(accountId !== ALL_ACCOUNTS ? { accountId } : {}),
    ...(currency ? { currency } : {}),
  };
  const optionsQuery = useQuery({
    queryKey: ["reports", "financial", "options"],
    queryFn: ({ signal }) => financeApi.getFinancialReportOptions(signal),    staleTime: 5 * 60_000,
  });
  const periodQuery = useQuery({
    queryKey: ["reports", "financial", "period", reportFilters],
    queryFn: ({ signal }) =>
      financeApi.getFinancialReportPeriod(reportFilters, signal),  });
  const selectedCurrency =
    currency ||
    periodQuery.data?.filters.currency ||
    optionsQuery.data?.baseCurrency ||
    "";
  const positionQuery = useQuery({
    queryKey: ["reports", "financial", "position", accountId, selectedCurrency],
    queryFn: ({ signal }) =>
      financeApi.getFinancialReportPosition(
        {
          ...(accountId !== ALL_ACCOUNTS ? { accountId } : {}),
          currency: selectedCurrency,
        },
        signal,
      ),
    enabled: Boolean(selectedCurrency),  });
  const topTransactionsQuery = useQuery({
    queryKey: [
      "reports",
      "financial",
      "top-transactions",
      range.from,
      range.to,
      accountId,
      selectedCurrency,
    ],
    queryFn: ({ signal }) =>
      financeApi.getFinancialTopTransactions(
        {
          ...range,
          ...(accountId !== ALL_ACCOUNTS ? { accountId } : {}),
          currency: selectedCurrency,
          limit: 10,
        },
        signal,
      ),
    enabled: Boolean(selectedCurrency),  });
  const reportError = optionsQuery.error ?? periodQuery.error;
  const report = periodQuery.data;
  const hasMovements = Boolean(report?.summary.transactionCount);
  const accountTypes = {
    cash: t("accountTypes.cash"),
    credit_card: t("accountTypes.creditCard"),
    checking_account: t("accountTypes.checkingAccount"),
    savings_account: t("accountTypes.savingsAccount"),
  };
  const exportOptions = {
    locale,
    labels: {
      ...text,
      generated: text.updated,
      accountTypes,
    } as unknown as ReportExportLabels,
  };

  const exportReport = async (format: "pdf" | "xlsx") => {
    setIsExporting(true);
    const task = (async () => {
      const exportData =
        await financeApi.getFinancialReportExportData(reportFilters);
      const localizedReport = localizeReport(exportData, t);
      if (format === "pdf")
        await exportFinancialReportPdf(localizedReport, exportOptions);
      else await exportFinancialReportXlsx(localizedReport, exportOptions);
    })();
    // Toast de proceso: "Preparando…" → "Reporte listo" / error.
    toast.promise(task, {
      loading: text.exporting,
      success: text.exported,
      error: text.exportError,
    });
    try {
      await task;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: `report_export_${format}` },
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Screen
      isRefreshing={
        periodQuery.isRefetching ||
        positionQuery.isRefetching ||
        topTransactionsQuery.isRefetching
      }
      onRefresh={() => {
        void periodQuery.refetch();
        void positionQuery.refetch();
        void topTransactionsQuery.refetch();
      }}
    >
      <FintCard bg="$heroBackground" borderColor="$heroBorder" gap="$3">
        <XStack items="center" gap="$3">
          <SensitiveAmountToggle color="$heroAccent" inverse />
          <YStack flex={1} minW={0}>
            <Paragraph
              color="$heroAccent"
              fontSize={10}
              fontWeight="900"
              letterSpacing={1.2}
              textTransform="uppercase"
            >
              {text.closing}
            </Paragraph>
            <Paragraph
              color="$heroForeground"
              fontFamily="$heading"
              fontSize="$6"
              fontWeight="800"
            >
              {text.title}
            </Paragraph>
            <Paragraph color="$heroMuted">{text.subtitle}</Paragraph>
          </YStack>
          <FintSheetSelect
            label={text.exportTitle}
            placeholder={text.exportTitle}
            options={[
              {
                value: "pdf",
                label: text.exportPdf,
                icon: <FileText size={19} color="$primary" />,
              },
              {
                value: "xlsx",
                label: text.exportExcel,
                icon: <Table2 size={19} color="$primary" />,
              },
            ]}
            onValueChange={(value) => {
              void exportReport(value as "pdf" | "xlsx");
            }}
            renderTrigger={({ onPress }) => (
              <YStack
                width={44}
                height={44}
                rounded="$9"
                bg="rgba(93,214,229,0.14)"
                borderColor="rgba(93,214,229,0.35)"
                borderWidth={1}
                items="center"
                justify="center"
                opacity={!hasMovements ? 0.45 : 1}
                onPress={!hasMovements || isExporting ? undefined : onPress}
                aria-label={text.exportTitle}
              >
                {isExporting ? (
                  <FintSpinner size="small" color="$heroAccent" />
                ) : (
                  <Download size={21} color="$heroAccent" />
                )}
              </YStack>
            )}
          />
        </XStack>
      </FintCard>

      <FintCard gap="$3">
        <ReportCardHeader
          icon={<CalendarDays size={19} color="$primary" />}
          title={text.filters}
        />
        <FintSheetSelect
          label={text.period}
          placeholder={text.period}
          value={preset}
          options={[
            { value: "currentMonth", label: text.currentMonth },
            { value: "previousMonth", label: text.previousMonth },
            { value: "last3Months", label: text.last3Months },
            { value: "last6Months", label: text.last6Months },
          ]}
          onValueChange={(value) => setPreset(value as ReportPeriodPreset)}
        />
        <YStack gap="$3">
          <FintSheetSelect
            label={text.account}
            placeholder={text.account}
            value={accountId}
            options={[
              { value: ALL_ACCOUNTS, label: text.allAccounts },
              ...(optionsQuery.data?.accounts ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              })),
            ]}
            onValueChange={(value) => {
              setAccountId(value);
              const selected = optionsQuery.data?.accounts.find(
                (item) => item.id === value,
              );
              if (selected) setCurrency(selected.currency);
            }}
          />
          <FintSheetSelect
            label={text.currency}
            placeholder={text.currency}
            value={selectedCurrency}
            options={(optionsQuery.data?.currencies ?? [selectedCurrency])
              .filter(Boolean)
              .map((value) => ({ value, label: value }))}
            onValueChange={setCurrency}
          />
        </YStack>
      </FintCard>

      {periodQuery.isLoading ? <ReportsSkeleton label={text.loading} /> : null}
      {reportError ? (
        <DataStateCard
          message={t("states.error")}
          onRetry={() => {
            void optionsQuery.refetch();
            void periodQuery.refetch();
          }}
        />
      ) : null}
      {(optionsQuery.data?.currencies.length ?? 0) > 1 ? (
        <FintCard bg="$yellow2" borderColor="$yellow6">
          <XStack gap="$2" items="center">
            <AlertTriangle size={18} color="$yellow10" />
            <Paragraph color="$yellow11" flex={1}>
              {text.mixed}
            </Paragraph>
          </XStack>
        </FintCard>
      ) : null}
      {report && !hasMovements ? <DataStateCard message={text.empty} /> : null}
      {report && hasMovements ? (
        <ReportContent
          report={report}
          position={positionQuery.data}
          positionError={Boolean(positionQuery.error)}
          positionLoading={positionQuery.isLoading}
          topTransactions={topTransactionsQuery.data}
          topTransactionsError={Boolean(topTransactionsQuery.error)}
          topTransactionsLoading={topTransactionsQuery.isLoading}
          text={text}
          locale={locale}
          onOpenMovements={() => router.push("/(tabs)/movements")}
          onRetryPosition={() => {
            void positionQuery.refetch();
          }}
          onRetryTopTransactions={() => {
            void topTransactionsQuery.refetch();
          }}
        />
      ) : null}
    </Screen>
  );
}

function ReportContent({
  locale,
  onOpenMovements,
  onRetryPosition,
  onRetryTopTransactions,
  position,
  positionError,
  positionLoading,
  report,
  text,
  topTransactions,
  topTransactionsError,
  topTransactionsLoading,
}: {
  locale: string;
  onOpenMovements: () => void;
  onRetryPosition: () => void;
  onRetryTopTransactions: () => void;
  position?: FinancialReportPosition;
  positionError: boolean;
  positionLoading: boolean;
  report: FinancialReportPeriod;
  text: ReportText;
  topTransactions?: FinancialTopTransaction[];
  topTransactionsError: boolean;
  topTransactionsLoading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <ReportMeta report={report} text={text} locale={locale} />
      <StatusCard report={report} text={text} />
      <MetricGrid report={report} text={text} />
      <SeriesCard report={report} text={text} locale={locale} />
      <CategoryCard
        report={report}
        text={text}
        t={t}
        onOpenMovements={onOpenMovements}
      />
      <AccountActivityCard report={report} text={text} />
      <YStack minH={position ? undefined : 220}>
        {positionLoading ? (
          <SkeletonGroup label={text.loading}>
            <SkeletonContentCard rows={3} />
          </SkeletonGroup>
        ) : null}
        {positionError ? (
          <DataStateCard message={text.error} onRetry={onRetryPosition} />
        ) : null}
        {position ? (
          <CurrentPositionCard
            position={position}
            currency={report.filters.currency}
            text={text}
          />
        ) : null}
      </YStack>
      <YStack minH={topTransactions ? undefined : 220}>
        {topTransactionsLoading ? (
          <SkeletonGroup label={text.loading}>
            <SkeletonContentCard rows={4} />
          </SkeletonGroup>
        ) : null}
        {topTransactionsError ? (
          <DataStateCard
            message={text.error}
            onRetry={onRetryTopTransactions}
          />
        ) : null}
        {topTransactions ? (
          <TopTransactionsCard
            transactions={topTransactions}
            currency={report.filters.currency}
            text={text}
            locale={locale}
          />
        ) : null}
      </YStack>
    </>
  );
}

function ReportMeta({
  locale,
  report,
  text,
}: {
  locale: string;
  report: FinancialReportPeriod;
  text: ReportText;
}) {
  return (
    <XStack gap="$2" items="center" px="$1">
      <CalendarDays size={16} color="$color10" />
      <Paragraph flex={1} color="$color10" fontSize="$1">
        {formatDate(report.period.from, locale)} -{" "}
        {formatDate(previousDay(report.period.to), locale)} · {text.updated}:{" "}
        {new Intl.DateTimeFormat(locale, {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(report.generatedAt))}
      </Paragraph>
    </XStack>
  );
}

function ReportCardHeader({
  action,
  icon,
  title,
}: {
  action?: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <XStack minH={44} items="center" gap="$3">
      <YStack
        width={38}
        height={38}
        rounded="$9"
        bg="$accent2"
        items="center"
        justify="center"
      >
        {icon}
      </YStack>
      <Paragraph
        flex={1}
        color="$color12"
        fontFamily="$heading"
        fontSize="$5"
        fontWeight="800"
      >
        {title}
      </Paragraph>
      {action}
    </XStack>
  );
}

function WidgetEmpty({ message }: { message: string }) {
  return (
    <YStack
      minH={72}
      items="center"
      justify="center"
      bg="$muted"
      rounded="$5"
      px="$4"
    >
      <Paragraph color="$color10" text="center">
        {message}
      </Paragraph>
    </YStack>
  );
}

function StatusCard({
  report,
  text,
}: {
  report: FinancialReportPeriod;
  text: ReportText;
}) {
  const { t } = useTranslation();
  const { formatSensitiveAmount } = useSensitiveMoney();
  const positive = report.summary.status === "healthy";
  const attention = report.summary.status === "attention";
  return (
    <FintCard
      bg={positive ? "$green2" : attention ? "$red2" : "$secondary"}
      borderColor={positive ? "$green6" : attention ? "$red6" : "$borderColor"}
      gap="$3"
    >
      <XStack items="center" gap="$3">
        <YStack
          width={42}
          height={42}
          rounded="$9"
          bg={positive ? "$green4" : attention ? "$red4" : "$accent3"}
          items="center"
          justify="center"
        >
          <Target
            size={21}
            color={positive ? "$green10" : attention ? "$red10" : "$primary"}
          />
        </YStack>
        <YStack flex={1} gap="$1">
          <Paragraph
            color="$color10"
            fontSize={10}
            fontWeight="900"
            letterSpacing={0.8}
            textTransform="uppercase"
          >
            {text.financialStatus}
          </Paragraph>
          <Paragraph
            color="$color12"
            fontFamily="$heading"
            fontSize="$5"
            fontWeight="800"
          >
            {text.statuses[report.summary.status]}
          </Paragraph>
        </YStack>
      </XStack>
      <Paragraph color="$color10">
        {text.statusMessages[report.summary.status]}
      </Paragraph>
      {report.highlights.topExpenseCategory ||
      report.highlights.largestTransaction ? (
        <XStack gap="$2">
          <Highlight
            label={text.topCategory}
            value={
              report.highlights.topExpenseCategory
                ? getCategoryLabel(report.highlights.topExpenseCategory.name, t)
                : text.noData
            }
            amount={
              report.highlights.topExpenseCategory
                ? formatSensitiveAmount(
                    report.highlights.topExpenseCategory.amount,
                    report.filters.currency,
                  )
                : undefined
            }
          />
          <Highlight
            label={text.largestMovement}
            value={
              report.highlights.largestTransaction
                ? getCategoryLabel(
                    report.highlights.largestTransaction.category,
                    t,
                  )
                : text.noData
            }
            amount={
              report.highlights.largestTransaction
                ? formatSensitiveAmount(
                    report.highlights.largestTransaction.amount,
                    report.filters.currency,
                  )
                : undefined
            }
          />
        </XStack>
      ) : null}
    </FintCard>
  );
}

function Highlight({
  amount,
  label,
  value,
}: {
  amount?: string;
  label: string;
  value: string;
}) {
  return (
    <YStack
      flex={1}
      bg="$card"
      borderColor="$borderColor"
      borderWidth={1}
      rounded="$5"
      p="$2"
      gap="$1"
    >
      <Paragraph color="$color9" fontSize={9}>
        {label}
      </Paragraph>
      <Paragraph
        color="$color12"
        fontSize="$1"
        fontWeight="800"
        numberOfLines={1}
      >
        {value}
      </Paragraph>
      {amount ? (
        <Paragraph color="$primary" fontSize="$1" fontWeight="900">
          {amount}
        </Paragraph>
      ) : null}
    </YStack>
  );
}

function MetricGrid({
  report,
  text,
}: {
  report: FinancialReportPeriod;
  text: ReportText;
}) {
  const { formatSensitiveAmount } = useSensitiveMoney();
  const comparison =
    report.summary.netChangePercentage === null
      ? text.noPrevious
      : `${report.summary.netChangePercentage > 0 ? "+" : ""}${report.summary.netChangePercentage}% ${text.comparison}`;
  return (
    <YStack gap="$2">
      <XStack gap="$2">
        <Metric
          icon={<ArrowDownLeft size={17} color="$green10" />}
          label={text.income}
          value={formatSensitiveAmount(
            report.summary.income,
            report.filters.currency,
          )}
        />
        <Metric
          icon={<ArrowUpRight size={17} color="$red10" />}
          label={text.expenses}
          value={formatSensitiveAmount(
            report.summary.expenses,
            report.filters.currency,
          )}
        />
      </XStack>
      <XStack gap="$2">
        <Metric
          icon={<PiggyBank size={17} color="$primary" />}
          label={text.net}
          value={formatSensitiveAmount(
            report.summary.net,
            report.filters.currency,
          )}
          detail={comparison}
        />
        <Metric
          icon={<Percent size={17} color="$primary" />}
          label={text.savingsRate}
          value={
            report.summary.savingsRate === null
              ? "-"
              : `${report.summary.savingsRate}%`
          }
          detail={`${report.summary.transactionCount} ${text.transactions.toLowerCase()}`}
        />
      </XStack>
    </YStack>
  );
}

function Metric({
  detail,
  icon,
  label,
  value,
}: {
  detail?: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <FintCard flex={1} minH={108} p="$3" gap="$2">
      <XStack items="center" gap="$2">
        <YStack
          width={34}
          height={34}
          rounded="$9"
          bg="$accent2"
          items="center"
          justify="center"
        >
          {icon}
        </YStack>
        <Paragraph color="$color10" fontSize="$1" flex={1}>
          {label}
        </Paragraph>
      </XStack>
      <Paragraph
        color="$color12"
        fontSize="$4"
        fontWeight="900"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Paragraph>
      {detail ? (
        <Paragraph color="$color9" fontSize={10} numberOfLines={1}>
          {detail}
        </Paragraph>
      ) : null}
    </FintCard>
  );
}

function SeriesCard({
  locale,
  report,
  text,
}: {
  locale: string;
  report: FinancialReportPeriod;
  text: ReportText;
}) {
  const { formatSensitiveAmount } = useSensitiveMoney();
  const [selectedPeriod, setSelectedPeriod] = useState(
    report.series.at(-1)?.period ?? "",
  );
  const max = Math.max(
    1,
    ...report.series.flatMap((item) => [item.income, item.expenses]),
  );
  const selected =
    report.series.find((item) => item.period === selectedPeriod) ??
    report.series.at(-1);
  return (
    <FintCard gap="$3">
      <ReportCardHeader
        icon={<BarChart3 size={19} color="$primary" />}
        title={text.flow}
      />
      <XStack gap="$4">
        <Legend color="$green9" label={text.income} />
        <Legend color="$red9" label={text.expenses} />
      </XStack>
      {selected ? (
        <XStack bg="$secondary" rounded="$5" p="$3" items="center" gap="$3">
          <CalendarDays size={18} color="$primary" />
          <YStack flex={1} minW={0}>
            <Paragraph color="$color12" fontWeight="800">
              {formatSeriesPeriod(
                selected.period,
                report.period.grouping,
                locale,
              )}
            </Paragraph>
            <Paragraph color="$color10" fontSize="$1">
              {selected.transactionCount} {text.transactions.toLowerCase()} ·{" "}
              {text.net}:{" "}
              {formatSensitiveAmount(selected.net, report.filters.currency)}
            </Paragraph>
          </YStack>
          <YStack items="flex-end">
            <Paragraph color="$green11" fontSize="$1" fontWeight="800">
              {formatSensitiveAmount(selected.income, report.filters.currency)}
            </Paragraph>
            <Paragraph color="$red11" fontSize="$1" fontWeight="800">
              {formatSensitiveAmount(
                selected.expenses,
                report.filters.currency,
              )}
            </Paragraph>
          </YStack>
        </XStack>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <XStack
          minW="100%"
          height={170}
          items="flex-end"
          gap="$2"
          px="$1"
          pb="$2"
        >
          {report.series.map((item) => {
            const isSelected = item.period === selected?.period;
            return (
              <YStack
                key={item.period}
                width={72}
                height={154}
                overflow="hidden"
                items="center"
                justify="flex-end"
                gap="$2"
                px="$1"
                py="$2"
                rounded="$4"
                bg={isSelected ? "$secondary" : "transparent"}
                pressStyle={{ bg: "$secondary" }}
                role="button"
                accessibilityState={{ selected: isSelected }}
                aria-label={`${formatSeriesPeriod(item.period, report.period.grouping, locale)}. ${text.income}: ${formatSensitiveAmount(item.income, report.filters.currency)}. ${text.expenses}: ${formatSensitiveAmount(item.expenses, report.filters.currency)}. ${text.net}: ${formatSensitiveAmount(item.net, report.filters.currency)}`}
                onPress={() => setSelectedPeriod(item.period)}
              >
                <XStack height={108} items="flex-end" gap={6}>
                  <YStack
                    transition="200ms"
                    width={15}
                    height={
                      item.income
                        ? Math.max(5, Math.round((item.income / max) * 100))
                        : 0
                    }
                    bg="$green9"
                    rounded="$3"
                    opacity={isSelected ? 1 : 0.72}
                  />
                  <YStack
                    transition="200ms"
                    width={15}
                    height={
                      item.expenses
                        ? Math.max(5, Math.round((item.expenses / max) * 100))
                        : 0
                    }
                    bg="$red9"
                    rounded="$3"
                    opacity={isSelected ? 1 : 0.72}
                  />
                </XStack>
                <Paragraph
                  color={isSelected ? "$color12" : "$color10"}
                  fontSize={9}
                  fontWeight={isSelected ? "800" : "500"}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatSeriesPeriod(
                    item.period,
                    report.period.grouping,
                    locale,
                  )}
                </Paragraph>
              </YStack>
            );
          })}
        </XStack>
      </ScrollView>
    </FintCard>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <XStack items="center" gap="$1">
      <YStack width={8} height={8} rounded="$10" bg={color as never} />
      <Paragraph color="$color10" fontSize="$1">
        {label}
      </Paragraph>
    </XStack>
  );
}

function CategoryCard({
  onOpenMovements,
  report,
  t,
  text,
}: {
  onOpenMovements: () => void;
  report: FinancialReportPeriod;
  t: TFunction;
  text: ReportText;
}) {
  const { formatSensitiveAmount } = useSensitiveMoney();
  return (
    <FintCard gap="$3">
      <ReportCardHeader
        icon={<Table2 size={19} color="$primary" />}
        title={text.categories}
        action={
          <Button chromeless minH={44} px="$2" onPress={onOpenMovements}>
            <XStack items="center" gap="$1">
              <Paragraph color="$primary" fontWeight="800" fontSize="$2">
                {text.viewMovements}
              </Paragraph>
              <ChevronRight size={14} color="$primary" />
            </XStack>
          </Button>
        }
      />
      {report.categories.length === 0 ? (
        <WidgetEmpty message={text.noData} />
      ) : (
        report.categories.map((item) => (
          <XStack key={item.name} items="center" gap="$3">
            <YStack
              width={38}
              height={38}
              rounded="$8"
              bg="$secondary"
              items="center"
              justify="center"
            >
              <Paragraph fontSize="$5">
                {getExpenseCategoryIcon(item.name, item.icon)}
              </Paragraph>
            </YStack>
            <YStack flex={1}>
              <Paragraph color="$color12" fontWeight="800">
                {getCategoryLabel(item.name, t)}
              </Paragraph>
              <Paragraph color="$color10" fontSize="$1">
                {item.percentage}% ·{" "}
                {item.changePercentage === null
                  ? text.noPrevious
                  : `${item.changePercentage > 0 ? "+" : ""}${item.changePercentage}% ${text.comparison}`}
              </Paragraph>
            </YStack>
            <Paragraph color="$color12" fontWeight="900">
              {formatSensitiveAmount(item.amount, report.filters.currency)}
            </Paragraph>
          </XStack>
        ))
      )}
    </FintCard>
  );
}

function AccountActivityCard({
  report,
  text,
}: {
  report: FinancialReportPeriod;
  text: ReportText;
}) {
  const { formatSensitiveAmount } = useSensitiveMoney();
  return (
    <FintCard gap="$3">
      <ReportCardHeader
        icon={<Landmark size={19} color="$primary" />}
        title={text.accountActivity}
      />
      {report.accountActivity.length === 0 ? (
        <WidgetEmpty message={text.noData} />
      ) : (
        report.accountActivity.map((item) => (
          <XStack key={item.id} items="center" gap="$3">
            <YStack
              width={38}
              height={38}
              rounded="$8"
              bg="$secondary"
              items="center"
              justify="center"
            >
              <Landmark size={18} color="$primary" />
            </YStack>
            <YStack flex={1}>
              <Paragraph color="$color12" fontWeight="800">
                {item.name}
              </Paragraph>
              <Paragraph color="$color10" fontSize="$1" numberOfLines={2}>
                {item.transactionCount} {text.transactions.toLowerCase()} ·{" "}
                {text.income}:{" "}
                {formatSensitiveAmount(item.income, report.filters.currency)} ·{" "}
                {text.expenses}:{" "}
                {formatSensitiveAmount(item.expenses, report.filters.currency)}
              </Paragraph>
            </YStack>
            <Paragraph
              color={item.net >= 0 ? "$green10" : "$red10"}
              fontWeight="900"
            >
              {formatSensitiveAmount(item.net, report.filters.currency)}
            </Paragraph>
          </XStack>
        ))
      )}
    </FintCard>
  );
}

function CurrentPositionCard({
  currency,
  position,
  text,
}: {
  currency: string;
  position: FinancialReportPosition;
  text: ReportText;
}) {
  const { formatSensitiveAmount } = useSensitiveMoney();
  return (
    <FintCard gap="$3">
      <ReportCardHeader
        icon={<WalletCards size={19} color="$primary" />}
        title={text.currentPosition}
      />
      <Paragraph color="$color10" fontSize="$1">
        {text.currentSnapshotNote}
      </Paragraph>
      <XStack gap="$2">
        <PositionMetric
          label={text.balance}
          value={formatSensitiveAmount(position.totalAccountBalance, currency)}
        />
        <PositionMetric
          label={text.outstanding}
          value={formatSensitiveAmount(position.totalDebtOutstanding, currency)}
        />
      </XStack>
      <PositionMetric
        label={text.net}
        value={formatSensitiveAmount(position.netPosition, currency)}
        emphasis
      />
      {position.accounts.length === 0 && position.debts.length === 0 ? (
        <WidgetEmpty message={text.noData} />
      ) : null}
      {position.accounts.map((item) => (
        <XStack key={item.id} items="center" gap="$3">
          <Landmark size={17} color="$primary" />
          <Paragraph color="$color12" fontWeight="700" flex={1}>
            {item.name}
          </Paragraph>
          <Paragraph color="$color12" fontWeight="900">
            {formatSensitiveAmount(item.balance, item.currency)}
          </Paragraph>
        </XStack>
      ))}
      {position.debts.length ? (
        <>
          <Paragraph color="$color12" fontWeight="800" mt="$2">
            {text.debts}
          </Paragraph>
          {position.debts.map((item) => (
            <XStack key={item.id} items="center" gap="$3">
              <CreditCard
                size={17}
                color={item.status === "overdue" ? "$red10" : "$primary"}
              />
              <YStack flex={1}>
                <Paragraph color="$color12" fontWeight="700">
                  {item.description}
                </Paragraph>
                <Paragraph color="$color10" fontSize="$1">
                  {item.paidPercentage}% {text.progress.toLowerCase()}
                </Paragraph>
              </YStack>
              <Paragraph color="$color12" fontWeight="900">
                {formatSensitiveAmount(item.outstanding, item.currency)}
              </Paragraph>
            </XStack>
          ))}
        </>
      ) : null}
    </FintCard>
  );
}

function PositionMetric({
  emphasis = false,
  label,
  value,
}: {
  emphasis?: boolean;
  label: string;
  value: string;
}) {
  return (
    <YStack
      flex={1}
      minH={64}
      bg={emphasis ? "$accent2" : "$secondary"}
      borderColor={emphasis ? "$accent5" : "transparent"}
      borderWidth={1}
      rounded="$5"
      p="$3"
      gap="$1"
    >
      <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>
        {label}
      </Paragraph>
      <Paragraph
        color={emphasis ? "$primary" : "$color12"}
        fontSize={emphasis ? "$4" : "$3"}
        fontWeight="900"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Paragraph>
    </YStack>
  );
}

function TopTransactionsCard({
  currency,
  locale,
  text,
  transactions,
}: {
  currency: string;
  locale: string;
  text: ReportText;
  transactions: FinancialTopTransaction[];
}) {
  const { formatSensitiveAmount } = useSensitiveMoney();
  return (
    <FintCard gap="$3">
      <ReportCardHeader
        icon={<ArrowUpRight size={19} color="$primary" />}
        title={text.topTransactions}
      />
      {transactions.length === 0 ? (
        <WidgetEmpty message={text.noData} />
      ) : (
        transactions.map((item, index) => (
          <XStack key={item.id} items="center" gap="$3">
            <YStack
              width={30}
              height={30}
              rounded="$8"
              bg="$secondary"
              items="center"
              justify="center"
            >
              <Paragraph color="$primary" fontWeight="900">
                {index + 1}
              </Paragraph>
            </YStack>
            <YStack flex={1}>
              <Paragraph color="$color12" fontWeight="800">
                {item.category}
              </Paragraph>
              <Paragraph color="$color10" fontSize="$1">
                {formatDate(item.date, locale)} · {item.account}
              </Paragraph>
            </YStack>
            <Paragraph
              color={item.type === "income" ? "$green10" : "$red10"}
              fontWeight="900"
            >
              {formatSensitiveAmount(item.amount, currency)}
            </Paragraph>
          </XStack>
        ))
      )}
    </FintCard>
  );
}

function ReportsSkeleton({ label }: { label: string }) {
  return (
    <SkeletonGroup label={label}>
      <SkeletonBlock height={12} width="64%" />
      <SkeletonContentCard rows={1} />
      <SkeletonMetricGrid />
      <SkeletonSection height={286} />
      <SkeletonContentCard rows={4} />
      <SkeletonContentCard rows={3} />
    </SkeletonGroup>
  );
}

function localizeReport(
  report: FinancialReport,
  t: TFunction,
): FinancialReport {
  const categoryName = (name: string) => getCategoryLabel(name, t);
  const transaction = (item: FinancialReport["topTransactions"][number]) => ({
    ...item,
    category: categoryName(item.category),
  });
  return {
    ...report,
    categories: report.categories.map((item) => ({
      ...item,
      icon: getExpenseCategoryIcon(item.name, item.icon),
      name: categoryName(item.name),
    })),
    highlights: {
      topExpenseCategory: report.highlights.topExpenseCategory
        ? {
            ...report.highlights.topExpenseCategory,
            icon: getExpenseCategoryIcon(
              report.highlights.topExpenseCategory.name,
              report.highlights.topExpenseCategory.icon,
            ),
            name: categoryName(report.highlights.topExpenseCategory.name),
          }
        : null,
      largestTransaction: report.highlights.largestTransaction
        ? transaction(report.highlights.largestTransaction)
        : null,
    },
    topTransactions: report.topTransactions.map(transaction),
  };
}

function getExpenseCategoryIcon(name: string, icon: string | null) {
  return icon || suggestedCategoryIcons(name, "expense")[0];
}

function previousDay(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}
function formatSeriesPeriod(
  value: string,
  grouping: "week" | "month",
  locale: string,
) {
  const start = new Date(`${value}T12:00:00Z`);
  if (grouping === "month")
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      timeZone: "UTC",
    }).format(start);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const dayFormatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    timeZone: "UTC",
  });
  const monthFormatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  });
  const startDay = dayFormatter.format(start);
  const endDay = dayFormatter.format(end);
  const endMonth = monthFormatter.format(end).replace(".", "");
  if (start.getUTCMonth() === end.getUTCMonth())
    return `${startDay}-${endDay} ${endMonth}`;
  return `${startDay} ${monthFormatter.format(start).replace(".", "")}-${endDay} ${endMonth}`;
}
