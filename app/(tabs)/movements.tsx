import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowLeftRight,
  ChevronRight,
  ImageUp,
  Mail,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "@tamagui/lucide-icons-2";
import { useNotify } from "../../src/ui/notify";
import { Link, useRouter } from "expo-router";
import { useDeferredValue, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Input, Paragraph, useTheme, XStack, YStack } from "tamagui";
import { financeApi } from "../../src/api/finance";
import { formatMoney, normalizeTransaction } from "../../src/api/mappers";
import type { Transaction } from "../../src/api/types";
import { supabase } from "../../src/auth/supabase";
import { DataStateCard } from "../../src/components/DataStateCard";
import { EmptyState } from "../../src/components/EmptyState";
import { SwipeableRow } from "../../src/components/SwipeableRow";
import {
  SkeletonGroup,
  SkeletonBlock,
  SkeletonList,
} from "../../src/components/Skeleton";
import { getCategoryLabel } from "../../src/finance/categoryLabels";
import {
  FintButton,
  FintCard,
  FintConfirmDialog,
  FintSheetSelect,
  FintSpinner,
} from "../../src/ui";
import { useSensitiveMoney } from "../../src/privacy/useSensitiveMoney";
import { SensitiveAmountToggle } from "../../src/privacy/SensitiveAmountToggle";
import { useCapabilities } from "../../src/api/capabilities";
import { useThemeMode } from "../../src/theme/ThemeMode";

const PAGE_SIZE = 30;

type MovementListItem =
  | { kind: "movement"; movement: Transaction }
  | {
      kind: "transfer";
      transferGroupId: string;
      date: string;
      amount: number;
      currency: string;
      origin: Transaction;
      destination: Transaction;
    };

