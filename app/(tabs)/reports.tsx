import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Minus,
  Share,
  RotateCcw,
  Wallet,
} from "@tamagui/lucide-icons-2";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, useWindowDimensions, type View as NativeView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack, useTheme, type ColorTokens } from "tamagui";
import { financeApi } from "../../src/api/finance";
import type { FinancialReport, FinancialReportPeriod, FinancialReportPosition, FinancialTopTransaction } from "../../src/api/types";
import { DataStateCard } from "../../src/components/DataStateCard";
import { floatingTabBarHeight } from "../../src/components/FintTabBar";
import { suggestedCategoryIcons } from "../../src/finance/categoryIcons";
import { getCategoryLabel } from "../../src/finance/categoryLabels";
import type { ReportExportLabels, ReportExportOptions } from "../../src/finance/report-export";
import { useCategoryIcons } from "../../src/finance/useCategoryIcons";
import { getAppLocale } from "../../src/i18n";
import { CategoryBreakdown } from "../../src/reports/CategoryBreakdown";
import { FlowChart, type FlowChartColumn } from "../../src/reports/FlowChart";
import { ReportExportSheet } from "../../src/reports/ReportExportSheet";
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
import { COMPACT_FONT_SCALE, radius, space } from "../../src/theme/tokens";
import { fontFace } from "../../src/theme/typography";
import { useScreenStatusBar } from "../../src/theme/useScreenStatusBar";
import {
  Amount,
  FintCard,
  FintSheet,
  FText,
  IconButton,
  ListRow,
  Monogram,
  PressableScale,
  RowAmount,
  SegmentedControl,
  SoonBadge,
  Ticket,
  TicketBar,
  useComingSoon,
} from "../../src/ui";
import { SkeletonBlock, SkeletonGroup } from "../../src/components/Skeleton";
import { isComingSoon } from "../../src/config/comingSoon";

const ALL_ACCOUNTS = "__all__";
const PERIODS: PeriodKind[] = ["week", "month", "year"];

