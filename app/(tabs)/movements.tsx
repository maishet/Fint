import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeftRight, ArrowUp, CalendarDays, Check, ChevronDown, ChevronRight, Mail, ScanLine, Search, Trash2, X } from "@tamagui/lucide-icons-2";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack, useTheme } from "tamagui";
import { useCapabilities } from "../../src/api/capabilities";
import { financeApi } from "../../src/api/finance";
import { normalizeTransaction } from "../../src/api/mappers";
import type { Transaction } from "../../src/api/types";
import { supabase } from "../../src/auth/supabase";
import { DataStateCard } from "../../src/components/DataStateCard";
import { floatingTabBarHeight } from "../../src/components/FintTabBar";
import { getCategoryLabel } from "../../src/finance/categoryLabels";
import { useCategoryIcons } from "../../src/finance/useCategoryIcons";
import { transactionDay } from "../../src/home/spending";
import { getAppLocale } from "../../src/i18n";
import { MovementRow } from "../../src/movements/MovementRow";
import {
  buildEntries,
  filterByCurrency,
  filterItems,
  groupTransfers,
  monthCurrencies,
  recentMonths,
  stickyIndices,
  type ListEntry,
  type MovementFilter,
} from "../../src/movements/logic";
import { useThemeMode } from "../../src/theme/ThemeMode";
import { radius, space } from "../../src/theme/tokens";
import { fontFace, textStyles } from "../../src/theme/typography";
import { Amount, Chip, FintButton, FintCard, FintConfirmDialog, FintSheet, FintSpinner, FText, IconButton, ListRow, PressableScale } from "../../src/ui";
import { AmountSkeleton } from "../../src/ui/AmountSkeleton";
import { useNotify } from "../../src/ui/notify";

