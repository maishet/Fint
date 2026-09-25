import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Check, ChevronLeft, Inbox, Mail, Repeat, X } from "@tamagui/lucide-icons-2";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack, useTheme, type ColorTokens } from "tamagui";
import { useCapabilities } from "../src/api/capabilities";
import { financeApi } from "../src/api/finance";
import type { Category, ConfirmPendingInput, PaymentOccurrence, PendingMovementCard } from "../src/api/types";
import { supabase } from "../src/auth/supabase";
import { DataStateCard } from "../src/components/DataStateCard";
import { getCategoryLabel } from "../src/finance/categoryLabels";
import { parseDateString } from "../src/finance/dates";
import { categoryColorIndex } from "../src/home/spending";
import { getAppLocale } from "../src/i18n";
import { CategorySheet } from "../src/movement-form/CategorySheet";
import { shortDay } from "../src/movement-form/DateSheet";
import { getInstallationId } from "../src/notifications/pushNotifications";
import { canConfirmFromList, compatibleOccurrences, detectedWhen, isMatchedTransfer, matchingOccurrence } from "../src/pending/logic";
import { useThemeMode } from "../src/theme/ThemeMode";
import { radius, shadows, space } from "../src/theme/tokens";
import { fontFace } from "../src/theme/typography";
import { Amount, FintButton, FintCard, FintSheet, FintSpinner, FText, IconButton, Monogram, PressableScale, SegmentedControl } from "../src/ui";
import { AmountSkeleton } from "../src/ui/AmountSkeleton";
import { useNotify } from "../src/ui/notify";
import { SwipeActions, type SwipeAction } from "../src/ui/SwipeActions";

const PAGE_SIZE = 20;
const SHEET_UNMOUNT_MS = 600;

/**
 * Por revisar v3: lo que se detectó en los correos (y capturas) y espera una
 * decisión. Nada se registra sin confirmar.
 *
 * Cada tarjeta dice cuándo se detectó, la fila de siempre (lo detectado, cuenta
 * y categoría, monto) y abajo Descartar y Confirmar. El backend no sugiere
 * categoría y la app tampoco la adivina (las descripciones son plantillas del
 * banco, iguales para todos los consumos): "Elegir categoría" abre la hoja ahí
 * mismo y, elegida, el botón pasa a "Confirmar". Si a un pago programado le
 * falta exactamente ese monto, un selector entre "Aplicar a pago" y
 * "Movimiento normal", con "Aplicar a pago" elegido por defecto.
 *
 * Deslizar a la derecha confirma y a la izquierda descarta, pero siempre pide
 * confirmación en una hoja: un deslizamiento puede ser sin querer y no hay
 * forma de deshacerlo. Los botones de la tarjeta actúan directo. Descartar
 * oculta el pendiente sin crear nada, así que no va en `danger`.
 *
 * "Seleccionar" (o mantener presionada una tarjeta) entra al modo en lote con
 * la barra flotante "Descartar (n)". Tocar una tarjeta abre la revisión.
 */