/** Las claves de `reports.*` que usa la exportación (PDF y Excel), igual que antes. */
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
  "customRange",
  "fromDate",
  "toDate",
  "customRangeHint",
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
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const iconFor = useCategoryIcons();

  const [kind, setKind] = useState<PeriodKind>("month");
  const [start, setStart] = useState(() => periodStart("month", new Date()));
  const [accountId, setAccountId] = useState(ALL_ACCOUNTS);
  const [currency, setCurrency] = useState("");
  const [sheet, setSheet] = useState<"account" | "currency" | "export" | "top" | null>(null);
  const [pulling, setPulling] = useState(false);

  // "Exportar" de la hoja Más llega con `open=export`: se abre la hoja de descarga y el parámetro se limpia.
  const params = useLocalSearchParams<{ open?: string }>();
  const showSoon = useComingSoon();
  useEffect(() => {
    if (params.open !== "export") return;
    if (isComingSoon("reportExport")) showSoon("reportExport");
    else setSheet("export");
    router.setParams({ open: undefined });
  }, [params.open, router, showSoon]);

  useScreenStatusBar();

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
  const accountLabel =
    accountId === ALL_ACCOUNTS ? t("reportsTab.allAccounts") : (accounts.find((a) => a.id === accountId)?.name ?? t("reportsTab.allAccounts"));

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
      const sunday = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6 - ((from.getDay() + 6) % 7));
      const to = new Date(Math.min(sunday.getTime(), end.getTime()));
      const month = (d: Date) => monthShort(d, locale);
      const label = from.getDate() === to.getDate() ? `${to.getDate()} ${month(to)}` : `${from.getDate()}-${to.getDate()} ${month(to)}`;
      return { key: s.start, label, title: label, income: s.income, expenses: s.expenses };
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

  // La descarga (`ReportExportSheet`): etapa 1 (traer los datos) y los textos del documento, igual que antes.
  const exportOptions = (): ReportExportOptions => ({
    locale,
    labels: {
      ...Object.fromEntries(REPORT_TEXT_KEYS.map((key) => [key, t(`reports.${key}`)])),
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
  });
  const prepareExport = async () => localizeReport(await financeApi.getFinancialReportExportData(filters), t);
  const exportCurrency = report?.filters.currency ?? selectedCurrency;
  const exportSubtitle = [
    periodTitle(kind, start, locale),
    // En la píldora basta "Todas"; aquí se lee suelto: "Todas las cuentas".
    accountId === ALL_ACCOUNTS ? t("reports.allAccounts") : accountLabel,
    exportCurrency ? t(`accountForm.currencyNames.${exportCurrency}`, { defaultValue: exportCurrency }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const openCategory = (row: CategoryRow) => {
    if (!row.key) return;
    // Movimientos busca en todo el historial por el nombre de la categoría (el contrato aún no filtra por categoría).
    router.navigate({ pathname: "/(tabs)/movements", params: { q: row.key, qt: String(Date.now()) } });
  };

  // Tocar una porción del donut trae su fila a la vista, solo si está tapada (arriba, o abajo detrás de la barra de tabs).
  const scrollRef = useRef<ScrollView>(null);
  // El contenido del `ScrollView`: la fila se mide contra él para saber su `y` dentro de lo desplazable.
  const contentRef = useRef<NativeView>(null);
  const scrollY = useRef(0);
  const viewportH = useRef(0);
  const revealRow = (row: NativeView) => {
    const content = contentRef.current;
    if (!content) return;
    row.measureLayout(content, (_x, y, _w, h) => {
      const top = scrollY.current;
      const bottom = top + viewportH.current - floatingTabBarHeight(insets.bottom);
      if (y >= top && y + h <= bottom) return;
      scrollRef.current?.scrollTo({
        y: Math.max(0, y - (y < top ? space[4] : viewportH.current - floatingTabBarHeight(insets.bottom) - h - space[6])),
        animated: true,
      });
    });
  };

  const error = optionsQuery.error ?? periodQuery.error;

  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <ScrollView
        ref={scrollRef}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={32}
        onLayout={(e) => {
          viewportH.current = e.nativeEvent.layout.height;
        }}
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
            tintColor={theme.ink.val}
            colors={[theme.ink.val]}
            progressBackgroundColor={theme.surface.val}
          />
        }
      >
        <View ref={contentRef} collapsable={false}>
          {/* Título y descargar el reporte (PDF o Excel). */}
          <XStack items="center" justify="space-between" px={space[5]} gap={space[3]}>
            <FText accessibilityRole="header" maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={TAB_TITLE}>
              {t("reportsTab.title")}
            </FText>
            {isComingSoon("reportExport") ? (
              // Se ve, pero todavía no se puede usar.
              <XStack items="center" gap={8}>
                <SoonBadge />
                <IconButton
                  label={t("reportsTab.share")}
                  accessibilityHint={t("comingSoon.tapHint")}
                  icon={<Share size={18} color="$ink" strokeWidth={2} />}
                  soon
                  onPress={() => showSoon("reportExport")}
                />
              </XStack>
            ) : (
              <IconButton
                label={t("reportsTab.share")}
                icon={<Share size={18} color="$ink" strokeWidth={2} />}
                disabled={!hasMovements}
                style={{ opacity: !hasMovements ? 0.42 : 1 }}
                onPress={() => setSheet("export")}
              />
            )}
          </XStack>

          {/* Periodo: Semana, Mes o Año; flechas entre periodos y la cuenta. */}
          <View mx={space[5]} mt={10}>
            <SegmentedControl
              options={PERIODS.map((p) => ({ value: p, label: t(`reportsTab.periods.${p}`) }))}
              value={kind}
              onChange={changeKind}
              accessibilityLabel={t("reportsTab.periodsLabel")}
            />
          </View>
          {/* El periodo tiene su fila: con una cuenta de nombre largo, la fecha ya no se corta. */}
          <XStack mx={space[5]} mt={12} items="center" justify="space-between" gap={space[2]}>
            <ArrowButton label={t("reportsTab.previous")} onPress={() => setStart(shiftPeriod(kind, start, -1))}>
              <ChevronLeft size={20} color="$ink" strokeWidth={2} />
            </ArrowButton>
            <FText
              numberOfLines={2}
              maxFontSizeMultiplier={1.5}
              style={{ flex: 1, textAlign: "center", fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21 }}
              accessibilityLiveRegion="polite"
            >
              {periodTitle(kind, start, locale)}
            </FText>
            <ArrowButton label={t("reportsTab.next")} disabled={current} onPress={() => setStart(shiftPeriod(kind, start, 1))}>
              <ChevronRight size={20} color="$ink" strokeWidth={2} />
            </ArrowButton>
          </XStack>
          {/* Los filtros, debajo y con todo el ancho: la cuenta con su icono para que se lea como filtro. */}
          <XStack mx={space[5]} mt={10} items="center" gap={6} flexWrap="wrap">
            <View shrink={1}>
              <Pill
                icon={<Wallet size={14} color="$ink" strokeWidth={2} />}
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
                <XStack height={32} px={12} gap={6} items="center" rounded={radius.pill} bg="$surface">
                  <RotateCcw size={14} color="$ink" strokeWidth={2.2} />
                  <FText variant="label" tone="ink" numberOfLines={1} style={{ fontSize: 13, fontFamily: fontFace.sans[600] }}>
                    {t(`reportsTab.backToCurrent.${kind}`)}
                  </FText>
                </XStack>
              </PressableScale>
            ) : null}
          </XStack>

          {currencies.length > 1 ? (
            // Varias monedas (I-07): el aviso va en una tarjeta `surface`.
            <XStack mx={space[5]} mt={10} p={14} gap={10} items="flex-start" rounded={22} bg="$surface">
              <Info size={16} color="$inkMuted" strokeWidth={2} />
              <FText tone="inkMuted" style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>
                {t("reports.mixed")}
              </FText>
            </XStack>
          ) : null}

          {error ? (
            <View mx={space[5]} mt={space[4]}>
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
                <View>
                  {(kind === "week" && weekQuery.isLoading) || columns.length === 0 ? (
                    kind === "week" && weekQuery.isLoading ? (
                      <SkeletonBlock width="100%" height={120} rounded={16} />
                    ) : (
                      <EmptyLine text={t("reportsTab.flowEmpty")} />
                    )
                  ) : columns.every((c) => c.income === 0 && c.expenses === 0) ? (
                    <EmptyLine text={t("reportsTab.flowEmpty")} />
                  ) : (
                    <FlowChart columns={columns} currency={report.filters.currency} initialIndex={initialIndex} />
                  )}
                </View>
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
                <View>
                  {rows.length === 0 ? (
                    <EmptyLine text={t("reportsTab.categoriesEmpty")} />
                  ) : (
                    <CategoryBreakdown
                      rows={rows}
                      currency={report.filters.currency}
                      onOpen={openCategory}
                      onReveal={revealRow}
                      iconFor={(name) => iconFor(name, "expense")}
                    />
                  )}
                </View>
              </Section>

              <Section
                title={t("reportsTab.topExpenses")}
                trailing={
                  topExpenses.length > 3 ? (
                    <PressableScale onPress={() => setSheet("top")} haptic="tap" hitSlop={8} accessibilityRole="button">
                      <XStack items="center" gap={2}>
                        <FText maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontSize: 14, lineHeight: 19, fontFamily: fontFace.display[700] }}>
                          {t("reportsTab.seeAll")}
                        </FText>
                        <ChevronRight size={16} color="$ink" strokeWidth={2.2} />
                      </XStack>
                    </PressableScale>
                  ) : null
                }
              >
                <View>
                  {topQuery.isLoading ? (
                    <XStack items="center" gap={12} py={10}>
                      <SkeletonBlock width={44} height={44} rounded={14} />
                      <SkeletonBlock width="50%" height={14} rounded={6} />
                    </XStack>
                  ) : topExpenses.length === 0 ? (
                    <EmptyLine text={t("reportsTab.topEmpty")} />
                  ) : (
                    topExpenses
                      .slice(0, 3)
                      .map((item, i) => (
                        <TopExpenseRow
                          key={item.id}
                          item={item}
                          first={i === 0}
                          locale={locale}
                          emoji={iconFor(item.category, "expense")}
                          currency={report.filters.currency}
                        />
                      ))
                  )}
                </View>
              </Section>

              <PositionCard position={positionQuery.data} loading={positionQuery.isLoading} currency={report.filters.currency} locale={locale} />
            </>
          ) : null}
        </View>
      </ScrollView>

      <FintSheet open={sheet === "account"} onClose={() => setSheet(null)} title={t("reportsTab.account")}>
        <View height={8} />
        {[{ id: ALL_ACCOUNTS, name: t("reportsTab.allAccounts"), currency: "" }, ...accounts].map((a, i) => (
          <ListRow
            key={a.id}
            divider={i > 0}
            title={a.name}
            subtitle={a.currency || undefined}
            trailing={a.id === accountId ? <Check size={18} color="$ink" strokeWidth={2.4} /> : undefined}
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
            trailing={c === selectedCurrency ? <Check size={18} color="$ink" strokeWidth={2.4} /> : undefined}
            onPress={() => {
              setCurrency(c);
              setSheet(null);
            }}
          />
        ))}
      </FintSheet>
      <ReportExportSheet
        open={sheet === "export"}
        onClose={() => setSheet(null)}
        subtitle={exportSubtitle}
        transactionCount={report?.summary.transactionCount ?? 0}
        fileBaseName={t("reports.export.fileName", { period: periodTitle(kind, start, locale) })}
        locale={locale}
        prepare={prepareExport}
        options={exportOptions}
      />
      <FintSheet
        open={sheet === "top"}
        onClose={() => setSheet(null)}
        title={t("reportsTab.topExpenses")}
        subtitle={periodTitle(kind, start, locale)}
        scrollable
        snapPoints={[70]}
      >
        <View height={4} px={space[5]} />
        {topExpenses.map((item, i) => (
          <TopExpenseRow
            key={item.id}
            item={item}
            first={i === 0}
            locale={locale}
            emoji={iconFor(item.category, "expense")}
            currency={report?.filters.currency ?? selectedCurrency}
          />
        ))}
      </FintSheet>
    </YStack>
  );
}