const PAGE_SIZE = 30;
const FILTERS: MovementFilter[] = ["all", "expense", "income", "transfer"];

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthRange(month: Date) {
  return {
    from: isoDate(new Date(month.getFullYear(), month.getMonth(), 1)),
    to: isoDate(new Date(month.getFullYear(), month.getMonth() + 1, 1)),
  };
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Los parámetros para abrir el detalle o el formulario de edición de un movimiento. */
function movementParams(m: Transaction) {
  return {
    id: m.id,
    type: m.type as "income" | "expense",
    amount: String(m.amount),
    currency: m.currency,
    category: m.category,
    account: m.account,
    note: m.note ?? "",
    date: m.date,
    ...(m.latitude != null && m.longitude != null
      ? { latitude: String(m.latitude), longitude: String(m.longitude), formattedAddress: m.formattedAddress ?? "" }
      : {}),
  };
}

/**
 * Tab Movimientos v3: título con Escanear, buscador en todo el historial,
 * filtros por tipo, mes y moneda, el resumen del mes, los pendientes por
 * revisar y la lista agrupada por día (`FlashList`, encabezados pegajosos).
 *
 * Conserva la lógica anterior: páginas por mes o búsqueda en el servidor,
 * resumen por moneda, pendientes en tiempo real (Supabase), eliminar un
 * movimiento y revertir un pago o una transferencia.
 */
export default function MovementsScreen() {
  const { t, i18n } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const toast = useNotify();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { themeMode } = useThemeMode();
  const { capabilities } = useCapabilities();
  const iconFor = useCategoryIcons();

  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [summaryCurrency, setSummaryCurrency] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MovementFilter>("all");
  const [sheet, setSheet] = useState<"month" | "currency" | null>(null);
  const [pulling, setPulling] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [reverseTarget, setReverseTarget] = useState<Transaction | null>(null);
  const [reverseTransferTarget, setReverseTransferTarget] = useState<string | null>(null);

  // Reportes abre esta pestaña con una búsqueda (tocar una categoría): `qt` cambia en cada toque, así se aplica aunque sea la misma.
  const params = useLocalSearchParams<{ q?: string; qt?: string }>();
  useEffect(() => {
    if (params.q) {
      setSearch(params.q);
      setFilter("all");
    }
  }, [params.q, params.qt]);

  // El fondo de esta pantalla es `canvas`: la barra de estado va con iconos oscuros en claro.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(themeMode === "dark" ? "light" : "dark");
      return () => setStatusBarStyle("light");
    }, [themeMode]),
  );

  const range = monthRange(month);
  const deferredSearch = useDeferredValue(search);
  const term = deferredSearch.trim();
  const isSearching = term.length > 0;

  const movementsQuery = useInfiniteQuery({
    // Con texto se busca en el servidor sobre todo el historial (sin mes); sin texto, se pagina el mes elegido.
    queryKey: isSearching ? ["transactions", "search", term] : ["transactions", "pages", range.from, range.to],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      financeApi.getTransactionPage(
        isSearching ? { q: term, limit: PAGE_SIZE, cursor: pageParam } : { ...range, limit: PAGE_SIZE, cursor: pageParam },
        signal,
      ),
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
  });
  const pendingSummaryQuery = useQuery({
    queryKey: ["pending-movements", "summary"],
    queryFn: financeApi.getPendingMovementsSummary,
  });

  const movements = useMemo(
    () => (movementsQuery.data?.pages.flatMap((page) => page.items) ?? []).map(normalizeTransaction),
    [movementsQuery.data],
  );
  const summary = movementsQuery.data?.pages[0]?.summary;
  const pendingCount = pendingSummaryQuery.data?.count ?? 0;

  const items = useMemo(() => groupTransfers(movements), [movements]);
  const summaryCurrencies = useMemo(() => summary?.byCurrency.map((c) => c.currency) ?? [], [summary]);
  const currencies = useMemo(() => monthCurrencies(summaryCurrencies, items), [summaryCurrencies, items]);
  // La moneda elegida se recuerda al cambiar de mes; si ese mes no la tiene, se muestra la primera y vuelve al regresar.
  const currency = currencies.includes(summaryCurrency) ? summaryCurrency : (currencies[0] ?? "PEN");
  const currencySummary = summary?.byCurrency.find((item) => item.currency === currency);
  // La lista del mes muestra solo la moneda elegida, igual que el resumen. La búsqueda no filtra por moneda: no hay píldora.
  const shown = useMemo(
    () => filterItems(isSearching ? items : filterByCurrency(items, currency), filter),
    [items, isSearching, currency, filter],
  );
  const entries = useMemo(() => buildEntries(shown, currency), [shown, currency]);
  const sticky = useMemo(() => stickyIndices(entries), [entries]);

  // Pendientes en tiempo real: al llegar o confirmarse uno, se refresca la tarjeta (y la lista si se confirmó).
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      channel = supabase
        .channel(`pending-movements-${data.user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pending_movements", filter: `user_id=eq.${data.user.id}` },
          (payload) => {
            void queryClient.invalidateQueries({ queryKey: ["pending-movements", "summary"] });
            void queryClient.invalidateQueries({ queryKey: ["pending-movements"] });
            if ((payload.new as { status?: string } | null)?.status === "confirmed") {
              for (const key of ["transactions", "dashboard", "summary", "accounts", "reports"]) void queryClient.invalidateQueries({ queryKey: [key] });
            }
          },
        )
        .subscribe();
    });
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const invalidate = (keys: string[]) => Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financeApi.deleteTransaction(id),
    onSuccess: async () => {
      setDeleteTarget(null);
      await invalidate(["transactions", "dashboard", "accounts", "reports"]);
      toast.success(t("movementUx.deletedToast"), { message: t("movementUx.deletedMessage") });
    },
    onError: () => toast.error(t("movementUx.deleteError")),
  });

  const reversePaymentMutation = useMutation({
    mutationFn: (paymentId: string) => financeApi.reversePaymentOccurrencePayment(paymentId, { reason: "Reverted from mobile history" }),
    onSuccess: async () => {
      setReverseTarget(null);
      await invalidate(["transactions", "payment-occurrences", "summary", "dashboard", "accounts", "reports", "pending-movements"]);
      toast.show(t("movementUx.revertedToast"), { message: t("movementUx.revertedMessage"), preset: "success" });
    },
    onError: () => toast.show(t("movementUx.reverseError"), { preset: "error" }),
  });

  const reverseTransferMutation = useMutation({
    mutationFn: (transferGroupId: string) => financeApi.reverseTransfer(transferGroupId),
    onSuccess: async () => {
      setReverseTransferTarget(null);
      await invalidate(["transactions", "summary", "dashboard", "accounts", "reports"]);
      toast.show(t("movementUx.revertedToast"), { message: t("movementUx.revertedMessage"), preset: "success" });
    },
    onError: () => toast.show(t("movementUx.reverseError"), { preset: "error" }),
  });

  const monthLabel = capitalize(`${new Intl.DateTimeFormat(locale, { month: "long" }).format(month)} ${month.getFullYear()}`);

  const header = (
    <YStack pt={space[2]} pb={space[2]}>
      {/* Título y Escanear. Registrar a mano está en el botón central de la barra. */}
      <XStack items="center" justify="space-between" px={space[4]} gap={space[3]}>
        <FText variant="display-lg" accessibilityRole="header">
          {t("movementsTab.title")}
        </FText>
        {capabilities.features.captureImport ? (
          <IconButton label={t("movementsTab.scan")} icon={<ScanLine size={20} color="$ink" strokeWidth={1.8} />} onPress={() => router.push("/capture-import")} />
        ) : null}
      </XStack>

      {/* Buscador: en comercio, nota y categoría de todos los meses. */}
      <XStack mx={space[4]} mt={space[4]} height={48} px={16} gap={10} items="center" rounded={radius.pill} bg="$surface" borderWidth={1} borderColor="$line">
        <Search size={18} color="$inkFaint" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t("movementsTab.search")}
          placeholderTextColor={theme.inkFaint.val}
          selectionColor={theme.brand.val}
          returnKeyType="search"
          autoCapitalize="none"
          accessibilityLabel={t("movementsTab.search")}
          style={[textStyles.body, { flex: 1, color: theme.ink.val, paddingVertical: 10 }]}
        />
        {search ? (
          <Pressable onPress={() => setSearch("")} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("movementsTab.searchClear")}>
            <X size={16} color="$inkFaint" />
          </Pressable>
        ) : null}
      </XStack>

      {/* Filtros por tipo: relleno `ink`, no índigo, porque filtran y no ejecutan. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space[4], gap: 8, paddingTop: space[3] }}
        accessibilityLabel={t("movementsTab.filtersLabel")}
      >
        {FILTERS.map((f) => (
          <Chip key={f} variant="filter" label={t(`movementsTab.filters.${f}`)} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>

      {isSearching ? (
        <FText variant="caption" tone="inkFaint" style={{ marginHorizontal: space[4], marginTop: space[3] }}>
          {t("movementsTab.searchScope")}
        </FText>
      ) : (
        <>
          {/* Mes y moneda. */}
          <XStack mx={space[4]} mt={space[4]} justify="space-between" items="center">
            <Pill icon={<CalendarDays size={16} color="$ink" />} label={monthLabel} onPress={() => setSheet("month")} />
            <Pill label={currency} onPress={currencies.length > 1 ? () => setSheet("currency") : undefined} />
          </XStack>

          {/* Resumen del mes. */}
          <SummaryCard
            loading={movementsQuery.isLoading}
            currency={currency}
            income={currencySummary?.income ?? 0}
            expenses={currencySummary?.expenses ?? 0}
            net={currencySummary?.net ?? 0}
            count={currencySummary?.count ?? 0}
          />
        </>
      )}

      {/* Por revisar: solo si hay importados sin confirmar. */}
      {pendingCount > 0 ? (
        <PressableScale onPress={() => router.push("/pending-movements")} haptic="tap" accessibilityRole="button" accessibilityLabel={t("movementsTab.review", { count: pendingCount })}>
          <XStack mx={space[4]} mt={space[3]} px={space[4]} py={14} gap={space[3]} items="center" rounded={radius.lg} bg="$brandWash">
            <View width={38} height={38} rounded={999} bg="$surface" items="center" justify="center">
              <Mail size={18} color="$brand" />
            </View>
            <YStack flex={1} minW={0}>
              <FText variant="body-strong">{t("movementsTab.review", { count: pendingCount })}</FText>
              <FText variant="caption" tone="inkMuted">
                {t("movementsTab.reviewHint")}
              </FText>
            </YStack>
            <XStack items="center" gap={2}>
              <FText variant="label" tone="brand" style={{ fontFamily: fontFace.sans[600] }}>
                {t("movementsTab.reviewAction")}
              </FText>
              <ChevronRight size={16} color="$brand" />
            </XStack>
          </XStack>
        </PressableScale>
      ) : null}

      {movementsQuery.error ? (
        <View mx={space[4]} mt={space[3]}>
          <DataStateCard message={t("states.error")} onRetry={() => void movementsQuery.refetch()} />
        </View>
      ) : null}
    </YStack>
  );

  const renderItem = ({ item: entry }: { item: ListEntry }) => {
    if (entry.type === "day") return <DayHeader day={entry.day} net={entry.net} locale={locale} />;
    const { item } = entry;
    if (item.kind === "transfer") {
      return (
        <View px={space[4]}>
          <MovementRow item={item} first={entry.first} last={entry.last} emoji={null} destroyKind="revert" onDestroy={() => setReverseTransferTarget(item.transferGroupId)} />
        </View>
      );
    }
    const m = item.movement;
    const isPayment = Boolean(m.paymentOccurrenceId);
    const stranded = m.type === "transfer";
    const canReverse = isPayment && Boolean(m.paymentOccurrencePaymentId);
    return (
      <View px={space[4]}>
        <MovementRow
          item={item}
          first={entry.first}
          last={entry.last}
          emoji={iconFor(m.category, m.type)}
          onOpen={isPayment || stranded ? undefined : () => router.push({ pathname: "/transaction-detail", params: movementParams(m) })}
          onEdit={isPayment || stranded ? undefined : () => router.push({ pathname: "/transaction-form", params: movementParams(m) })}
          destroyKind={canReverse ? "revert" : "delete"}
          onDestroy={canReverse ? () => setReverseTarget(m) : isPayment || stranded ? undefined : () => setDeleteTarget(m)}
        />
      </View>
    );
  };

  const empty = movementsQuery.isLoading ? (
    <ListSkeleton />
  ) : movementsQuery.error ? null : (
    <YStack items="center" gap={space[3]} px={space[6]} pt={space[8]}>
      <View width={52} height={52} rounded={999} bg="$surfaceSunken" items="center" justify="center">
        {isSearching ? <Search size={22} color="$inkMuted" /> : <ArrowLeftRight size={22} color="$inkMuted" />}
      </View>
      <FText variant="heading" style={{ textAlign: "center" }}>
        {isSearching
          ? t("movementsTab.searchEmptyTitle")
          : filter !== "all" && items.length > 0
            ? currencies.length > 1
              ? t("movementsTab.filterEmptyCurrency", { currency })
              : t("movementsTab.filterEmpty")
            : t("movementsTab.emptyTitle")}
      </FText>
      {isSearching ? (
        <FintButton variant="outlined" onPress={() => setSearch("")}>
          {t("movementsTab.searchClear")}
        </FintButton>
      ) : filter === "all" || items.length === 0 ? (
        <FintButton onPress={() => router.push("/transaction-form")}>{t("movementsTab.emptyAction")}</FintButton>
      ) : null}
    </YStack>
  );

  return (
    // La lista empieza bajo la barra de estado: así el encabezado de día pegado queda debajo de ella y no detrás.
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <FlashList
        data={entries}
        keyExtractor={(e) => e.key}
        getItemType={(e) => e.type}
        renderItem={renderItem}
        stickyHeaderIndices={sticky}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          movementsQuery.isFetchingNextPage ? (
            <YStack py={space[4]} items="center">
              <FintSpinner color="$brand" />
            </YStack>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: floatingTabBarHeight(insets.bottom) + space[4] }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            // Solo cuando la persona tira: las recargas en segundo plano (al volver a la pestaña) no muestran spinner.
            refreshing={pulling}
            onRefresh={() => {
              setPulling(true);
              void Promise.all([movementsQuery.refetch(), pendingSummaryQuery.refetch()]).finally(() => setPulling(false));
            }}
            tintColor={theme.brand.val}
            colors={[theme.brand.val]}
            progressBackgroundColor={theme.surface.val}
          />
        }
        onEndReached={() => {
          if (movementsQuery.hasNextPage && !movementsQuery.isFetchingNextPage) void movementsQuery.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
      />

      <FintSheet open={sheet === "month"} onClose={() => setSheet(null)} title={t("movementsTab.month")} subtitle={t("movementsTab.monthHint")}>
        <MonthGrid
          value={month}
          locale={locale}
          onPick={(m) => {
            setMonth(m);
            setSheet(null);
          }}
        />
      </FintSheet>
      <FintSheet open={sheet === "currency"} onClose={() => setSheet(null)} title={t("movementsTab.currency")}>
        <View height={8} />
        {currencies.map((c, i) => (
          <ListRow
            key={c}
            divider={i > 0}
            title={c}
            trailing={c === currency ? <Check size={18} color="$brand" strokeWidth={2.4} /> : undefined}
            onPress={() => {
              setSummaryCurrency(c);
              setSheet(null);
            }}
          />
        ))}
      </FintSheet>

      <FintConfirmDialog
        open={Boolean(reverseTransferTarget)}
        isPending={reverseTransferMutation.isPending}
        title={t("movementUx.reverseTransfer")}
        description={t("movementUx.reverseTransferDescription")}
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("movementUx.reverseTransfer")}
        pendingLabel={t("movementUx.reversing")}
        destructive
        onCancel={() => setReverseTransferTarget(null)}
        onConfirm={() => reverseTransferTarget && reverseTransferMutation.mutate(reverseTransferTarget)}
      />
      <FintConfirmDialog
        open={Boolean(deleteTarget)}
        isPending={deleteMutation.isPending}
        title={t("movementUx.deleteTitle")}
        description={t("movementUx.deleteDescription", { name: deleteTarget ? getCategoryLabel(deleteTarget.category, t) : "" })}
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("movementUx.deleteConfirm")}
        pendingLabel={t("movementUx.deleting")}
        destructive
        icon={<Trash2 size={17} color="$onDanger" />}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
      <FintConfirmDialog
        open={Boolean(reverseTarget)}
        isPending={reversePaymentMutation.isPending}
        title={t("movementUx.reversePayment")}
        description={t("movementUx.reversePaymentDescription")}
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("movementUx.reversePayment")}
        pendingLabel={t("movementUx.reversing")}
        destructive
        onCancel={() => setReverseTarget(null)}
        onConfirm={() => reverseTarget?.paymentOccurrencePaymentId && reversePaymentMutation.mutate(reverseTarget.paymentOccurrencePaymentId)}
      />
    </YStack>
  );
}

/**
 * La hoja de mes: los últimos 6 meses en una grilla de 3 × 2, del más antiguo
 * al actual, como el calendario del formulario pero por meses. El elegido va en
 * `brand` y el actual lleva el anillo, igual que "hoy" en el calendario.
 */
function MonthGrid({ value, locale, onPick }: { value: Date; locale: string; onPick: (month: Date) => void }) {
  const today = new Date();
  const months = useMemo(() => recentMonths(new Date()), []);
  const short = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short" }), [locale]);
  const long = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }), [locale]);
  return (
    <XStack flexWrap="wrap" px={space[4]} pt={space[2]} pb={space[4]} rowGap={10} columnGap={10}>
      {months.map((m) => {
        const selected = m.getTime() === value.getTime();
        const current = m.getFullYear() === today.getFullYear() && m.getMonth() === today.getMonth();
        return (
          <PressableScale
            key={m.getTime()}
            onPress={() => onPick(m)}
            haptic="select"
            style={{ width: "31%", flexGrow: 1 }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={long.format(m)}
          >
            <YStack
              height={64}
              items="center"
              justify="center"
              gap={2}
              rounded={radius.md}
              borderWidth={selected ? 0 : current ? 1.5 : 1}
              borderColor={current ? "$brand" : "$lineStrong"}
              bg={selected ? "$brand" : "$surface"}
            >
              <FText variant="body-strong" color={selected ? "$onBrand" : current ? "$brand" : "$ink"}>
                {capitalize(short.format(m).replace(".", ""))}
              </FText>
              <FText variant="caption" color={selected ? "$onBrand" : "$inkFaint"} style={{ fontFamily: fontFace.mono[500], opacity: selected ? 0.8 : 1 }}>
                {String(m.getFullYear())}
              </FText>
            </YStack>
          </PressableScale>
        );
      })}
    </XStack>
  );
}

/** Píldora de mes o de moneda. Sin `onPress` (una sola moneda) no lleva flecha. */
function Pill({ label, icon, onPress }: { label: string; icon?: React.ReactNode; onPress?: () => void }) {
  return (
    <PressableScale onPress={onPress} disabled={!onPress} haptic="tap" accessibilityRole="button" accessibilityLabel={label}>
      <XStack height={40} pl={14} pr={onPress ? 12 : 14} gap={8} items="center" rounded={radius.pill} borderWidth={1} borderColor="$lineStrong" bg="$surface">
        {icon}
        <FText variant="label" style={{ fontSize: 14 }}>
          {label}
        </FText>
        {onPress ? <ChevronDown size={16} color="$ink" strokeWidth={2.2} /> : null}
      </XStack>
    </PressableScale>
  );
}

/** "Entró" en `flowIn` y "Salió" con signo menos en `ink`, separadas por un filete; debajo, la cantidad y el neto. */
function SummaryCard({
  loading,
  currency,
  income,
  expenses,
  net,
  count,
}: {
  loading: boolean;
  currency: string;
  income: number;
  expenses: number;
  net: number;
  count: number;
}) {
  const { t } = useTranslation();
  return (
    <FintCard mx={space[4]} mt={space[3]} p={0}>
      <XStack>
        <YStack flex={1} px={space[4]} pt={14} pb={12} gap={4}>
          <XStack items="center" gap={6}>
            <ArrowUp size={14} color="$flowIn" strokeWidth={2.2} />
            <FText variant="caption" tone="inkMuted">
              {t("movementsTab.in")}
            </FText>
          </XStack>
          {loading ? <AmountSkeleton width={120} height={20} /> : <Amount value={income} currency={currency} kind="income" variant="amount-lg" />}
        </YStack>
        <View width={1} my={14} bg="$line" />
        <YStack flex={1} px={space[4]} pt={14} pb={12} gap={4}>
          <XStack items="center" gap={6}>
            <ArrowDown size={14} color="$flowOut" strokeWidth={2.2} />
            <FText variant="caption" tone="inkMuted">
              {t("movementsTab.out")}
            </FText>
          </XStack>
          {loading ? <AmountSkeleton width={120} height={20} /> : <Amount value={expenses} currency={currency} kind="expense" variant="amount-lg" />}
        </YStack>
      </XStack>
      <XStack mx={space[4]} py={12} borderTopWidth={1} borderColor="$line" justify="space-between" items="center">
        <FText variant="caption" tone="inkMuted">
          {t("movementsTab.count", { count })}
        </FText>
        <XStack items="center" gap={6}>
          <FText variant="caption" tone="inkMuted">
            {t("movementsTab.net")}
          </FText>
          <Amount value={net} currency={currency} kind={net >= 0 ? "income" : "expense"} tone="inkMuted" variant="amount-sm" />
        </XStack>
      </XStack>
    </FintCard>
  );
}

/** Encabezado del día: "Hoy · jueves 18" o "15 set · lunes", con el neto del día a la derecha. Queda pegado arriba. */
function DayHeader({ day, net, locale }: { day: string; net: { currency: string; value: number } | null; locale: string }) {
  const { t } = useTranslation();
  const d = transactionDay(day);
  const date = d ? new Date(d.y, d.m, d.d) : new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
  const primary =
    diff === 0
      ? t("movementsTab.today")
      : diff === 1
        ? t("movementsTab.yesterday")
        : new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date).replace(".", "");
  const secondary = diff <= 1 ? `${weekday} ${date.getDate()}` : weekday;
  return (
    <XStack px={space[4]} pt={18} pb={8} items="center" justify="space-between" bg="$canvas">
      <XStack items="baseline" gap={6} shrink={1}>
        <FText variant="body-strong" style={{ fontSize: 14 }}>
          {capitalize(primary)}
        </FText>
        <FText variant="caption" tone="inkFaint" style={{ fontSize: 13 }}>
          {`· ${secondary}`}
        </FText>
      </XStack>
      {net ? <Amount value={net.value} currency={net.currency} kind={net.value > 0 ? "income" : net.value < 0 ? "expense" : "neutral"} tone="inkMuted" variant="amount-sm" /> : null}
    </XStack>
  );
}

function ListSkeleton() {
  return (
    <YStack px={space[4]} pt={18} gap={8}>
      <AmountSkeleton width={140} height={14} />
      <YStack rounded={radius.lg} borderWidth={1} borderColor="$line" bg="$surface" overflow="hidden">
        {[0, 1, 2, 3].map((i) => (
          <XStack key={i} items="center" gap={space[3]} px={space[4]} py={space[3]} borderTopWidth={i ? 1 : 0} borderColor="$line">
            <View width={38} height={38} rounded={999} bg="$surfaceSunken" />
            <YStack flex={1} gap={6}>
              <AmountSkeleton width={130} height={12} />
              <AmountSkeleton width={90} height={10} />
            </YStack>
            <AmountSkeleton width={70} height={12} />
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}
