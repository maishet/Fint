import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Mail, ScanLine, Search, Trash2, X } from "@tamagui/lucide-icons-2";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutAnimation, Pressable, RefreshControl, ScrollView, TextInput, type LayoutAnimationConfig } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
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
import { DayHeader } from "../../src/movements/DayHeader";
import { isComingSoon } from "../../src/config/comingSoon";
import { MovementRow } from "../../src/movements/MovementRow";
import { FILTER_ANIMATION, REMOVE_ANIMATION } from "../../src/movements/listAnimation";
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
import { COMPACT_FONT_SCALE, radius, space, ticket } from "../../src/theme/tokens";
import { fintPalette } from "../../src/theme/palette";
import { SkeletonBlock, SkeletonGroup } from "../../src/components/Skeleton";
import { fontFace, textStyles } from "../../src/theme/typography";
import { useScreenStatusBar } from "../../src/theme/useScreenStatusBar";
import { Amount, Chip, FintButton, FintConfirmDialog, FintLottie, FintSheet, FintSpinner, FText, IconButton, ListRow, PressableScale, SoonBadge, useComingSoon } from "../../src/ui";
import { AmountSkeleton } from "../../src/ui/AmountSkeleton";
import { useNotify } from "../../src/ui/notify";
import { detailParams } from "../../src/movements/detailParams";

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
  const showSoon = useComingSoon();
  const { t, i18n } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const toast = useNotify();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
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
  // Lo recién eliminado o revertido sale de la lista al confirmarse, con su animación, sin esperar a la recarga.
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  const listRef = useRef<FlashListRef<ListEntry>>(null);
  const reduceMotion = useReducedMotion();

  const animateList = useCallback(
    (config: LayoutAnimationConfig) => {
      if (reduceMotion) return;
      listRef.current?.prepareForLayoutAnimationRender();
      LayoutAnimation.configureNext(config);
    },
    [reduceMotion],
  );
  const removeFromList = (id: string) => {
    animateList(REMOVE_ANIMATION);
    setRemoved((prev) => new Set(prev).add(id));
  };

  // Reportes abre esta pestaña con una búsqueda (tocar una categoría): `qt` cambia en cada toque, así se aplica aunque sea la misma.
  const params = useLocalSearchParams<{ q?: string; qt?: string }>();
  useEffect(() => {
    if (params.q) {
      setSearch(params.q);
      setFilter("all");
    }
  }, [params.q, params.qt]);

  useScreenStatusBar();

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
    () =>
      filterItems(isSearching ? items : filterByCurrency(items, currency), filter).filter(
        (item) => !removed.has(item.kind === "transfer" ? item.transferGroupId : item.movement.id),
      ),
    [items, isSearching, currency, filter, removed],
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
    onSuccess: async (_, id) => {
      setDeleteTarget(null);
      removeFromList(id);
      await invalidate(["transactions", "dashboard", "accounts", "reports"]);
      toast.success(t("movementUx.deletedToast"), { message: t("movementUx.deletedMessage") });
    },
    onError: () => toast.error(t("movementUx.deleteError")),
  });

  const reversePaymentMutation = useMutation({
    mutationFn: (paymentId: string) => financeApi.reversePaymentOccurrencePayment(paymentId, { reason: "Reverted from mobile history" }),
    onSuccess: async () => {
      if (reverseTarget) removeFromList(reverseTarget.id);
      setReverseTarget(null);
      await invalidate(["transactions", "payment-occurrences", "summary", "dashboard", "accounts", "reports", "pending-movements"]);
      toast.show(t("movementUx.revertedToast"), { message: t("movementUx.revertedMessage"), preset: "success" });
    },
    onError: () => toast.show(t("movementUx.reverseError"), { preset: "error" }),
  });

  const reverseTransferMutation = useMutation({
    mutationFn: (transferGroupId: string) => financeApi.reverseTransfer(transferGroupId),
    onSuccess: async (_, transferGroupId) => {
      setReverseTransferTarget(null);
      removeFromList(transferGroupId);
      await invalidate(["transactions", "summary", "dashboard", "accounts", "reports"]);
      toast.show(t("movementUx.revertedToast"), { message: t("movementUx.revertedMessage"), preset: "success" });
    },
    onError: () => toast.show(t("movementUx.reverseError"), { preset: "error" }),
  });

  const monthLabel = capitalize(`${new Intl.DateTimeFormat(locale, { month: "long" }).format(month)} ${month.getFullYear()}`);

  const header = (
    <YStack pt={space[2]} pb={space[2]}>
      {/* Título y Escanear. Registrar a mano está en el botón central de la barra. */}
      <XStack items="center" justify="space-between" px={space[5]} gap={space[3]}>
        <FText
          accessibilityRole="header"
          maxFontSizeMultiplier={1.3}
          style={{ fontFamily: fontFace.display[700], fontSize: 32, lineHeight: 38, letterSpacing: -0.96, flexShrink: 1 }}
        >
          {t("movementsTab.title")}
        </FText>
        {isComingSoon("photoCapture") ? (
          // Se ve, pero todavía no se puede usar.
          <XStack items="center" gap={8}>
            <SoonBadge />
            <IconButton label={t("movementsTab.scan")} accessibilityHint={t("comingSoon.tapHint")} soon onPress={() => showSoon("photoCapture")} icon={<ScanLine size={20} color="$ink" strokeWidth={1.8} />} />
          </XStack>
        ) : capabilities.features.captureImport ? (
          <IconButton label={t("movementsTab.scan")} icon={<ScanLine size={20} color="$ink" strokeWidth={1.8} />} onPress={() => router.push("/capture-import")} />
        ) : null}
      </XStack>

      {/* Buscador: en comercio, nota y categoría de todos los meses. Campo `surface` con filete `lineStrong` (≥ 3:1). */}
      <XStack mx={space[5]} mt={space[3]} minH={44} px={16} gap={10} items="center" rounded={radius.pill} bg="$surface" borderWidth={1} borderColor="$lineStrong">
        <Search size={18} color="$inkFaint" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t("movementsTab.search")}
          placeholderTextColor={theme.inkFaint.val}
          selectionColor={theme.ink.val}
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

      {/* Filtros por tipo: el activo en `chipOn` (tinta), no amarillo, porque filtran y no ejecutan. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Relleno abajo (y menos espacio en lo que sigue): Android recorta el margen de toque de los chips al borde del
        // contenedor, así que el `ScrollView` tiene que dejar sitio a los 8 de `hitSlop` también por debajo.
        contentContainerStyle={{ paddingHorizontal: space[5], gap: 6, paddingTop: space[3], paddingBottom: space[2] }}
        accessibilityLabel={t("movementsTab.filtersLabel")}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f}
            variant="filter"
            label={t(`movementsTab.filters.${f}`)}
            selected={filter === f}
            onPress={() => {
              if (f === filter) return;
              animateList(FILTER_ANIMATION);
              setFilter(f);
            }}
          />
        ))}
      </ScrollView>

      {isSearching ? (
        <FText variant="caption" tone="inkFaint" style={{ marginHorizontal: space[5], marginTop: space[1] }}>
          {t("movementsTab.searchScope")}
        </FText>
      ) : (
        <>
          {/* Mes (título 20/800 con su flecha) y moneda (ficha `surface`). */}
          <XStack mx={space[5]} mt={space[2]} justify="space-between" items="center" gap={space[3]}>
            <MonthButton label={monthLabel} onPress={() => setSheet("month")} />
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

      {/* Por revisar: solo si hay importados sin confirmar. Tarjeta amarilla (es lo que pide acción) con "Revisar" en tinta. */}
      {pendingCount > 0 ? (
        <PressableScale onPress={() => router.push("/pending-movements")} haptic="tap" accessibilityRole="button" accessibilityLabel={t("movementsTab.review", { count: pendingCount })}>
          <XStack mx={space[5]} mt={space[4]} px={14} py={12} gap={space[3]} items="center" rounded={22} bg="$slab">
            <View width={40} height={40} rounded={14} items="center" justify="center" style={{ backgroundColor: ticket.control }}>
              <Mail size={20} color="$slabInk" strokeWidth={2} />
            </View>
            <YStack flex={1} minW={0}>
              <FText tone="slabInk" style={{ fontFamily: fontFace.display[700], fontSize: 15, lineHeight: 20 }}>
                {t("movementsTab.review", { count: pendingCount })}
              </FText>
              <FText tone="slabMuted" style={{ fontSize: 13, lineHeight: 18 }}>
                {t("movementsTab.reviewHint")}
              </FText>
            </YStack>
            <XStack minH={34} px={14} items="center" rounded={999} style={{ backgroundColor: fintPalette.light.ink }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <FText maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.sans[600], fontSize: 13, lineHeight: 18, color: fintPalette.light.brand }}>
                {t("movementsTab.reviewAction")}
              </FText>
            </XStack>
          </XStack>
        </PressableScale>
      ) : null}

      {movementsQuery.error ? (
        <View mx={space[5]} mt={space[3]}>
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
        <View px={space[5]}>
          <MovementRow item={item} first={entry.first} last={entry.last} emoji={null} destroyKind="revert" onDestroy={() => setReverseTransferTarget(item.transferGroupId)} />
        </View>
      );
    }
    const m = item.movement;
    const isPayment = Boolean(m.paymentOccurrenceId);
    const stranded = m.type === "transfer";
    const canReverse = isPayment && Boolean(m.paymentOccurrencePaymentId);
    return (
      <View px={space[5]}>
        <MovementRow
          item={item}
          first={entry.first}
          last={entry.last}
          emoji={iconFor(m.category, m.type)}
          onOpen={isPayment || stranded ? undefined : () => router.push({ pathname: "/transaction-detail", params: detailParams(m) })}
          onEdit={isPayment || stranded ? undefined : () => router.push({ pathname: "/transaction-form", params: detailParams(m) })}
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
      {isSearching ? (
        <View width={52} height={52} rounded={999} bg="$surfaceSunken" items="center" justify="center">
          <Search size={22} color="$inkMuted" />
        </View>
      ) : (
        <FintLottie name="coin-stack" size={76} loop="breathe" />
      )}
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
        ref={listRef}
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
              <FintSpinner color="$ink" />
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
            tintColor={theme.ink.val}
            colors={[theme.ink.val]}
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
            trailing={c === currency ? <Check size={18} color="$ink" strokeWidth={2.4} /> : undefined}
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
 * `chipOn` (tinta) y el actual lleva el anillo `ink`, igual que "hoy" en el calendario.
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
              borderColor={current ? "$ink" : "$lineStrong"}
              bg={selected ? "$chipOn" : "$surface"}
            >
              <FText variant="body-strong" color={selected ? "$onChipOn" : "$ink"}>
                {capitalize(short.format(m).replace(".", ""))}
              </FText>
              <FText variant="caption" color={selected ? "$onChipOn" : "$inkFaint"} style={{ fontFamily: fontFace.mono[500], opacity: selected ? 0.8 : 1 }}>
                {String(m.getFullYear())}
              </FText>
            </YStack>
          </PressableScale>
        );
      })}
    </XStack>
  );
}