function groupMovements(movements: Transaction[]): MovementListItem[] {
  const grouped: MovementListItem[] = [];
  const seen = new Set<string>();
  for (const movement of movements) {
    if (movement.type === "transfer" && movement.transferGroupId) {
      if (seen.has(movement.transferGroupId)) continue;
      const legs = movements.filter(
        (item) => item.transferGroupId === movement.transferGroupId,
      );
      const origin = legs.find((item) => item.transferDirection === "origin");
      const destination = legs.find(
        (item) => item.transferDirection === "destination",
      );
      if (origin && destination) {
        seen.add(movement.transferGroupId);
        grouped.push({
          kind: "transfer",
          transferGroupId: movement.transferGroupId,
          date: origin.date,
          amount: origin.amount,
          currency: origin.currency,
          origin,
          destination,
        });
        continue;
      }
    }
    grouped.push({ kind: "movement", movement });
  }
  return grouped;
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthRange(month: Date) {
  return {
    from: isoDate(new Date(month.getFullYear(), month.getMonth(), 1)),
    to: isoDate(new Date(month.getFullYear(), month.getMonth() + 1, 1)),
  };
}
const FLOATING_ACTION_CLEARANCE = 96

export default function MovementsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const toast = useNotify();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { capabilities } = useCapabilities();
  const { themeMode } = useThemeMode();
  const theme = useTheme();
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [summaryCurrency, setSummaryCurrency] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [reverseTarget, setReverseTarget] = useState<Transaction | null>(null);
  const [reverseTransferTarget, setReverseTransferTarget] = useState<
    string | null
  >(null);
  const range = monthRange(month);
  const deferredSearch = useDeferredValue(search);
  const term = deferredSearch.trim();
  const isSearching = term.length > 0;
  const movementsQuery = useInfiniteQuery({
    // Con término de búsqueda vamos al servidor con `q` sobre TODO el historial
    // (sin rango de mes); sin término, paginamos el mes seleccionado.
    queryKey: isSearching
      ? ["transactions", "search", term]
      : ["transactions", "pages", range.from, range.to],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      financeApi.getTransactionPage(
        isSearching
          ? { q: term, limit: PAGE_SIZE, cursor: pageParam }
          : { ...range, limit: PAGE_SIZE, cursor: pageParam },
        signal,
      ),
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,  });
  const pendingSummaryQuery = useQuery({
    queryKey: ["pending-movements", "summary"],
    queryFn: financeApi.getPendingMovementsSummary,  });
  const movements = (
    movementsQuery.data?.pages.flatMap((page) => page.items) ?? []
  ).map(normalizeTransaction);
  const movementItems = groupMovements(movements);
  const summary = movementsQuery.data?.pages[0]?.summary;
  const currencySummary =
    summary?.byCurrency.find((item) => item.currency === summaryCurrency) ??
    summary?.byCurrency[0];
  const currency = currencySummary?.currency ?? "PEN";
  const pendingCount = pendingSummaryQuery.data?.count ?? 0;
  const monthOptions = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      new Date().getFullYear(),
      new Date().getMonth() - index,
      1,
    );
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat(i18n.language, {
      month: "long",
      year: "numeric",
    }).format(date);
    return {
      value,
      label: label.charAt(0).toLocaleUpperCase(i18n.language) + label.slice(1),
    };
  });
  const monthValue = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    if (currencySummary && summaryCurrency !== currencySummary.currency)
      setSummaryCurrency(currencySummary.currency);
  }, [currencySummary, summaryCurrency]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      channel = supabase
        .channel(`pending-movements-${data.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "pending_movements",
            filter: `user_id=eq.${data.user.id}`,
          },
          (payload) => {
            void queryClient.invalidateQueries({
              queryKey: ["pending-movements", "summary"],
            });
            void queryClient.invalidateQueries({
              queryKey: ["pending-movements"],
            });
            if (
              (payload.new as { status?: string } | null)?.status ===
              "confirmed"
            ) {
              void queryClient.invalidateQueries({
                queryKey: ["transactions"],
              });
              void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
              void queryClient.invalidateQueries({ queryKey: ["summary"] });
              void queryClient.invalidateQueries({ queryKey: ["accounts"] });
              void queryClient.invalidateQueries({ queryKey: ["reports"] });
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financeApi.deleteTransaction(id),
    onSuccess: async () => {
      setDeleteTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
      toast.success(t("movementUx.deletedToast"), {
        message: t("movementUx.deletedMessage"),
      });
    },
    onError: () => toast.error(t("movementUx.deleteError")),
  });

  const reversePaymentMutation = useMutation({
    mutationFn: (paymentId: string) =>
      financeApi.reversePaymentOccurrencePayment(paymentId, {
        reason: "Reverted from mobile history",
      }),
    onSuccess: async () => {
      setReverseTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["payment-occurrences"] }),
        queryClient.invalidateQueries({ queryKey: ["summary"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
        queryClient.invalidateQueries({ queryKey: ["pending-movements"] }),
      ]);
      toast.show(t("movementUx.revertedToast"), {
        message: t("movementUx.revertedMessage"),
        preset: "success",
      });
    },
    onError: () =>
      toast.show(t("movementUx.reverseError"), { preset: "error" }),
  });

  const reverseTransferMutation = useMutation({
    mutationFn: (transferGroupId: string) =>
      financeApi.reverseTransfer(transferGroupId),
    onSuccess: async () => {
      setReverseTransferTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["summary"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
      toast.show(t("movementUx.revertedToast"), {
        message: t("movementUx.revertedMessage"),
        preset: "success",
      });
    },
    onError: () =>
      toast.show(t("movementUx.reverseError"), { preset: "error" }),
  });

  const header = (
    <YStack mx={-16} mb="$4">
      {}
      <YStack bg="$headerBackground" px="$4" pt="$5" pb="$7">
        {movementsQuery.isLoading ? (
          <YStack gap="$2">
            <SkeletonBlock height={14} width="42%" opacity={0.5} />
            <SkeletonBlock height={40} width="70%" opacity={0.5} />
          </YStack>
        ) : (
          <MovementHero
            currency={currency}
            expenses={currencySummary?.expenses ?? 0}
            income={currencySummary?.income ?? 0}
          />
        )}
      </YStack>
      <YStack
        bg="$background"
        mt={-26}
        pt="$5"
        px={16}
        gap="$4"
        style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
      >
      {(summary?.byCurrency.length ?? 0) > 1 ? (
        <FintSheetSelect
          label={t("forms.currency")}
          placeholder={t("forms.currency")}
          value={currency}
          options={(summary?.byCurrency ?? []).map((item) => ({
            value: item.currency,
            label: item.currency,
          }))}
          onValueChange={setSummaryCurrency}
        />
      ) : null}
      <FintSheetSelect
        label={t("movementUx.period")}
        value={monthValue}
        placeholder={t("movementUx.selectMonth")}
        options={monthOptions}
        onValueChange={(value) => {
          const [year, selectedMonth] = value.split("-").map(Number);
          setMonth(new Date(year, selectedMonth - 1, 1));
        }}
      />
      <FintCard
        p={0}
        overflow="hidden"
        borderColor={pendingCount ? "$yellow7" : "$borderColor"}
      >
        <XStack
          items="center"
          gap="$3"
          minH={56}
          p="$3"
          bg={pendingCount ? "$yellow2" : "$muted"}
          role="button"
          transition="quick"
          pressStyle={{ scale: 0.98, opacity: 0.9 }}
          onPress={() => router.push("/pending-movements")}
          aria-label={t("movementUx.pendingCount", { count: pendingCount })}
        >
          <YStack
            width={36}
            height={36}
            rounded="$10"
            bg={pendingCount ? "$yellow4" : "$color4"}
            items="center"
            justify="center"
          >
            <Mail size={18} color={pendingCount ? "$yellow10" : "$color10"} />
          </YStack>
          <YStack flex={1} minW={0} gap="$1">
            <Paragraph
              color={pendingCount ? "$yellow11" : "$color11"}
              fontWeight="600"
            >
              {pendingSummaryQuery.isLoading
                ? t("movementUx.pendingTitle")
                : t("movementUx.pendingCount", { count: pendingCount })}
            </Paragraph>
            <Paragraph color="$color10" fontSize="$1">
              {t("movementUx.pendingReviewHint")}
            </Paragraph>
          </YStack>
          <ChevronRight size={19} color="$color10" />
        </XStack>
      </FintCard>
      <XStack items="center" justify="space-between" gap="$3">
        <YStack gap="$1">
          <Paragraph
            color="$color12"
            fontFamily="$heading"
            fontSize="$6"
            fontWeight="600"
          >
            {t("movementUx.movementCount", { count: summary?.totalCount ?? 0 })}
          </Paragraph>
          <Paragraph color="$color10" fontSize="$2">
            {t("movements.historySubtitle")}
          </Paragraph>
        </YStack>
        <Link href="/transaction-form" asChild>
          <FintButton
            circular
            bg="$primary"
            icon={<Plus size={21} color="$primaryForeground" />}
            aria-label={t("actions.newMovement")}
          />
        </Link>
      </XStack>
      <YStack gap="$2">
        <XStack
          items="center"
          gap="$2.5"
          bg="$muted"
          borderColor="$input"
          borderWidth={1}
          rounded={14}
          px="$3.5"
          minH={56}
        >
          <Search size={20} color="$color10" />
          <Input
            flex={1}
            unstyled
            color="$color12"
            fontSize="$4"
            placeholderTextColor="$mutedForeground"
            placeholder={t("movementUx.searchPlaceholder")}
            numberOfLines={1}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search ? (
            <XStack
              role="button"
              onPress={() => setSearch("")}
              aria-label={t("movementUx.searchClear")}
              p="$1.5"
              pressStyle={{ opacity: 0.6 }}
            >
              <X size={18} color="$color10" />
            </XStack>
          ) : null}
        </XStack>
        {term ? (
          <Paragraph color="$color9" fontSize="$1">
            {t("movementUx.searchScopeHint")}
          </Paragraph>
        ) : null}
      </YStack>
      {movementsQuery.error ? (
        <DataStateCard
          message={t("states.error")}
          onRetry={() => {
            void movementsQuery.refetch();
          }}
        />
      ) : null}
      </YStack>
    </YStack>
  );

  return (
    <YStack flex={1} bg="$background">
      <FlatList
        data={movementItems}
        keyExtractor={(item) =>
          item.kind === "transfer" ? item.transferGroupId : item.movement.id
        }
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 0,
          paddingBottom:
            Math.max(insets.bottom, 24) +
            (capabilities.features.captureImport && movementItems.length
              ? FLOATING_ACTION_CLEARANCE
              : 0),
          flexGrow: movementItems.length ? undefined : 1,
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          movementsQuery.isLoading || movementsQuery.error ? null : term ? (
            <EmptyState
              icon={<Search size={26} color="$primary" />}
              title={t("movementUx.searchEmptyTitle")}
              description={t("movementUx.searchEmptyDescription")}
              actionLabel={t("movementUx.searchClear")}
              onAction={() => setSearch("")}
            />
          ) : (
            <EmptyState
              icon={<ArrowLeftRight size={26} color="$primary" />}
              title={t("movements.emptyTitle")}
              description={t("movements.emptyDescription")}
              actionLabel={t("actions.newMovement")}
              actionIcon={<Plus size={18} />}
              onAction={() => router.push("/transaction-form")}
              secondaryActionLabel={
                capabilities.features.captureImport
                  ? t("capture.action")
                  : undefined
              }
              secondaryActionIcon={<ImageUp size={18} />}
              onSecondaryAction={
                capabilities.features.captureImport
                  ? () => router.push("/capture-import")
                  : undefined
              }
            />
          )
        }
        ListFooterComponent={
          movementsQuery.isFetchingNextPage ? (
            <YStack py="$4" items="center">
              <FintSpinner color="$primary" />
            </YStack>
          ) : null
        }
        ItemSeparatorComponent={() => <YStack height={8} />}
        refreshControl={
          <RefreshControl
            refreshing={
              movementsQuery.isRefetching && !movementsQuery.isFetchingNextPage
            }
            onRefresh={() => {
              void movementsQuery.refetch();
            }}
            tintColor={theme.headerAccent.val}
            colors={[theme.headerAccent.val]}
            progressBackgroundColor={theme.headerBackground.val}
          />
        }
        onEndReached={() => {
          if (movementsQuery.hasNextPage && !movementsQuery.isFetchingNextPage)
            void movementsQuery.fetchNextPage();
        }}
        onEndReachedThreshold={0.35}
        renderItem={({ item }) =>
          item.kind === "transfer" ? (
            <TransferMovementCard
              item={item}
              locale={i18n.language}
              onReverse={() => setReverseTransferTarget(item.transferGroupId)}
            />
          ) : (
            <MovementCard
              movement={item.movement}
              locale={i18n.language}
              onDelete={() => setDeleteTarget(item.movement)}
              onOpenDetail={() =>
                router.push({
                  pathname: "/transaction-detail",
                  params: {
                    id: item.movement.id,
                    type: item.movement.type as "income" | "expense",
                    amount: String(item.movement.amount),
                    currency: item.movement.currency,
                    category: item.movement.category,
                    account: item.movement.account,
                    note: item.movement.note ?? "",
                    date: item.movement.date,
                  },
                })
              }
              onReverse={() => setReverseTarget(item.movement)}
            />
          )
        }
      />
      {capabilities.features.captureImport && movementItems.length ? (
        <YStack
          position="absolute"
          r="$5"
          b={Math.max(insets.bottom, 16) + 28}
          width={56}
          height={56}
          rounded={999}
          bg="$primary"
          items="center"
          justify="center"
          shadowColor={themeMode === "dark" ? "#000000" : "#043036"}
          shadowOffset={{ width: 0, height: 8 }}
          shadowOpacity={themeMode === "dark" ? 0.28 : 0.14}
          shadowRadius={20}
          elevation={4}
          transition="quick"
          pressStyle={{ scale: 0.94, bg: "$primaryStrong" }}
          onPress={() => router.push("/capture-import")}
          aria-label={t("capture.action")}
        >
          <ImageUp size={24} color="$primaryForeground" />
        </YStack>
      ) : null}
      <ReverseTransferDialog
        isPending={reverseTransferMutation.isPending}
        open={Boolean(reverseTransferTarget)}
        onCancel={() => setReverseTransferTarget(null)}
        onConfirm={() =>
          reverseTransferTarget &&
          reverseTransferMutation.mutate(reverseTransferTarget)
        }
      />
      <DeleteMovementDialog
        movement={deleteTarget}
        isPending={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
      <ReversePaymentDialog
        movement={reverseTarget}
        isPending={reversePaymentMutation.isPending}
        onCancel={() => setReverseTarget(null)}
        onConfirm={() =>
          reverseTarget?.paymentOccurrencePaymentId &&
          reversePaymentMutation.mutate(
            reverseTarget.paymentOccurrencePaymentId,
          )
        }
      />
    </YStack>
  );
}

function MovementCard({
  locale,
  movement,
  onDelete,
  onOpenDetail,
  onReverse,
}: {
  locale: string;
  movement: Transaction;
  onDelete: () => void;
  onOpenDetail: () => void;
  onReverse: () => void;
}) {
  const { t } = useTranslation();
  const { formatSensitiveAmount } = useSensitiveMoney();
  const isIncome = movement.type === "income";
  const isStrandedTransfer = movement.type === "transfer";
  const isPayment = Boolean(movement.paymentOccurrenceId);
  const canReverse = isPayment && Boolean(movement.paymentOccurrencePaymentId);
  const canDelete = !isPayment && !isStrandedTransfer;
  return (
    <SwipeableRow
      enabled={canReverse || canDelete}
      onAction={canReverse ? onReverse : onDelete}
      actionColor={canReverse ? "$yellow9" : "$red9"}
      actionIcon={
        canReverse ? (
          <RotateCcw size={20} color="white" />
        ) : (
          <Trash2 size={20} color="white" />
        )
      }
      actionLabel={
        canReverse ? t("movementUx.reversePayment") : t("movementUx.deleteTitle")
      }
    >
    <FintCard py="$3">
      <XStack items="center" gap="$3">
        <XStack
          flex={1}
          minW={0}
          items="center"
          gap="$3"
          role={isPayment || isStrandedTransfer ? undefined : "button"}
          onPress={isPayment || isStrandedTransfer ? undefined : onOpenDetail}
        >
          <YStack
            width={42}
            height={42}
            rounded="$8"
            bg={isStrandedTransfer ? "$accent2" : isIncome ? "$green2" : "$red2"}
            items="center"
            justify="center"
          >
            {isStrandedTransfer ? (
              <ArrowLeftRight size={20} color="$primary" />
            ) : isIncome ? (
              <ArrowUp size={20} color="$green10" />
            ) : (
              <ArrowDown size={20} color="$red10" />
            )}
          </YStack>
          <YStack flex={1} minW={0} gap="$1">
            <Paragraph
              color="$color12"
              fontSize="$3"
              fontWeight="600"
              numberOfLines={1}
            >
              {getCategoryLabel(movement.category, t)}
            </Paragraph>
            <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>
              {new Intl.DateTimeFormat(locale, {
                day: "2-digit",
                month: "short",
              }).format(new Date(`${movement.date}T00:00:00`))}{" "}
              · {movement.account}
            </Paragraph>
            {movement.note ? (
              <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>
                {movement.note}
              </Paragraph>
            ) : null}
          </YStack>
        </XStack>
        <YStack items="flex-end" gap="$1">
          <Paragraph
            color={isStrandedTransfer ? "$color11" : isIncome ? "$green10" : "$red10"}
            fontSize="$3"
            fontWeight="600"
          >
            {formatSensitiveAmount(movement.amount, movement.currency)}
          </Paragraph>
          {isPayment && movement.paymentOccurrencePaymentId ? (
            <Button chromeless size="$2" onPress={onReverse}>
              {t("movementUx.reversePayment")}
            </Button>
          ) : isStrandedTransfer ? null : (
            <Button
              chromeless
              circular
              size="$2"
              icon={<Trash2 size={14} color="$color8" />}
              onPress={onDelete}
              aria-label={t("movementUx.deleteTitle")}
            />
          )}
        </YStack>
      </XStack>
    </FintCard>
    </SwipeableRow>
  );
}

function TransferMovementCard({
  item,
  locale,
  onReverse,
}: {
  item: Extract<MovementListItem, { kind: "transfer" }>;
  locale: string;
  onReverse: () => void;
}) {
  const { t } = useTranslation();
  const { formatSensitiveAmount } = useSensitiveMoney();
  return (
    <SwipeableRow
      onAction={onReverse}
      actionColor="$yellow9"
      actionIcon={<RotateCcw size={20} color="white" />}
      actionLabel={t("movementUx.reverseTransfer")}
    >
    <FintCard py="$3">
      <XStack items="center" gap="$3">
        <YStack
          width={42}
          height={42}
          rounded="$8"
          bg="$accent2"
          items="center"
          justify="center"
        >
          <ArrowLeftRight size={20} color="$primary" />
        </YStack>
        <YStack flex={1} minW={0} gap="$1">
          <Paragraph
            color="$color12"
            fontSize="$3"
            fontWeight="600"
            numberOfLines={2}
          >
            {t("movementUx.transferCardTitle", {
              origin: item.origin.account,
              destination: item.destination.account,
            })}
          </Paragraph>
          <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>
            {new Intl.DateTimeFormat(locale, {
              day: "2-digit",
              month: "short",
            }).format(new Date(`${item.date}T00:00:00`))}
          </Paragraph>
        </YStack>
        <YStack items="flex-end" gap="$1">
          <Paragraph color="$color11" fontSize="$3" fontWeight="600">
            {formatSensitiveAmount(item.amount, item.currency)}
          </Paragraph>
          <Button chromeless size="$2" onPress={onReverse}>
            {t("movementUx.reverseTransfer")}
          </Button>
        </YStack>
      </XStack>
    </FintCard>
    </SwipeableRow>
  );
}

function ReverseTransferDialog({
  isPending,
  onCancel,
  onConfirm,
  open,
}: {
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}) {
  const { t } = useTranslation();
  return (
    <FintConfirmDialog
      open={open}
      isPending={isPending}
      title={t("movementUx.reverseTransfer")}
      description={t("movementUx.reverseTransferDescription")}
      cancelLabel={t("actions.cancel")}
      confirmLabel={t("movementUx.reverseTransfer")}
      pendingLabel={t("movementUx.reversing")}
      destructive
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function ReversePaymentDialog({
  isPending,
  movement,
  onCancel,
  onConfirm,
}: {
  isPending: boolean;
  movement: Transaction | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <FintConfirmDialog
      open={Boolean(movement)}
      isPending={isPending}
      title={t("movementUx.reversePayment")}
      description={t("movementUx.reversePaymentDescription")}
      cancelLabel={t("actions.cancel")}
      confirmLabel={t("movementUx.reversePayment")}
      pendingLabel={t("movementUx.reversing")}
      destructive
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function DeleteMovementDialog({
  isPending,
  movement,
  onCancel,
  onConfirm,
}: {
  isPending: boolean;
  movement: Transaction | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <FintConfirmDialog
      open={Boolean(movement)}
      isPending={isPending}
      title={t("movementUx.deleteTitle")}
      description={t("movementUx.deleteDescription", {
        name: movement ? getCategoryLabel(movement.category, t) : "",
      })}
      cancelLabel={t("actions.cancel")}
      confirmLabel={t("movementUx.deleteConfirm")}
      pendingLabel={t("movementUx.deleting")}
      destructive
      icon={<Trash2 size={17} color="$primaryForeground" />}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function MovementHero({
  currency,
  expenses,
  income,
}: {
  currency: string;
  expenses: number;
  income: number;
}) {
  const { t } = useTranslation();
  const { formatSensitiveAmount, formatSensitiveAmountOnly } =
    useSensitiveMoney();
  return (
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
            {t("movementUx.monthFlow")}
          </Paragraph>
          <XStack items="baseline" gap="$2" mt="$2">
            <Paragraph color="$heroMuted" fontSize="$3" fontWeight="500">
              {currency}
            </Paragraph>
            <Paragraph
              color="$heroForeground"
              fontFamily="$body"
              fontSize={40}
              fontWeight="600"
              letterSpacing={-1.2}
              lineHeight={44}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatSensitiveAmountOnly(income - expenses)}
            </Paragraph>
          </XStack>
        </YStack>
        <SensitiveAmountToggle color="$heroAccent" inverse />
      </XStack>

      <YStack height={1} bg="rgba(246,251,252,0.13)" />

      <XStack gap="$5">
        <HeroMetric
          tone="positive"
          label={t("dashboard.totalIncome")}
          value={formatSensitiveAmount(income, currency)}
        />
        <YStack width={1} bg="rgba(246,251,252,0.13)" />
        <HeroMetric
          tone="negative"
          label={t("dashboard.totalExpenses")}
          value={formatSensitiveAmount(expenses, currency)}
        />
      </XStack>
    </YStack>
  );
}

function HeroMetric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "positive" | "negative";
  value: string;
}) {
  const Icon = tone === "positive" ? ArrowUp : ArrowDown;
  return (
    <YStack flex={1} minW={0} gap="$1.5">
      <XStack items="center" gap="$1.5">
        <Icon
          size={13}
          color={tone === "positive" ? "#8FD9BC" : "#E9A99F"}
          strokeWidth={2.2}
        />
        <Paragraph color="$heroMuted" fontSize="$1">
          {label}
        </Paragraph>
      </XStack>
      <Paragraph
        color="$heroForeground"
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