/** Título de pestaña de la marca D: 32 en Figtree Bold (no hay 800 cargado), con tope 1.3. */
const TAB_TITLE = { fontFamily: fontFace.display[700], fontSize: 32, lineHeight: 38, letterSpacing: -0.9 } as const;
/** Título de sección: 20 en Figtree Bold. */
const SECTION_TITLE = { fontFamily: fontFace.display[700], fontSize: 20, lineHeight: 25, letterSpacing: -0.4 } as const;

/** Flecha de periodo: círculo `surface` de 36 (44 de toque con `hitSlop`). */
function ArrowButton({ label, disabled, onPress, children }: { label: string; disabled?: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="select"
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <View width={36} height={36} rounded={radius.pill} bg="$surface" items="center" justify="center" opacity={disabled ? 0.38 : 1}>
        {children}
      </View>
    </PressableScale>
  );
}

/** Filtro de cuenta o moneda: ficha `surface` de 32 con el valor y la flecha, sin borde (F-07). */
function Pill({ label, a11yLabel, icon, onPress }: { label: string; a11yLabel: string; icon?: ReactNode; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} haptic="tap" hitSlop={{ top: 6, bottom: 6 }} accessibilityRole="button" accessibilityLabel={a11yLabel}>
      <XStack height={32} pl={12} pr={10} gap={4} items="center" rounded={radius.pill} bg="$surface">
        {icon}
        <FText
          numberOfLines={1}
          maxFontSizeMultiplier={COMPACT_FONT_SCALE}
          style={{ fontFamily: fontFace.sans[600], fontSize: 13, lineHeight: 18, flexShrink: 1 }}
        >
          {label}
        </FText>
        <ChevronDown size={14} color="$ink" strokeWidth={2.2} />
      </XStack>
    </PressableScale>
  );
}