/** El mes como título de 20/800 con su flecha: abre la hoja de meses. */
function MonthButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} haptic="tap" hitSlop={8} accessibilityRole="button" accessibilityLabel={label} style={{ flexShrink: 1 }}>
      <XStack minH={36} gap={6} items="center">
        <FText maxFontSizeMultiplier={1.5} style={{ fontFamily: fontFace.display[700], fontSize: 20, lineHeight: 25, letterSpacing: -0.4, flexShrink: 1 }}>
          {label}
        </FText>
        <ChevronDown size={18} color="$ink" strokeWidth={2.2} />
      </XStack>
    </PressableScale>
  );
}

/** Ficha de moneda (`surface`, 32). Sin `onPress` (una sola moneda) es solo el código, sin flecha. */
function Pill({ label, onPress }: { label: string; onPress?: () => void }) {
  const chip = (
    <XStack minH={32} px={12} gap={4} items="center" rounded={radius.pill} bg="$surface" accessibilityLabel={onPress ? undefined : label}>
      <FText maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontSize: 13, lineHeight: 18, fontFamily: fontFace.sans[600] }}>
        {label}
      </FText>
      {onPress ? <ChevronDown size={14} color="$ink" strokeWidth={2.2} /> : null}
    </XStack>
  );
  if (!onPress) return chip;
  return (
    <PressableScale onPress={onPress} haptic="tap" hitSlop={6} accessibilityRole="button" accessibilityLabel={label}>
      {chip}
    </PressableScale>
  );
}

