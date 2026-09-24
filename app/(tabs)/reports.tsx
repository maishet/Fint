import { useQuery } from "@tanstack/react-query";
import * as Sentry from "@sentry/react-native";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  Minus,
  Share,
  RotateCcw,
  Table2,
  Wallet,
} from "@tamagui/lucide-icons-2";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import type { TFunction } from "i18next";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack, useTheme, type ColorTokens } from "tamagui";
import { financeApi } from "../../src/api/finance";
import type { FinancialReport, FinancialReportPeriod, FinancialReportPosition, FinancialTopTransaction } from "../../src/api/types";
import { DataStateCard } from "../../src/components/DataStateCard";
import { floatingTabBarHeight } from "../../src/components/FintTabBar";
import { suggestedCategoryIcons } from "../../src/finance/categoryIcons";
import { getCategoryLabel } from "../../src/finance/categoryLabels";
import { exportFinancialReportPdf, exportFinancialReportXlsx, type ReportExportLabels } from "../../src/finance/report-export";
import { useCategoryIcons } from "../../src/finance/useCategoryIcons";
import { categoryColorIndex } from "../../src/home/spending";
import { getAppLocale } from "../../src/i18n";
import { CategoryBreakdown } from "../../src/reports/CategoryBreakdown";
import { FlowChart, type FlowChartColumn } from "../../src/reports/FlowChart";
import {
  categoryRows,
  changePercent,
  dailyFlow,
  fillSeries,
  isCurrentPeriod,
  periodGrouping,
  periodRange,
  periodStart,
  shiftPeriod,
  type CategoryRow,
  type PeriodKind,
} from "../../src/reports/logic";
import { useThemeMode } from "../../src/theme/ThemeMode";
import { radius, space } from "../../src/theme/tokens";
import { fontFace } from "../../src/theme/typography";
import { Amount, FintCard, FintSheet, FText, IconButton, ListRow, Monogram, PressableScale, SegmentedControl } from "../../src/ui";
import { AmountSkeleton } from "../../src/ui/AmountSkeleton";
import { useNotify } from "../../src/ui/notify";

const ALL_ACCOUNTS = "__all__";
const PERIODS: PeriodKind[] = ["week", "month", "year"];

/** Las claves de `reports.*` que usa la exportación (PDF y Excel), igual que antes. */
const REPORT_TEXT_KEYS = [
  "title", "subtitle", "closing", "filters", "period", "account", "currency", "allAccounts", "currentMonth", "previousMonth",
  "last3Months", "last6Months", "customRange", "fromDate", "toDate", "customRangeHint", "updated", "mixed", "loading", "error",
  "empty", "exportTitle", "exportPdf", "exportExcel", "exporting", "exported", "exportError", "executiveSummary", "financialStatus",
  "income", "expenses", "net", "savingsRate", "transactions", "previousPeriod", "flow", "categories", "accountActivity",
  "currentPosition", "accounts", "debts", "topTransactions", "category", "date", "type", "amount", "balance", "outstanding",
  "dueDate", "progress", "noData", "currentSnapshotNote", "incomeType", "expenseType", "viewMovements", "comparison",
  "topCategory", "largestMovement", "noPrevious",
] as const;

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Dentro de una frase el mes va en minúscula ("vs. agosto"); en inglés, como lo da Intl. */
function inSentence(text: string, locale: string) {
  return locale.startsWith("en") ? text : text.toLocaleLowerCase(locale);
}

function parseIso(value: string) {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Mes corto sin punto y, salvo en inglés, en minúscula: suelto, Intl lo da con mayúscula ("Set"). */
function monthShort(date: Date, locale: string) {
  return inSentence(new Intl.DateTimeFormat(locale, { month: "short" }).format(date).replace(".", ""), locale);
}

function shortDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date).replace(".", "");
}