function Section({ title, trailing, children }: { title: string; trailing?: ReactNode; children: ReactNode }) {
  return (
    <YStack mx={space[5]} mt={26}>
      <XStack items="center" justify="space-between" gap={space[3]} mb={10} flexWrap="wrap">
        <FText accessibilityRole="header" maxFontSizeMultiplier={1.5} style={SECTION_TITLE}>
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

/**
 * Variación de ingresos o egresos dentro de la boleta: el porcentaje en `flowInSlab` cuando es buena noticia
 * (ingresos que suben, egresos que bajan) o `flowOutSlab` si no, y "vs. octubre" en `slabMuted`.
 */
function Change({ value, goodWhenUp, previousLabel }: { value: number | null; goodWhenUp: boolean; previousLabel: string }) {
  const { t } = useTranslation();
  const vs = t("reportsTab.vs", { period: previousLabel });
  if (value === null || value === 0) {
    // Sin nada en el periodo anterior no hay con qué comparar: "sin movimientos en agosto", no "nueva".
    return (
      <FText tone="slabMuted" style={{ fontSize: 12, lineHeight: 16 }}>
        {value === null ? t("reportsTab.noPrevious", { period: previousLabel }) : `${t("reportsTab.same")} ${vs}`}
      </FText>
    );
  }
  const good = goodWhenUp ? value > 0 : value < 0;
  const tone = good ? "flowInSlab" : "flowOutSlab";
  const Icon = value > 0 ? ArrowUp : ArrowDown;
  return (
    <XStack items="center" gap={4} flexWrap="wrap">
      <Icon size={11} color={`$${tone}` as ColorTokens} strokeWidth={2.6} />
      <FText tone={tone} style={{ fontFamily: fontFace.mono[600], fontSize: 12, lineHeight: 16 }}>
        {`${Math.abs(value)}%`}
      </FText>
      <FText tone="slabMuted" style={{ fontSize: 12, lineHeight: 16 }}>
        {vs}
      </FText>
    </XStack>
  );
}

/**
 * El neto del periodo en la boleta amarilla (marca D, F-07): arriba "Neto del mes" con el estado en una píldora
 * tinta (`slabInk`, igual en los dos temas; texto amarillo, con su ícono), el neto grande con su signo y la frase del ahorro; tras el filete, ingresos y
 * egresos con su variación. Todo en las tintas de la boleta (`slabInk`, `slabMuted`).
 */
function StatusCard({ report, kind, previousLabel }: { report: FinancialReportPeriod; kind: PeriodKind; previousLabel: string }) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const { summary } = report;
  const currency = report.filters.currency;
  const status = summary.status;
  const StatusIcon = status === "healthy" ? Check : status === "attention" ? AlertTriangle : status === "balanced" ? Minus : null;
  // El backend manda el porcentaje con decimales; la frase lo dice entero ("Ahorraste el 66%").
  const rate = summary.savingsRate === null ? null : Math.round(summary.savingsRate);

  let message: ReactNode;
  if (summary.transactionCount === 0) message = t("reportsTab.noData");
  else if (summary.income <= 0) message = t("reportsTab.noIncome");
  else if (rate !== null && rate > 0)
    message = (
      <>
        {`${t("reportsTab.savedBefore")} `}
        <FText tone="slabMuted" style={{ fontSize: 13, fontFamily: fontFace.mono[600] }}>{`${rate}%`}</FText>
        {` ${t("reportsTab.savedAfter")}`}
      </>
    );
  else message = t("reportsTab.overspent");

  return (
    <View mx={space[5]} mt={14}>
      <Ticket
        top={
          <>
            <XStack items="center" justify="space-between" gap={space[3]} flexWrap="wrap">
              <FText tone="slabInk" maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.sans[600], fontSize: 14, lineHeight: 19 }}>
                {t(`reportsTab.net.${kind}`)}
              </FText>
              {StatusIcon ? (
                <XStack height={26} px={10} gap={5} items="center" rounded={radius.pill} bg="$slabInk">
                  <StatusIcon size={12} color="$slab" strokeWidth={2.6} />
                  <FText maxFontSizeMultiplier={COMPACT_FONT_SCALE} color="$slab" style={{ fontFamily: fontFace.sans[600], fontSize: 12, lineHeight: 16 }}>
                    {t(`reports.statuses.${status}`)}
                  </FText>
                </XStack>
              ) : null}
            </XStack>
            <Amount
              value={summary.net}
              currency={currency}
              kind={summary.net > 0 ? "income" : summary.net < 0 ? "expense" : "neutral"}
              variant="amount-hero"
              onSlab
              tone="slabInk"
              smallCents
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ fontSize: 44, lineHeight: 52, letterSpacing: -1, marginTop: 6 }}
            />
            <FText tone="slabMuted" style={{ fontFamily: fontFace.sans[600], fontSize: 13, lineHeight: 18, marginTop: 2 }}>
              {message}
            </FText>
          </>
        }
        bottom={
          <XStack gap={10} flexWrap={fontScale >= COMPACT_FONT_SCALE ? "wrap" : "nowrap"}>
            <YStack flex={1} minW={140} gap={2}>
              <FText tone="slabMuted" style={{ fontFamily: fontFace.sans[600], fontSize: 12, lineHeight: 16 }}>
                {t("reportsTab.income")}
              </FText>
              <Amount value={summary.income} currency={currency} onSlab style={{ fontFamily: fontFace.mono[600], fontSize: 18, lineHeight: 24 }} />
              <Change value={comparable(summary.income, summary.previousIncome)} goodWhenUp previousLabel={previousLabel} />
            </YStack>
            <YStack flex={1} minW={140} gap={2}>
              <FText tone="slabMuted" style={{ fontFamily: fontFace.sans[600], fontSize: 12, lineHeight: 16 }}>
                {t("reportsTab.expenses")}
              </FText>
              <Amount value={summary.expenses} currency={currency} onSlab style={{ fontFamily: fontFace.mono[600], fontSize: 18, lineHeight: 24 }} />
              <Change value={comparable(summary.expenses, summary.previousExpenses)} goodWhenUp={false} previousLabel={previousLabel} />
            </YStack>
          </XStack>
        }
      />
    </View>
  );
}