/**
 * Resumen del mes (marca D): "Entró" con + en `flowIn` y "Salió" con − en `flowOut`, a 26/700; debajo, una barra con
 * la proporción de los dos y, al pie, la cantidad de movimientos y el neto con su signo en `ink`.
 */
const SUMMARY_FIGURE = { fontFamily: fontFace.mono[600], fontSize: 26, lineHeight: 32, letterSpacing: -0.5 } as const;

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
  const total = income + expenses;
  return (
    <YStack mx={space[5]} mt={space[4]} gap={10}>
      <XStack justify="space-between" items="flex-end" gap={space[3]} flexWrap="wrap">
        <YStack gap={2}>
          <FText tone="inkMuted" style={{ fontSize: 13, lineHeight: 18 }}>
            {t("movementsTab.in")}
          </FText>
          {loading ? <AmountSkeleton width={130} height={26} /> : <Amount value={income} currency={currency} kind="income" variant="amount-lg" style={SUMMARY_FIGURE} />}
        </YStack>
        <YStack gap={2} items="flex-end">
          <FText tone="inkMuted" style={{ fontSize: 13, lineHeight: 18 }}>
            {t("movementsTab.out")}
          </FText>
          {loading ? <AmountSkeleton width={130} height={26} /> : <Amount value={expenses} currency={currency} kind="expense" variant="amount-lg" style={SUMMARY_FIGURE} />}
        </YStack>
      </XStack>
      {/* La proporción entre lo que entró y lo que salió: decorativa, los montos ya están arriba. */}
      <XStack height={10} gap={4} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {total > 0 ? (
          <>
            {income > 0 ? <View flex={income} rounded={5} bg="$flowIn" /> : null}
            {expenses > 0 ? <View flex={expenses} rounded={5} bg="$flowOut" /> : null}
          </>
        ) : (
          <View flex={1} rounded={5} bg="$surface" />
        )}
      </XStack>
      <XStack justify="space-between" items="center" gap={space[3]} flexWrap="wrap">
        <FText tone="inkFaint" style={{ fontSize: 13, lineHeight: 18 }}>
          {t("movementsTab.count", { count })}
        </FText>
        <XStack items="baseline" gap={4}>
          <FText tone="inkFaint" style={{ fontSize: 13, lineHeight: 18 }}>
            {t("movementsTab.net")}
          </FText>
          <Amount
            value={net}
            currency={currency}
            kind={net > 0 ? "income" : net < 0 ? "expense" : "neutral"}
            tone="ink"
            variant="amount-sm"
            style={{ fontFamily: fontFace.mono[600], fontSize: 13, lineHeight: 18 }}
          />
        </XStack>
      </XStack>
    </YStack>
  );
}

/** Carga de Movimientos con la forma real: encabezado de día y filas con su cuadro de 44, a todo el ancho. */
function ListSkeleton() {
  const { t } = useTranslation();
  return (
    <SkeletonGroup label={t("states.loading")}>
      <YStack px={space[5]} pt={20}>
        <SkeletonBlock width={140} height={16} rounded={6} mb={6} />
        {[0, 1, 2, 3, 4].map((i) => (
          <XStack key={i} items="center" gap={space[3]} py={space[3]} borderTopWidth={i ? 1 : 0} borderColor="$line">
            <SkeletonBlock width={44} height={44} rounded={14} />
            <YStack flex={1} gap={8}>
              <SkeletonBlock width="60%" height={14} rounded={6} />
              <SkeletonBlock width="40%" height={11} rounded={6} />
            </YStack>
            <SkeletonBlock width={64} height={14} rounded={6} />
          </XStack>
        ))}
      </YStack>
    </SkeletonGroup>
  );
}