export default function PendingMovementsScreen() {
  const { i18n, t } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const toast = useNotify();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { themeMode } = useThemeMode();
  const { capabilities } = useCapabilities();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // La categoría elegida en la lista y "Aplicar a pago", por pendiente.
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [payMode, setPayMode] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [pulling, setPulling] = useState(false);

  // Hoja de categorías de un pendiente: se monta al abrir y se desmonta al terminar de cerrarse.
  const [sheetItem, setSheetItem] = useState<PendingMovementCard | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openCategorySheet = (item: PendingMovementCard) => {
    setSheetItem(item);
    requestAnimationFrame(() => setSheetOpen(true));
  };
  useEffect(() => {
    if (sheetOpen) return;
    const id = setTimeout(() => setSheetItem(null), SHEET_UNMOUNT_MS);
    return () => clearTimeout(id);
  }, [sheetOpen]);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(themeMode === "dark" ? "light" : "dark");
      return () => setStatusBarStyle("light");
    }, [themeMode]),
  );

  const pendingQuery = useInfiniteQuery({
    queryKey: ["pending-movements", "pages"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => financeApi.listPendingMovements({ limit: PAGE_SIZE, cursor: pageParam }, signal),
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
  });
  const items = useMemo(() => pendingQuery.data?.pages.flatMap((page) => page.items) ?? [], [pendingQuery.data]);
  const summaryQuery = useQuery({ queryKey: ["pending-movements", "summary"], queryFn: financeApi.getPendingMovementsSummary });
  const total = pendingQuery.hasNextPage ? (summaryQuery.data?.count ?? items.length) : items.length;

  const occurrencesQuery = useQuery({
    queryKey: ["payment-occurrences", "open"],
    queryFn: ({ signal }) => financeApi.listPaymentOccurrences({ status: "open" }, signal),
    enabled: capabilities.features.pendingToPayment,
  });
  const expenseCategories = useQuery({ queryKey: ["categories", "expense"], queryFn: () => financeApi.listCategories("expense") });
  const incomeCategories = useQuery({ queryKey: ["categories", "income"], queryFn: () => financeApi.listCategories("income") });
  const categories = useMemo(() => [...(expenseCategories.data ?? []), ...(incomeCategories.data ?? [])], [expenseCategories.data, incomeCategories.data]);
  // Tiempo real: un pendiente nuevo, o uno resuelto en otro dispositivo, refresca la lista.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      channel = supabase
        .channel(`pending-movements-list-${data.user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "pending_movements", filter: `user_id=eq.${data.user.id}` }, (payload) => {
          void queryClient.invalidateQueries({ queryKey: ["pending-movements"] });
          if ((payload.new as { status?: string } | null)?.status === "confirmed") {
            for (const key of ["transactions", "dashboard", "summary", "accounts", "reports"]) void queryClient.invalidateQueries({ queryKey: [key] });
          }
        })
        .subscribe();
    });
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const markBusy = (id: string, on: boolean) =>
    setBusy((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const confirmMutation = useMutation({
    mutationFn: async ({ item, input }: { item: PendingMovementCard; input: ConfirmPendingInput | "transfer" }) => {
      if (input === "transfer") {
        return financeApi.createTransfer({
          originAccountId: item.transfer!.originMatch!.accountId,
          destinationAccountId: item.transfer!.destinationMatch!.accountId,
          amount: item.amount!,
          currency: item.currency!,
          transactionDate: item.transactionDate,
          pendingMovementId: item.id,
        });
      }
      return financeApi.confirmPendingMovement(item.id, input);
    },
    onMutate: ({ item }) => markBusy(item.id, true),
    onSuccess: async () => {
      await invalidatePendingAndFinance(queryClient);
      toast.show(t("movements.createdToast"), { message: t("movements.createdMessage"), preset: "success" });
    },
    onError: (error) =>
      toast.show(t("movementUx.pendingConfirmError"), { message: error instanceof Error ? error.message : undefined, preset: "error" }),
    onSettled: (_data, _error, { item }) => markBusy(item.id, false),
  });

  const discardMutation = useMutation({
    mutationFn: (id: string) => financeApi.discardPendingMovement(id),
    onMutate: (id) => markBusy(id, true),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pending-movements"] });
      toast.show(t("movementUx.pendingDiscarded"), { preset: "success" });
    },
    onError: (error) =>
      toast.show(t("movementUx.pendingDiscardError"), { message: error instanceof Error ? error.message : undefined, preset: "error" }),
    onSettled: (_data, _error, id) => markBusy(id, false),
  });

  const bulkDiscardMutation = useMutation({
    mutationFn: (ids: string[]) => financeApi.discardPendingMovementsBulk(ids),
    onSuccess: async () => {
      setSelectionMode(false);
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ["pending-movements"] });
      toast.show(t("movementUx.bulkDiscarded"), { preset: "success" });
    },
    onError: (error) =>
      toast.show(t("movementUx.bulkDiscardError"), { message: error instanceof Error ? error.message : undefined, preset: "error" }),
  });

  const categoryFor = (item: PendingMovementCard): Category | null => {
    const name = chosen[item.id];
    return name ? (categories.find((c) => c.name === name && c.type === item.type) ?? null) : null;
  };
  const matchFor = (item: PendingMovementCard): PaymentOccurrence | null =>
    capabilities.features.pendingToPayment && canConfirmFromList(item)
      ? matchingOccurrence(compatibleOccurrences(occurrencesQuery.data ?? [], item), item.amount)
      : null;

  // Si coincide con un pago, por defecto se aplica a ese pago (decisión de Cristhofer); "Movimiento normal" lo cambia.
  const applyPayment = (item: PendingMovementCard) => payMode[item.id] ?? true;

  const openReview = (item: PendingMovementCard) => router.push({ pathname: "/pending-review", params: { id: item.id } });

  /** Si "Confirmar" registraría el movimiento ahora (y no abre la revisión o la hoja de categorías). */
  const wouldConfirm = (item: PendingMovementCard) => {
    if (item.transfer) return isMatchedTransfer(item);
    if (!canConfirmFromList(item)) return false;
    return Boolean((matchFor(item) && applyPayment(item)) || categoryFor(item));
  };

  // Deslizar pide confirmación en una hoja; si no registraría nada (falta algo), hace lo mismo que el botón.
  const [swipeAsk, setSwipeAsk] = useState<{ item: PendingMovementCard; action: "confirm" | "discard" } | null>(null);
  const [swipeAskOpen, setSwipeAskOpen] = useState(false);
  const askSwipe = (item: PendingMovementCard, action: "confirm" | "discard") => {
    if (action === "confirm" && !wouldConfirm(item)) {
      void primary(item);
      return;
    }
    setSwipeAsk({ item, action });
    requestAnimationFrame(() => setSwipeAskOpen(true));
  };
  useEffect(() => {
    if (swipeAskOpen) return;
    const id = setTimeout(() => setSwipeAsk(null), SHEET_UNMOUNT_MS);
    return () => clearTimeout(id);
  }, [swipeAskOpen]);

  /** Lo que hace "Confirmar" (o deslizar a la derecha): confirmar si se puede, o pedir lo que falta. */
  const primary = async (item: PendingMovementCard) => {
    if (busy.has(item.id)) return;
    if (item.transfer) {
      if (isMatchedTransfer(item)) confirmMutation.mutate({ item, input: "transfer" });
      else openReview(item);
      return;
    }
    if (!canConfirmFromList(item)) {
      openReview(item);
      return;
    }
    const match = matchFor(item);
    if (match && applyPayment(item)) {
      confirmMutation.mutate({
        item,
        input: {
          mode: "payment",
          paymentOccurrenceId: match.id,
          title: item.title,
          type: "expense",
          amount: item.amount!,
          currency: item.currency!,
          transactionDate: item.transactionDate,
          accountId: item.accountSuggestion!.id,
          categoryId: null,
          note: item.title,
          originInstallationId: await getInstallationId(),
        },
      });
      return;
    }
    const category = categoryFor(item);
    if (!category) {
      openCategorySheet(item);
      return;
    }
    confirmMutation.mutate({
      item,
      input: {
        mode: "transaction",
        title: item.title,
        type: item.type!,
        amount: item.amount!,
        currency: item.currency!,
        transactionDate: item.transactionDate,
        accountId: item.accountSuggestion!.id,
        categoryId: category.id,
        note: item.title,
      },
    });
  };

  const toggleSelection = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const enterSelection = (id?: string) => {
    setSelectionMode(true);
    setSelectedIds(id ? new Set([id]) : new Set());
  };
  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const detectedLabel = (item: PendingMovementCard) => {
    const { day, date } = detectedWhen(item.detectedAt, new Date());
    const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date);
    const when = day === "date" ? shortDay(date, locale) : t(`pendingScreen.${day}`, { time });
    return t("pendingScreen.detected", { when });
  };

  const header = (
    <YStack px={space[4]} pb={space[3]}>
      {selectionMode ? (
        <XStack items="center" justify="space-between" gap={space[3]} minH={40}>
          <Pressable
            onPress={() => setSelectedIds((current) => (current.size === items.length ? new Set() : new Set(items.map((i) => i.id))))}
            accessibilityRole="button"
            accessibilityHint={t("pendingScreen.selectAll")}
          >
            <FText variant="display-lg" accessibilityRole="header" style={{ fontSize: 26, lineHeight: 32 }}>
              {t("pendingScreen.selected", { count: selectedIds.size })}
            </FText>
          </Pressable>
          <TextAction label={t("pendingScreen.cancel")} onPress={exitSelection} />
        </XStack>
      ) : (
        <XStack items="center" gap={space[3]}>
          <IconButton label={t("pendingScreen.back")} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
          <FText variant="display-lg" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>
            {t("pendingScreen.title")}
          </FText>
          {items.length ? <TextAction label={t("pendingScreen.select")} onPress={() => enterSelection()} /> : null}
        </XStack>
      )}
      {!selectionMode ? (
        <FText variant="body" tone="inkMuted" style={{ fontSize: 14, lineHeight: 20, marginTop: 10 }}>
          {t("pendingScreen.hint")}
        </FText>
      ) : null}
      {items.length ? (
        <XStack items="center" justify="space-between" gap={space[3]} mt={space[4]}>
          <FText variant="body-strong" style={{ fontSize: 14 }}>
            {t("pendingScreen.count", { count: total })}
          </FText>
          <FText variant="caption" tone="inkFaint" numberOfLines={1} style={{ flexShrink: 1 }}>
            {t(selectionMode ? "pendingScreen.tapToMark" : "pendingScreen.swipeHint")}
          </FText>
        </XStack>
      ) : null}
    </YStack>
  );

  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: space[2], paddingBottom: insets.bottom + (selectionMode ? 110 : space[6]), flexGrow: 1 }}
        ItemSeparatorComponent={() => <View height={10} />}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => {
              setPulling(true);
              void pendingQuery.refetch().finally(() => setPulling(false));
            }}
            tintColor={theme.brand.val}
            colors={[theme.brand.val]}
            progressBackgroundColor={theme.surface.val}
          />
        }
        onEndReached={() => {
          if (pendingQuery.hasNextPage && !pendingQuery.isFetchingNextPage) void pendingQuery.fetchNextPage();
        }}
        onEndReachedThreshold={0.35}
        ListEmptyComponent={
          pendingQuery.isLoading ? (
            <ListSkeleton />
          ) : pendingQuery.error ? (
            <View mx={space[4]}>
              <DataStateCard message={t("movementUx.pendingError")} onRetry={() => void pendingQuery.refetch()} />
            </View>
          ) : (
            <YStack items="center" gap={space[3]} px={space[6]} pt={space[8]}>
              <View width={52} height={52} rounded={999} bg="$surfaceSunken" items="center" justify="center">
                <Inbox size={22} color="$inkMuted" />
              </View>
              <FText variant="heading" style={{ textAlign: "center" }}>
                {t("pendingScreen.emptyTitle")}
              </FText>
              <FText variant="body" tone="inkMuted" style={{ textAlign: "center", fontSize: 14 }}>
                {t("pendingScreen.emptyHint")}
              </FText>
            </YStack>
          )
        }
        ListFooterComponent={
          pendingQuery.isFetchingNextPage ? (
            <YStack py={space[4]} items="center">
              <FintSpinner color="$brand" />
            </YStack>
          ) : null
        }
        renderItem={({ item }) => (
          <View px={space[4]}>
            <PendingCard
              item={item}
              detected={detectedLabel(item)}
              category={categoryFor(item)}
              match={matchFor(item)}
              applyPayment={applyPayment(item)}
              busy={busy.has(item.id)}
              selectionMode={selectionMode}
              selected={selectedIds.has(item.id)}
              locale={locale}
              onPress={() =>
                selectionMode
                  ? toggleSelection(item.id)
                  : capabilities.features.editablePendingMovements || !canConfirmFromList(item)
                    ? openReview(item)
                    : undefined
              }
              onLongPress={() => (selectionMode ? undefined : enterSelection(item.id))}
              onPayMode={(apply) => setPayMode((current) => ({ ...current, [item.id]: apply }))}
              onPrimary={() => void primary(item)}
              onSwipe={(action) => askSwipe(item, action)}
              onChooseCategory={() => openCategorySheet(item)}
              onDiscard={() => discardMutation.mutate(item.id)}
            />
          </View>
        )}
      />

      {/* Barra flotante del modo en lote. */}
      {selectionMode ? (
        <View position="absolute" l={space[4]} r={space[4]} b={Math.max(insets.bottom, 16) + 8}>
          <XStack
            p={7}
            rounded={radius["2xl"]}
            bg="$glass"
            borderWidth={1}
            borderColor="$glassLine"
            style={{ boxShadow: shadows[themeMode].float }}
          >
            <PressableScale
              onPress={() => bulkDiscardMutation.mutate(Array.from(selectedIds))}
              disabled={selectedIds.size === 0 || bulkDiscardMutation.isPending}
              accessibilityRole="button"
              style={{ flex: 1 }}
            >
              <XStack height={48} rounded={radius.xl} bg="$surfaceSunken" items="center" justify="center" gap={8} opacity={selectedIds.size ? 1 : 0.5}>
                {bulkDiscardMutation.isPending ? <FintSpinner color="$ink" /> : <X size={16} color="$ink" strokeWidth={2.2} />}
                <FText variant="body-strong">{t("pendingScreen.discardCount", { count: selectedIds.size })}</FText>
              </XStack>
            </PressableScale>
          </XStack>
        </View>
      ) : null}

      {sheetItem && sheetItem.type ? (
        <CategorySheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          type={sheetItem.type}
          categories={sheetItem.type === "income" ? (incomeCategories.data ?? []) : (expenseCategories.data ?? [])}
          frequent={[]}
          value={categoryFor(sheetItem)?.name ?? ""}
          onSelect={(name) => setChosen((current) => ({ ...current, [sheetItem.id]: name }))}
        />
      ) : null}

      {swipeAsk ? (
        <SwipeConfirmSheet
          open={swipeAskOpen}
          onClose={() => setSwipeAskOpen(false)}
          item={swipeAsk.item}
          action={swipeAsk.action}
          detail={
            swipeAsk.item.transfer
              ? transferLine(swipeAsk.item, t)
              : [
                  swipeAsk.item.accountSuggestion?.name,
                  matchFor(swipeAsk.item) && applyPayment(swipeAsk.item)
                    ? t("pendingScreen.appliedTo", { title: matchFor(swipeAsk.item)!.title })
                    : categoryFor(swipeAsk.item)
                      ? getCategoryLabel(categoryFor(swipeAsk.item)!.name, t)
                      : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
          }
          onConfirm={() => {
            const { item, action } = swipeAsk;
            setSwipeAskOpen(false);
            if (action === "discard") discardMutation.mutate(item.id);
            else void primary(item);
          }}
        />
      ) : null}
    </YStack>
  );
}

async function invalidatePendingAndFinance(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all(
    ["pending-movements", "transactions", "dashboard", "summary", "accounts", "reports", "payment-occurrences"].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  );
}

/**
 * La línea de una transferencia: de qué cuenta sale y a cuál entra ("Cuenta de prueba → Interbank Carlos"). Si un
 * lado no es una cuenta tuya, va el nombre que trae el correo; sin nombre, "fuera de tus cuentas".
 */
function transferLine(item: PendingMovementCard, t: (key: string, options?: Record<string, unknown>) => string) {
  const transfer = item.transfer;
  if (!transfer) return "";
  const side = (match: { accountName: string } | null, raw: string | null) => match?.accountName ?? raw ?? t("pendingScreen.outsideShort");
  return `${side(transfer.originMatch, transfer.originAccountName)} → ${side(transfer.destinationMatch, transfer.destinationAccountName)}`;
}

function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button">
      <FText variant="body-strong" tone="brand">
        {label}
      </FText>
    </Pressable>
  );
}

/**
 * Tarjeta de un pendiente. En el modo en lote es compacta (círculo de
 * selección, fila y monto) y la marcada lleva borde `brand`.
 */
function PendingCard({
  item,
  detected,
  category,
  match,
  applyPayment,
  busy,
  selectionMode,
  selected,
  locale,
  onPress,
  onLongPress,
  onPayMode,
  onPrimary,
  onChooseCategory,
  onDiscard,
  onSwipe,
}: {
  item: PendingMovementCard;
  detected: string;
  category: Category | null;
  match: PaymentOccurrence | null;
  applyPayment: boolean;
  busy: boolean;
  selectionMode: boolean;
  selected: boolean;
  locale: string;
  onPress: () => void;
  onLongPress: () => void;
  onPayMode: (apply: boolean) => void;
  onPrimary: () => void;
  onChooseCategory: () => void;
  onDiscard: () => void;
  onSwipe: (action: "confirm" | "discard") => void;
}) {
  const { t } = useTranslation();
  const quick = canConfirmFromList(item);
  const needsCategory = quick && !category && !(match && applyPayment);
  const primaryLabel = item.transfer
    ? isMatchedTransfer(item)
      ? t("pendingScreen.confirm")
      : t("pendingScreen.review")
    : !quick
      ? t("pendingScreen.review")
      : needsCategory
        ? t("pendingScreen.chooseCategory")
        : t("pendingScreen.confirm");
  const primaryIsConfirm = primaryLabel === t("pendingScreen.confirm");

  const accountName = item.transfer ? transferLine(item, t) : (item.accountSuggestion?.name ?? t("pendingScreen.noAccount"));
  const kind = item.transfer ? "transfer" : item.type === "income" ? "income" : "expense";

  const row = (
    <XStack items="center" gap={12}>
      {selectionMode ? (
        <View
          width={24}
          height={24}
          rounded={999}
          borderWidth={selected ? 0 : 1.5}
          borderColor="$lineStrong"
          bg={selected ? "$brand" : "transparent"}
          items="center"
          justify="center"
        >
          {selected ? <Check size={14} color="$onBrand" strokeWidth={3} /> : null}
        </View>
      ) : null}
      {item.transfer ? (
        <Monogram name={item.title} icon={<ArrowLeftRight size={17} color="$inkMuted" strokeWidth={2} />} />
      ) : (
        <Monogram name={item.title} color={`$chart${categoryColorIndex(item.title)}` as ColorTokens} />
      )}
      <YStack flex={1} minW={0}>
        <FText variant="body-strong" numberOfLines={1} style={{ letterSpacing: -0.15 }}>
          {item.title}
        </FText>
        <FText variant="caption" tone="inkFaint" numberOfLines={1} style={{ marginTop: 1 }}>
          {accountName}
          {item.transfer ? null : match && applyPayment ? (
            ` · ${t("pendingScreen.appliedTo", { title: match.title })}`
          ) : category ? (
            ` · ${category.icon ? `${category.icon} ` : ""}${getCategoryLabel(category.name, t)}`
          ) : (
            <FText variant="caption" tone="ink" style={{ fontFamily: fontFace.sans[600] }}>
              {` · ${t("pendingScreen.noCategory")}`}
            </FText>
          )}
        </FText>
      </YStack>
      {item.amount !== null && item.currency ? (
        <Amount value={item.amount} currency={item.currency} kind={kind} />
      ) : (
        <FText variant="caption" tone="inkMuted">
          {t("pendingScreen.noAmount")}
        </FText>
      )}
    </XStack>
  );

  const swipeRight: SwipeAction[] = selectionMode
    ? []
    : [
        {
          key: "primary",
          // Cabe en 78px: "Elegir" en lugar de "Elegir categoría".
          label: needsCategory ? t("pendingScreen.choose") : primaryLabel,
          icon: <Check size={18} color="$onBrand" strokeWidth={2.4} />,
          tone: "brand",
          run: needsCategory ? onChooseCategory : () => onSwipe("confirm"),
        },
      ];
  const swipeLeft: SwipeAction[] = selectionMode
    ? []
    : [{ key: "discard", label: t("pendingScreen.discard"), icon: <X size={18} color="$ink" strokeWidth={2.2} />, tone: "neutral", run: () => onSwipe("discard") }];

  return (
    <SwipeActions actions={busy ? [] : swipeLeft} leftActions={busy ? [] : swipeRight} radius={radius.lg} immediate>
      <Pressable
        onPress={busy ? undefined : onPress}
        onLongPress={busy ? undefined : onLongPress}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityState={selectionMode ? { selected } : undefined}
        accessibilityLabel={item.title}
        accessibilityActions={
          selectionMode
            ? undefined
            : [
                { name: "primary", label: primaryLabel },
                { name: "discard", label: t("pendingScreen.discard") },
              ]
        }
        onAccessibilityAction={(e) => (e.nativeEvent.actionName === "discard" ? onDiscard() : onPrimary())}
      >
        <FintCard
          p={selectionMode ? 14 : 16}
          gap={12}
          opacity={busy ? 0.6 : 1}
          borderWidth={selected ? 1.5 : 1}
          borderColor={selected ? "$brand" : "$line"}
        >
          {!selectionMode ? (
            <XStack items="center" gap={6}>
              <Mail size={13} color="$inkFaint" strokeWidth={2} />
              <FText variant="caption" tone="inkFaint" numberOfLines={1} style={{ fontSize: 12 }}>
                {detected}
              </FText>
            </XStack>
          ) : null}
          {row}

          {!selectionMode && match && item.type === "expense" ? (
            <YStack gap={10} p={12} rounded={radius.md} bg="$surfaceSunken">
              <XStack items="center" gap={8}>
                <Repeat size={14} color="$inkMuted" strokeWidth={2} />
                <FText variant="caption" tone="inkMuted" style={{ flex: 1, fontSize: 13 }}>
                  {t("pendingScreen.matchBefore")}
                  <FText variant="caption" tone="ink" style={{ fontSize: 13, fontFamily: fontFace.sans[600] }}>
                    {match.title}
                  </FText>
                  {match.dueDate ? t("pendingScreen.matchAfter", { date: shortDay(parseDateString(match.dueDate)!, locale) }) : ""}
                </FText>
              </XStack>
              <SegmentedControl
                size="sm"
                options={[
                  { value: "pay", label: t("pendingScreen.applyToPayment") },
                  { value: "normal", label: t("pendingScreen.normalMovement") },
                ]}
                value={applyPayment ? "pay" : "normal"}
                onChange={(value) => onPayMode(value === "pay")}
                accessibilityLabel={t("pendingScreen.paymentModeLabel")}
              />
            </YStack>
          ) : null}

          {!selectionMode ? (
            <XStack items="center" justify="flex-end" gap={8}>
              <Pressable onPress={busy ? undefined : onDiscard} hitSlop={6} accessibilityRole="button" style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                <FText variant="body-strong" tone="inkMuted" style={{ fontSize: 14 }}>
                  {t("pendingScreen.discard")}
                </FText>
              </Pressable>
              <PressableScale onPress={busy ? undefined : needsCategory ? onChooseCategory : onPrimary} accessibilityRole="button">
                <XStack
                  height={36}
                  px={16}
                  rounded={radius.pill}
                  items="center"
                  gap={6}
                  bg={primaryIsConfirm ? "$brandWash" : "transparent"}
                  borderWidth={primaryIsConfirm ? 0 : 1}
                  borderColor="$lineStrong"
                >
                  {busy ? <FintSpinner color="$brand" /> : null}
                  <FText variant="body-strong" tone={primaryIsConfirm ? "brand" : "ink"} style={{ fontSize: 14 }}>
                    {primaryLabel}
                  </FText>
                </XStack>
              </PressableScale>
            </XStack>
          ) : null}
        </FintCard>
      </Pressable>
    </SwipeActions>
  );
}

/** La confirmación de un deslizamiento: qué se va a registrar (o descartar), y Cancelar. */
function SwipeConfirmSheet({
  open,
  onClose,
  item,
  action,
  detail,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  item: PendingMovementCard;
  action: "confirm" | "discard";
  detail: string;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const confirm = action === "confirm";
  const kind = item.transfer ? "transfer" : item.type === "income" ? "income" : "expense";
  return (
    <FintSheet open={open} onClose={onClose} title={t(confirm ? "pendingScreen.confirmTitle" : "pendingScreen.discardTitle")}>
      <YStack px={space[5]} pt={space[2]} gap={space[4]}>
        <FText variant="body" tone="inkMuted" style={{ fontSize: 14, lineHeight: 20 }}>
          {t(confirm ? "pendingScreen.confirmHint" : "pendingScreen.discardHint")}
        </FText>
        <XStack items="center" gap={12} p={14} rounded={radius.lg} bg="$surfaceSunken">
          <YStack flex={1} minW={0}>
            <FText variant="body-strong" numberOfLines={2}>
              {item.title}
            </FText>
            {detail ? (
              <FText variant="caption" tone="inkMuted" numberOfLines={1} style={{ marginTop: 2 }}>
                {detail}
              </FText>
            ) : null}
          </YStack>
          {item.amount !== null && item.currency ? <Amount value={item.amount} currency={item.currency} kind={kind} /> : null}
        </XStack>
        <YStack gap={10}>
          <FintButton minH={50} rounded={radius.md} haptic={confirm ? "tap" : "warning"} onPress={onConfirm}>
            {t(confirm ? "pendingScreen.confirm" : "pendingScreen.discard")}
          </FintButton>
          <FintButton variant="ghost" minH={50} rounded={radius.md} bg="$surfaceSunken" color="$ink" onPress={onClose}>
            {t("pendingScreen.cancel")}
          </FintButton>
        </YStack>
      </YStack>
    </FintSheet>
  );
}

function ListSkeleton() {
  return (
    <YStack gap={10} px={space[4]}>
      {[0, 1, 2].map((i) => (
        <YStack key={i} gap={12} p={16} rounded={radius.lg} borderWidth={1} borderColor="$line" bg="$surface">
          <AmountSkeleton width={140} height={10} />
          <XStack items="center" gap={12}>
            <View width={38} height={38} rounded={999} bg="$surfaceSunken" />
            <YStack flex={1} gap={6}>
              <AmountSkeleton width={120} height={12} />
              <AmountSkeleton width={160} height={10} />
            </YStack>
            <AmountSkeleton width={80} height={12} />
          </XStack>
        </YStack>
      ))}
    </YStack>
  );
}