/** Una de las mayores transacciones: el emoji de su categoría en el cuadro de 44, la categoría, la fecha y el monto. */
function TopExpenseRow({
  item,
  first,
  locale,
  emoji,
  currency,
}: {
  item: FinancialTopTransaction;
  first: boolean;
  locale: string;
  emoji: string | null;
  currency: string;
}) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= COMPACT_FONT_SCALE;
  const category = getCategoryLabel(item.category, t);
  const date = shortDate(parseIso(item.date), locale);
  const amount = <RowAmount value={item.amount} currency={currency} kind="expense" />;
  return (
    <XStack items={stacked ? "flex-start" : "center"} gap={space[3]} py={space[3]} borderTopWidth={first ? 0 : 1} borderColor="$line">
      <Monogram name={category} emoji={emoji} size={44} />
      <YStack flex={1} minW={0} gap={2}>
        <FText numberOfLines={stacked ? undefined : 1} style={{ fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21, letterSpacing: -0.15 }}>
          {category}
        </FText>
        <FText tone="inkFaint" numberOfLines={stacked ? undefined : 1} style={{ fontSize: 13, lineHeight: 18 }}>
          {`${date} · ${item.account}`}
        </FText>
        {stacked ? <View mt={2}>{amount}</View> : null}
      </YStack>
      {stacked ? null : amount}
    </XStack>
  );
}