/** Nombre del periodo entre las flechas: "Setiembre 2026", "21–27 set" o "2026". */
function periodTitle(kind: PeriodKind, start: Date, locale: string) {
  if (kind === "year") return String(start.getFullYear());
  if (kind === "month") return capitalize(`${new Intl.DateTimeFormat(locale, { month: "long" }).format(start)} ${start.getFullYear()}`);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const month = (d: Date) => monthShort(d, locale);
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${month(end)}`
    : `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)}`;
}

/**
 * Tab Reportes v3: el análisis completo de un periodo. Título con descargar,
 * Semana / Mes / Año con flechas y la píldora de cuenta, la tarjeta de estado
 * (neto, etiqueta, ingresos y egresos con su variación), el flujo con la lente,
 * el donut de categorías, los mayores gastos y la posición al día de hoy.
 *
 * Conserva la lógica anterior: el reporte del periodo, la posición y las
 * mayores transacciones del backend, el filtro de cuenta y moneda, el aviso de
 * varias monedas y la exportación a PDF y Excel.
 */
export default function ReportsScreen() {
  const { t, i18n } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const toast = useNotify();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { themeMode } = useThemeMode();
  const iconFor = useCategoryIcons();

  const [kind, setKind] = useState<PeriodKind>("month");
  const [start, setStart] = useState(() => periodStart("month", new Date()));
  const [accountId, setAccountId] = useState(ALL_ACCOUNTS);
  const [currency, setCurrency] = useState("");
  const [sheet, setSheet] = useState<"account" | "currency" | "export" | "top" | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [pulling, setPulling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(themeMode === "dark" ? "light" : "dark");
      return () => setStatusBarStyle("light");
    }, [themeMode]),
  );

  const today = new Date();
  const current = isCurrentPeriod(kind, start, today);
  const range = periodRange(kind, start);
  const account = accountId !== ALL_ACCOUNTS ? { accountId } : {};
  const filters = { ...range, grouping: periodGrouping(kind), ...account, ...(currency ? { currency } : {}) };

  const optionsQuery = useQuery({
    queryKey: ["reports", "financial", "options"],
    queryFn: ({ signal }) => financeApi.getFinancialReportOptions(signal),
    staleTime: 5 * 60_000,
  });
  const periodQuery = useQuery({
    queryKey: ["reports", "financial", "period", filters],
    queryFn: ({ signal }) => financeApi.getFinancialReportPeriod(filters, signal),
  });
  const selectedCurrency = currency || periodQuery.data?.filters.currency || optionsQuery.data?.baseCurrency || "";
  const positionQuery = useQuery({
    queryKey: ["reports", "financial", "position", accountId, selectedCurrency],
    queryFn: ({ signal }) => financeApi.getFinancialReportPosition({ ...account, currency: selectedCurrency }, signal),
    enabled: Boolean(selectedCurrency),
  });
  const topQuery = useQuery({
    queryKey: ["reports", "financial", "top-transactions", range.from, range.to, accountId, selectedCurrency],
    queryFn: ({ signal }) => financeApi.getFinancialTopTransactions({ ...range, ...account, currency: selectedCurrency, limit: 10 }, signal),
    enabled: Boolean(selectedCurrency),
  });
  // La semana se dibuja por día: el backend agrupa por semana o por mes, así que los días se arman aquí.
  const weekQuery = useQuery({
    queryKey: ["transactions", "reports-week", range.from, range.to, accountId],
    queryFn: () => financeApi.listAllTransactions({ ...range, ...account }),
    enabled: kind === "week",
  });

  const report = periodQuery.data;
  const hasMovements = Boolean(report?.summary.transactionCount);
  const accounts = optionsQuery.data?.accounts ?? [];
  const currencies = optionsQuery.data?.currencies ?? [];
  const accountLabel = accountId === ALL_ACCOUNTS ? t("reportsTab.allAccounts") : (accounts.find((a) => a.id === accountId)?.name ?? t("reportsTab.allAccounts"));

  const changeKind = (next: PeriodKind) => {
    setKind(next);
    // Desde el periodo actual se va al actual del otro tipo; desde uno pasado, al que lo contiene.
    setStart(periodStart(next, current ? new Date() : start));
  };

  const previousLabel =
    kind === "week"
      ? t("reportsTab.previousWeek")
      : kind === "month"
        ? inSentence(new Intl.DateTimeFormat(locale, { month: "long" }).format(shiftPeriod("month", start, -1)), locale)
        : String(start.getFullYear() - 1);

  const columns = useMemo<FlowChartColumn[]>(() => {
    if (kind === "week") {
      if (!selectedCurrency) return [];
      const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
      const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: "long" });
      return dailyFlow(weekQuery.data ?? [], start, selectedCurrency).map((d) => {
        const date = parseIso(d.start);
        return {
          key: d.start,
          label: `${weekday.format(date).replace(".", "")} ${date.getDate()}`,
          title: capitalize(`${weekdayLong.format(date)} ${date.getDate()}`),
          income: d.income,
          expenses: d.expenses,
        };
      });
    }
    const end = parseIso(range.to);
    end.setDate(end.getDate() - 1);
    if (!report) return [];
    return fillSeries(kind, start, report.series, new Date()).map((s) => {
      const from = parseIso(s.start);
      if (kind === "year") {
        return {
          key: s.start,
          label: monthShort(from, locale),
          title: capitalize(new Intl.DateTimeFormat(locale, { month: "long" }).format(from)),
          income: s.income,
          expenses: s.expenses,
        };
      }
      const to = new Date(Math.min(new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6).getTime(), end.getTime()));
      const month = (d: Date) => monthShort(d, locale);
      // "7-13 set"; una semana que empieza en el mes anterior se lee "31-6 set" y su resumen, completo.
      const label = `${from.getDate()}-${to.getDate()} ${month(to)}`;
      const title = from.getMonth() === to.getMonth() ? label : `${from.getDate()} ${month(from)} – ${to.getDate()} ${month(to)}`;
      return { key: s.start, label, title, income: s.income, expenses: s.expenses };
    });
  }, [kind, locale, range.to, report, selectedCurrency, start, weekQuery.data]);
  // La columna de hoy si el periodo es el actual; si no, la última.
  const initialIndex = useMemo(() => {
    if (!current) return Math.max(0, columns.length - 1);
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    let i = 0;
    columns.forEach((c, j) => {
      if (c.key <= todayIso) i = j;
    });
    return i;
  }, [columns, current]);

  const rows = useMemo(
    () =>
      categoryRows(
        (report?.categories ?? []).map((c) => ({ ...c, label: getCategoryLabel(c.name, t) })),
        t("reportsTab.other"),
      ),
    [report?.categories, t],
  );
  const topExpenses = (topQuery.data ?? []).filter((x) => x.type === "expense");

  const exportReport = async (format: "pdf" | "xlsx") => {
    setIsExporting(true);
    const labels = Object.fromEntries(REPORT_TEXT_KEYS.map((key) => [key, t(`reports.${key}`)]));
    const options = {
      locale,
      labels: {
        ...labels,
        statuses: t("reports.statuses", { returnObjects: true }),
        statusMessages: t("reports.statusMessages", { returnObjects: true }),
        generated: t("reports.updated"),
        accountTypes: {
          cash: t("accountTypes.cash"),
          credit_card: t("accountTypes.creditCard"),
          checking_account: t("accountTypes.checkingAccount"),
          savings_account: t("accountTypes.savingsAccount"),
        },
      } as unknown as ReportExportLabels,
    };
    const task = (async () => {
      const data = localizeReport(await financeApi.getFinancialReportExportData(filters), t);
      if (format === "pdf") await exportFinancialReportPdf(data, options);
      else await exportFinancialReportXlsx(data, options);
    })();
    toast.promise(task, { loading: t("reports.exporting"), success: t("reports.exported"), error: t("reports.exportError") });
    try {
      await task;
    } catch (error) {
      Sentry.captureException(error, { tags: { operation: `report_export_${format}` } });
    } finally {
      setIsExporting(false);
    }
  };

  const openCategory = (row: CategoryRow) => {
    if (!row.key) return;
    // Movimientos busca en todo el historial por el nombre de la categoría (el contrato aún no filtra por categoría).
    router.navigate({ pathname: "/(tabs)/movements", params: { q: row.key, qt: String(Date.now()) } });
  };

  const error = optionsQuery.error ?? periodQuery.error;

  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <ScrollView
        contentContainerStyle={{ paddingTop: space[2], paddingBottom: floatingTabBarHeight(insets.bottom) + space[4] }}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => {
              setPulling(true);
              void Promise.all([periodQuery.refetch(), positionQuery.refetch(), topQuery.refetch(), kind === "week" ? weekQuery.refetch() : null]).finally(() =>
                setPulling(false),
              );
            }}
            tintColor={theme.brand.val}
            colors={[theme.brand.val]}
            progressBackgroundColor={theme.surface.val}
          />
        }
      >
        {/* Título y descargar el reporte (PDF o Excel). */}
        <XStack items="center" justify="space-between" px={space[4]} gap={space[3]}>
          <FText variant="display-lg" accessibilityRole="header">
            {t("reportsTab.title")}
          </FText>
          <IconButton
            label={t("reportsTab.share")}
            icon={<Share size={18} color="$ink" strokeWidth={2} />}
            disabled={!hasMovements || isExporting}
            style={{ opacity: !hasMovements || isExporting ? 0.42 : 1 }}
            onPress={() => setSheet("export")}
          />
        </XStack>

        {/* Periodo: Semana, Mes o Año; flechas entre periodos y la cuenta. */}
        <View mx={space[4]} mt={14}>
          <SegmentedControl
            options={PERIODS.map((p) => ({ value: p, label: t(`reportsTab.periods.${p}`) }))}
            value={kind}
            onChange={changeKind}
            accessibilityLabel={t("reportsTab.periodsLabel")}
          />
        </View>
        {/* El periodo tiene su fila: con una cuenta de nombre largo, la fecha ya no se corta. */}
        <XStack mx={space[4]} mt={12} items="center" justify="space-between" gap={space[3]}>
          <ArrowButton label={t("reportsTab.previous")} onPress={() => setStart(shiftPeriod(kind, start, -1))}>
            <ChevronLeft size={16} color="$inkMuted" strokeWidth={2.2} />
          </ArrowButton>
          <FText variant="body-strong" numberOfLines={1} style={{ flex: 1, textAlign: "center" }} accessibilityLiveRegion="polite">
            {periodTitle(kind, start, locale)}
          </FText>
          <ArrowButton label={t("reportsTab.next")} disabled={current} onPress={() => setStart(shiftPeriod(kind, start, 1))}>
            <ChevronRight size={16} color="$inkMuted" strokeWidth={2.2} />
          </ArrowButton>
        </XStack>
        {/* Los filtros, debajo y con todo el ancho: la cuenta con su icono para que se lea como filtro. */}
        <XStack mx={space[4]} mt={10} items="center" gap={8}>
          <View shrink={1}>
            <Pill
              icon={<Wallet size={14} color="$inkMuted" strokeWidth={2} />}
              label={accountLabel}
              a11yLabel={`${t("reportsTab.account")}: ${accountLabel}`}
              onPress={() => setSheet("account")}
            />
          </View>
          {currencies.length > 1 ? (
            <Pill label={selectedCurrency} a11yLabel={`${t("reportsTab.currency")}: ${selectedCurrency}`} onPress={() => setSheet("currency")} />
          ) : null}
          {/* Lejos del periodo actual, un toque para volver a él en lugar de ir de uno en uno con las flechas. */}
          {!current ? (
            <PressableScale
              onPress={() => setStart(periodStart(kind, new Date()))}
              haptic="select"
              hitSlop={6}
              style={{ marginLeft: "auto" }}
              accessibilityRole="button"
              accessibilityLabel={t("reportsTab.backToCurrentA11y")}
            >
              <XStack height={34} px={12} gap={6} items="center" rounded={radius.pill} bg="$brandWash">
                <RotateCcw size={14} color="$brand" strokeWidth={2.2} />
                <FText variant="label" tone="brand" numberOfLines={1} style={{ fontSize: 13, fontFamily: fontFace.sans[600] }}>
                  {t(`reportsTab.backToCurrent.${kind}`)}
                </FText>
              </XStack>
            </PressableScale>
          ) : null}
        </XStack>

        {currencies.length > 1 ? (
          <XStack mx={space[4]} mt={space[3]} px={space[4]} py={12} gap={10} rounded={radius.md} bg="$surfaceSunken" items="center">
            <Info size={16} color="$inkMuted" />
            <FText variant="caption" tone="inkMuted" style={{ flex: 1 }}>
              {t("reports.mixed")}
            </FText>
          </XStack>
        ) : null}

        {error ? (
          <View mx={space[4]} mt={space[4]}>
            <DataStateCard
              message={t("states.error")}
              onRetry={() => {
                void optionsQuery.refetch();
                void periodQuery.refetch();
              }}
            />
          </View>
        ) : null}

        {periodQuery.isLoading ? (
          <ReportSkeleton />
        ) : report ? (
          <>
            <StatusCard report={report} kind={kind} previousLabel={previousLabel} />

            <Section title={t(`reportsTab.flow.${kind}`)}>
              <FintCard p={space[5]}>
                {(kind === "week" && weekQuery.isLoading) || columns.length === 0 ? (
                  kind === "week" && weekQuery.isLoading ? (
                    <AmountSkeleton width={200} height={120} />
                  ) : (
                    <EmptyLine text={t("reportsTab.flowEmpty")} />
                  )
                ) : columns.every((c) => c.income === 0 && c.expenses === 0) ? (
                  <EmptyLine text={t("reportsTab.flowEmpty")} />
                ) : (
                  <FlowChart columns={columns} currency={report.filters.currency} initialIndex={initialIndex} />
                )}
              </FintCard>
            </Section>

            <Section
              title={t("reportsTab.categories")}
              trailing={
                rows.length > 0 ? (
                  <FText variant="caption" tone="inkFaint">
                    {t("reportsTab.vs", { period: previousLabel })}
                  </FText>
                ) : null
              }
            >
              <FintCard p={space[5]}>
                {rows.length === 0 ? (
                  <EmptyLine text={t("reportsTab.categoriesEmpty")} />
                ) : (
                  <CategoryBreakdown rows={rows} currency={report.filters.currency} onOpen={openCategory} />
                )}
              </FintCard>
            </Section>

            <Section
              title={t("reportsTab.topExpenses")}
              trailing={
                topExpenses.length > 3 ? (
                  <PressableScale onPress={() => setSheet("top")} haptic="tap" hitSlop={8} accessibilityRole="button">
                    <XStack items="center" gap={2}>
                      <FText variant="label" tone="brand" style={{ fontSize: 13, fontFamily: fontFace.sans[600] }}>
                        {t("reportsTab.seeAll")}
                      </FText>
                      <ChevronRight size={14} color="$brand" strokeWidth={2.2} />
                    </XStack>
                  </PressableScale>
                ) : null
              }
            >
              <FintCard p={0} overflow="hidden">
                {topQuery.isLoading ? (
                  <View p={space[5]}>
                    <AmountSkeleton width={220} height={14} />
                  </View>
                ) : topExpenses.length === 0 ? (
                  <View p={space[5]}>
                    <EmptyLine text={t("reportsTab.topEmpty")} />
                  </View>
                ) : (
                  topExpenses.slice(0, 3).map((item, i) => (
                    <TopExpenseRow key={item.id} item={item} first={i === 0} locale={locale} emoji={iconFor(item.category, "expense")} currency={report.filters.currency} />
                  ))
                )}
              </FintCard>
            </Section>

            <PositionCard position={positionQuery.data} loading={positionQuery.isLoading} currency={report.filters.currency} locale={locale} />
          </>
        ) : null}
      </ScrollView>

      <FintSheet open={sheet === "account"} onClose={() => setSheet(null)} title={t("reportsTab.account")}>
        <View height={8} />
        {[{ id: ALL_ACCOUNTS, name: t("reportsTab.allAccounts"), currency: "" }, ...accounts].map((a, i) => (
          <ListRow
            key={a.id}
            divider={i > 0}
            title={a.name}
            subtitle={a.currency || undefined}
            trailing={a.id === accountId ? <Check size={18} color="$brand" strokeWidth={2.4} /> : undefined}
            onPress={() => {
              setAccountId(a.id);
              // Una cuenta es de una moneda: el reporte pasa a esa moneda.
              if (a.currency) setCurrency(a.currency);
              setSheet(null);
            }}
          />
        ))}
      </FintSheet>
      <FintSheet open={sheet === "currency"} onClose={() => setSheet(null)} title={t("reportsTab.currency")}>
        <View height={8} />
        {currencies.map((c, i) => (
          <ListRow
            key={c}
            divider={i > 0}
            title={c}
            trailing={c === selectedCurrency ? <Check size={18} color="$brand" strokeWidth={2.4} /> : undefined}
            onPress={() => {
              setCurrency(c);
              setSheet(null);
            }}
          />
        ))}
      </FintSheet>
      <FintSheet open={sheet === "export"} onClose={() => setSheet(null)} title={t("reports.exportTitle")}>
        <View height={8} />
        <ListRow
          title={t("reports.exportPdf")}
          leading={<FileText size={20} color="$ink" />}
          onPress={() => {
            setSheet(null);
            void exportReport("pdf");
          }}
        />
        <ListRow
          divider
          title={t("reports.exportExcel")}
          leading={<Table2 size={20} color="$ink" />}
          onPress={() => {
            setSheet(null);
            void exportReport("xlsx");
          }}
        />
      </FintSheet>
      <FintSheet open={sheet === "top"} onClose={() => setSheet(null)} title={t("reportsTab.topExpenses")} subtitle={periodTitle(kind, start, locale)} scrollable snapPoints={[70]}>
        <View height={4} />
        {topExpenses.map((item, i) => (
          <TopExpenseRow key={item.id} item={item} first={i === 0} locale={locale} emoji={iconFor(item.category, "expense")} currency={report?.filters.currency ?? selectedCurrency} />
        ))}
      </FintSheet>
    </YStack>
  );
}

function ArrowButton({ label, disabled, onPress, children }: { label: string; disabled?: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} haptic="select" hitSlop={6} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}>
      <View width={32} height={32} rounded={radius.pill} bg="$surface" borderWidth={1} borderColor="$line" items="center" justify="center" opacity={disabled ? 0.38 : 1}>
        {children}
      </View>
    </PressableScale>
  );
}

function Pill({ label, a11yLabel, icon, onPress }: { label: string; a11yLabel: string; icon?: ReactNode; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} haptic="tap" accessibilityRole="button" accessibilityLabel={a11yLabel}>
      <XStack height={34} pl={icon ? 12 : 14} pr={12} gap={6} items="center" rounded={radius.pill} borderWidth={1} borderColor="$lineStrong" bg="$surface">
        {icon}
        <FText variant="label" numberOfLines={1} style={{ fontSize: 13, flexShrink: 1 }}>
          {label}
        </FText>
        <ChevronDown size={14} color="$ink" strokeWidth={2.2} />
      </XStack>
    </PressableScale>
  );
}

function Section({ title, trailing, children }: { title: string; trailing?: ReactNode; children: ReactNode }) {
  return (
    <YStack mx={space[4]} mt={space[6]}>
      <XStack items="baseline" justify="space-between" gap={space[3]} mb={space[3]}>
        <FText variant="title" accessibilityRole="header" style={{ fontSize: 20, lineHeight: 25 }}>
          {title}
        </FText>
        {trailing}
      </XStack>
      {children}
    </YStack>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <FText variant="body" tone="inkMuted" style={{ textAlign: "center", paddingVertical: space[4] }}>
      {text}
    </FText>
  );
}

/** Sin nada en el periodo anterior no hay con qué comparar (tampoco si los dos están en cero): `null`, "sin datos de…". */
function comparable(current: number, previous: number) {
  return previous === 0 ? null : changePercent(current, previous);
}

/** Variación de ingresos o egresos: verde cuando es buena noticia (ingresos que suben, egresos que bajan). */
function Change({ value, goodWhenUp, previousLabel }: { value: number | null; goodWhenUp: boolean; previousLabel: string }) {
  const { t } = useTranslation();
  const vs = t("reportsTab.vs", { period: previousLabel });
  if (value === null || value === 0) {
    // Sin nada en el periodo anterior no hay con qué comparar: "sin movimientos en agosto", no "nueva".
    return (
      <FText variant="caption" tone="inkFaint" style={{ fontSize: 11, lineHeight: 14, marginTop: 3 }} numberOfLines={1}>
        {value === null ? t("reportsTab.noPrevious", { period: previousLabel }) : `${t("reportsTab.same")} ${vs}`}
      </FText>
    );
  }
  const good = goodWhenUp ? value > 0 : value < 0;
  const tone = good ? "flowIn" : "flowOut";
  const Icon = value > 0 ? ArrowUp : ArrowDown;
  return (
    <XStack items="center" gap={4} mt={3}>
      <Icon size={11} color={`$${tone}` as ColorTokens} strokeWidth={2.6} />
      <FText variant="figure-caption" tone={tone} style={{ fontSize: 11 }}>
        {`${Math.abs(value)}%`}
      </FText>
      <FText variant="figure-caption" tone="inkFaint" style={{ fontSize: 11 }} numberOfLines={1}>
        {vs}
      </FText>
    </XStack>
  );
}

/** Neto del periodo en `flowIn` o `flowOut`, la etiqueta del estado, una frase, e ingresos y egresos con su variación. */
function StatusCard({ report, kind, previousLabel }: { report: FinancialReportPeriod; kind: PeriodKind; previousLabel: string }) {
  const { t } = useTranslation();
  const { summary } = report;
  const currency = report.filters.currency;
  const status = summary.status;
  const badge =
    status === "healthy"
      ? { icon: <Check size={12} color="$flowIn" strokeWidth={2.6} />, tone: "flowIn" as const }
      : status === "attention"
        ? { icon: <AlertTriangle size={12} color="$flowOut" strokeWidth={2.4} />, tone: "flowOut" as const }
        : status === "balanced"
          ? { icon: <Minus size={12} color="$inkMuted" strokeWidth={2.6} />, tone: "inkMuted" as const }
          : null;
  // El backend manda el porcentaje con decimales; la frase lo dice entero ("Ahorraste el 66%").
  const rate = summary.savingsRate === null ? null : Math.round(summary.savingsRate);

  let message: ReactNode;
  if (summary.transactionCount === 0) message = t("reportsTab.noData");
  else if (summary.income <= 0) message = t("reportsTab.noIncome");
  else if (rate !== null && rate > 0)
    message = (
      <>
        {`${t("reportsTab.savedBefore")} `}
        <FText variant="caption" style={{ fontSize: 13, fontFamily: fontFace.mono[500] }}>{`${rate}%`}</FText>
        {` ${t("reportsTab.savedAfter")}`}
      </>
    );
  else message = t("reportsTab.overspent");

  return (
    <FintCard mx={space[4]} mt={space[4]} p={space[5]}>
      <XStack items="center" justify="space-between" gap={space[3]}>
        <FText variant="caption" tone="inkMuted" style={{ fontSize: 13 }}>
          {t(`reportsTab.net.${kind}`)}
        </FText>
        {badge ? (
          <XStack height={24} px={10} gap={5} items="center" rounded={radius.pill} bg="$surfaceSunken">
            {badge.icon}
            <FText variant="caption" tone={badge.tone} style={{ fontFamily: fontFace.sans[600] }}>
              {t(`reports.statuses.${status}`)}
            </FText>
          </XStack>
        ) : null}
      </XStack>
      <Amount
        value={summary.net}
        currency={currency}
        kind={summary.net > 0 ? "income" : summary.net < 0 ? "expense" : "neutral"}
        tone={summary.net > 0 ? "flowIn" : summary.net < 0 ? "flowOut" : "ink"}
        variant="amount-lg"
        style={{ fontSize: 32, lineHeight: 36, letterSpacing: -1.2, marginTop: 4 }}
      />
      <FText variant="caption" tone="inkMuted" style={{ fontSize: 13, marginTop: 4 }}>
        {message}
      </FText>
      <XStack mt={16} pt={14} borderTopWidth={1} borderColor="$line">
        <YStack flex={1} minW={0} pr={space[3]}>
          <FText variant="caption" tone="inkMuted">
            {t("reportsTab.income")}
          </FText>
          <Amount value={summary.income} currency={currency} style={{ fontSize: 17, lineHeight: 22, letterSpacing: -0.4, marginTop: 2 }} />
          <Change value={comparable(summary.income, summary.previousIncome)} goodWhenUp previousLabel={previousLabel} />
        </YStack>
        <YStack flex={1} minW={0} pl={space[4]} borderLeftWidth={1} borderColor="$line">
          <FText variant="caption" tone="inkMuted">
            {t("reportsTab.expenses")}
          </FText>
          <Amount value={summary.expenses} currency={currency} style={{ fontSize: 17, lineHeight: 22, letterSpacing: -0.4, marginTop: 2 }} />
          <Change value={comparable(summary.expenses, summary.previousExpenses)} goodWhenUp={false} previousLabel={previousLabel} />
        </YStack>
      </XStack>
    </FintCard>
  );
}

/** Una de las mayores transacciones: el emoji de su categoría, la nota (o la categoría), la fecha y el monto. */
function TopExpenseRow({ item, first, locale, emoji, currency }: { item: FinancialTopTransaction; first: boolean; locale: string; emoji: string | null; currency: string }) {
  const { t } = useTranslation();
  const category = getCategoryLabel(item.category, t);
  const date = shortDate(parseIso(item.date), locale);
  return (
    <XStack items="center" gap={space[3]} px={space[4]} py={space[3]} borderTopWidth={first ? 0 : 1} borderColor="$line">
      <Monogram name={category} emoji={emoji} color={`$chart${categoryColorIndex(category)}` as ColorTokens} />
      <YStack flex={1} minW={0}>
        <FText variant="body-strong" numberOfLines={1} style={{ letterSpacing: -0.15 }}>
          {category}
        </FText>
        <FText variant="caption" tone="inkFaint" numberOfLines={1} style={{ marginTop: 1 }}>
          {`${date} · ${item.account}`}
        </FText>
      </YStack>
      <Amount value={item.amount} currency={currency} kind="expense" />
    </XStack>
  );
}

/** Una barra partida entre lo que hay en cuentas (`chart-1`) y lo que se debe (`flowOut`), los dos montos y la posición neta. */
function PositionCard({ position, loading, currency, locale }: { position?: FinancialReportPosition; loading: boolean; currency: string; locale: string }) {
  const { t } = useTranslation();
  const asOf = position ? parseIso(position.asOf) : new Date();
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(asOf);
  const accounts = Math.max(0, position?.totalAccountBalance ?? 0);
  const debts = Math.max(0, position?.totalDebtOutstanding ?? 0);
  return (
    <Section title={t("reportsTab.position", { date })}>
      <FintCard p={space[5]}>
        {loading || !position ? (
          <AmountSkeleton width={220} height={14} />
        ) : (
          <>
            <XStack height={10} rounded={radius.pill} overflow="hidden" gap={accounts > 0 && debts > 0 ? 2 : 0} mb={12} bg="$chartTrack">
              {accounts > 0 ? <View height="100%" bg="$chart1" style={{ flex: accounts }} /> : null}
              {debts > 0 ? <View height="100%" bg="$flowOut" style={{ flex: debts }} /> : null}
            </XStack>
            <XStack justify="space-between" items="center">
              <FText variant="caption" tone="inkMuted" style={{ fontSize: 13 }}>
                {t("reportsTab.accounts")}
              </FText>
              <Amount value={position.totalAccountBalance} currency={currency} variant="amount-sm" />
            </XStack>
            <XStack justify="space-between" items="center" mt={6}>
              <FText variant="caption" tone="inkMuted" style={{ fontSize: 13 }}>
                {t("reportsTab.debts")}
              </FText>
              <Amount value={-Math.abs(position.totalDebtOutstanding)} currency={currency} variant="amount-sm" />
            </XStack>
            <XStack justify="space-between" items="center" mt={10} pt={10} borderTopWidth={1} borderColor="$line">
              <FText variant="body-strong" style={{ fontSize: 14 }}>
                {t("reportsTab.netPosition")}
              </FText>
              <Amount value={position.netPosition} currency={currency} style={{ fontSize: 14, fontFamily: fontFace.mono[600] }} />
            </XStack>
          </>
        )}
      </FintCard>
    </Section>
  );
}

function ReportSkeleton() {
  return (
    <YStack mx={space[4]} mt={space[4]} gap={space[4]}>
      <FintCard p={space[5]} gap={10}>
        <AmountSkeleton width={110} height={12} />
        <AmountSkeleton width={190} height={28} />
        <AmountSkeleton width={170} height={12} />
      </FintCard>
      <FintCard p={space[5]} gap={10}>
        <AmountSkeleton width={140} height={12} />
        <AmountSkeleton width={260} height={110} />
      </FintCard>
    </YStack>
  );
}

function localizeReport(report: FinancialReport, t: TFunction): FinancialReport {
  const categoryName = (name: string) => getCategoryLabel(name, t);
  const icon = (name: string, value: string | null) => value || suggestedCategoryIcons(name, "expense")[0];
  const transaction = (item: FinancialReport["topTransactions"][number]) => ({ ...item, category: categoryName(item.category) });
  return {
    ...report,
    categories: report.categories.map((item) => ({ ...item, icon: icon(item.name, item.icon), name: categoryName(item.name) })),
    highlights: {
      topExpenseCategory: report.highlights.topExpenseCategory
        ? {
            ...report.highlights.topExpenseCategory,
            icon: icon(report.highlights.topExpenseCategory.name, report.highlights.topExpenseCategory.icon),
            name: categoryName(report.highlights.topExpenseCategory.name),
          }
        : null,
      largestTransaction: report.highlights.largestTransaction ? transaction(report.highlights.largestTransaction) : null,
    },
    topTransactions: report.topTransactions.map(transaction),
  };
}