/** Una barra partida entre lo que hay en cuentas (`flowIn`) y lo que se debe (`flowOut`), los dos montos y la posición neta. */
function PositionCard({ position, loading, currency, locale }: { position?: FinancialReportPosition; loading: boolean; currency: string; locale: string }) {
  const { t } = useTranslation();
  const asOf = position ? parseIso(position.asOf) : new Date();
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(asOf);
  const accounts = Math.max(0, position?.totalAccountBalance ?? 0);
  const debts = Math.max(0, position?.totalDebtOutstanding ?? 0);
  return (
    <Section title={t("reportsTab.position", { date })}>
      <FintCard p={18}>
        {loading || !position ? (
          <SkeletonBlock width={220} height={14} rounded={6} bg="$canvas" />
        ) : (
          <>
            <XStack height={10} rounded={radius.pill} overflow="hidden" gap={accounts > 0 && debts > 0 ? 3 : 0} mb={12} bg="$line">
              {accounts > 0 ? <View height="100%" bg="$flowIn" style={{ flex: accounts }} /> : null}
              {debts > 0 ? <View height="100%" bg="$flowOut" style={{ flex: debts }} /> : null}
            </XStack>
            <XStack justify="space-between" items="center" gap={space[3]} flexWrap="wrap">
              <FText tone="inkMuted" style={{ fontSize: 13, lineHeight: 18 }}>
                {t("reportsTab.accounts")}
              </FText>
              <Amount value={position.totalAccountBalance} currency={currency} style={{ fontFamily: fontFace.mono[600], fontSize: 14, lineHeight: 19 }} />
            </XStack>
            <XStack justify="space-between" items="center" gap={space[3]} flexWrap="wrap" mt={6}>
              <FText tone="inkMuted" style={{ fontSize: 13, lineHeight: 18 }}>
                {t("reportsTab.debts")}
              </FText>
              <Amount
                value={-Math.abs(position.totalDebtOutstanding)}
                currency={currency}
                style={{ fontFamily: fontFace.mono[600], fontSize: 14, lineHeight: 19 }}
              />
            </XStack>
            <XStack justify="space-between" items="center" gap={space[3]} flexWrap="wrap" mt={10} pt={10} borderTopWidth={1} borderColor="$line">
              <FText style={{ fontFamily: fontFace.display[700], fontSize: 15, lineHeight: 20 }}>{t("reportsTab.netPosition")}</FText>
              <Amount value={position.netPosition} currency={currency} style={{ fontSize: 16, lineHeight: 21, fontFamily: fontFace.mono[600] }} />
            </XStack>
          </>
        )}
      </FintCard>
    </Section>
  );
}

/** Carga con la forma real: la boleta amarilla con sus barras al 12 %, el título del flujo y sus columnas. */
function ReportSkeleton() {
  const { t } = useTranslation();
  return (
    <SkeletonGroup label={t("states.loading")}>
      <YStack mx={space[5]} mt={14}>
        <View bg="$slab" rounded={26} p={18} gap={10}>
          <TicketBar width={120} height={14} />
          <TicketBar width={200} height={40} rounded={12} />
          <TicketBar width={170} height={12} />
          <XStack gap={10} mt={16}>
            <TicketBar width="45%" height={34} />
            <TicketBar width="45%" height={34} />
          </XStack>
        </View>
        <SkeletonBlock width={150} height={18} rounded={6} mt={28} />
        <XStack mt={14} gap={10} items="flex-end" height={110}>
          {[38, 100, 24, 60, 12].map((h, i) => (
            <SkeletonBlock key={i} flex={1} height={h} rounded={7} />
          ))}
        </XStack>
      </YStack>
    </SkeletonGroup>
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
