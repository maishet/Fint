import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CalendarClock,
  Check,
  Mail,
  Pencil,
  Shapes,
  Trash2,
} from "@tamagui/lucide-icons-2";
import { useToastController } from "@tamagui/toast";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Paragraph, XStack, YStack } from "tamagui";
import { financeApi } from "../src/api/finance";
import { supabase } from "../src/auth/supabase";
import { formatMoney } from "../src/api/mappers";
import type {
  ConfirmPendingInput,
  PendingMovementCard,
} from "../src/api/types";
import { CategoryPickerSheet } from "../src/components/CategoryPickerSheet";
import { DataStateCard } from "../src/components/DataStateCard";
import { MovementPickerTrigger } from "../src/components/MovementFormControls";
import { SkeletonGroup, SkeletonList } from "../src/components/Skeleton";
import { getValidationMessage } from "../src/forms";
import {
  FintButton,
  FintCard,
  FintConfirmDialog,
  FintFormField,
  FintSheetSelect,
  FintSpinner,
} from "../src/ui";
import { getInstallationId } from "../src/notifications/pushNotifications";
import { useCapabilities } from "../src/api/capabilities";

const PAGE_SIZE = 20;
const NORMAL_MOVEMENT = "__transaction__";

export default function PendingMovementsScreen() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const toast = useToastController();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [paymentOccurrenceId, setPaymentOccurrenceId] =
    useState(NORMAL_MOVEMENT);
  const [categoryError, setCategoryError] = useState<string | undefined>();
  const [discardTarget, setDiscardTarget] =
    useState<PendingMovementCard | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDiscard, setConfirmBulkDiscard] = useState(false);
  const { capabilities } = useCapabilities();

  const pendingQuery = useInfiniteQuery({
    queryKey: ["pending-movements", "pages"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      financeApi.listPendingMovements(
        { limit: PAGE_SIZE, cursor: pageParam },
        signal,
      ),
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
    retry: false,
  });
  const items = pendingQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const expandedItem = items.find((item) => item.id === expandedId) ?? null;
  const categoriesQuery = useQuery({
    queryKey: ["categories", expandedItem?.type],
    queryFn: () => financeApi.listCategories(expandedItem?.type ?? undefined),
    enabled: Boolean(expandedItem?.accountSuggestion && expandedItem.type),
    retry: false,
  });
  const occurrencesQuery = useQuery({
    queryKey: ["payment-occurrences", "open"],
    queryFn: ({ signal }) =>
      financeApi.listPaymentOccurrences({ status: "open" }, signal),
    retry: false,
  });

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      channel = supabase
        .channel(`pending-movements-list-${data.user.id}`)
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

  const confirmMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConfirmPendingInput }) =>
      financeApi.confirmPendingMovement(id, input),
    onSuccess: async () => {
      setExpandedId(null);
      setCategory("");
      setPaymentOccurrenceId(NORMAL_MOVEMENT);
      await invalidatePendingAndFinance(queryClient);
      toast.show(t("movements.createdToast"), {
        message: t("movements.createdMessage"),
        preset: "success",
      });
    },
    onError: (error) =>
      toast.show(t("movementUx.pendingConfirmError"), {
        message: error instanceof Error ? error.message : undefined,
        preset: "error",
      }),
  });
  const discardMutation = useMutation({
    mutationFn: (id: string) => financeApi.discardPendingMovement(id),
    onSuccess: async () => {
      setExpandedId(null);
      setDiscardTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["pending-movements", "pages"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["pending-movements", "summary"],
        }),
      ]);
      toast.show(t("movementUx.pendingDiscarded"), { preset: "success" });
    },
    onError: (error) =>
      toast.show(t("movementUx.pendingDiscardError"), {
        message: error instanceof Error ? error.message : undefined,
        preset: "error",
      }),
  });
  const bulkDiscardMutation = useMutation({
    mutationFn: (ids: string[]) => financeApi.discardPendingMovementsBulk(ids),
    onSuccess: async () => {
      setConfirmBulkDiscard(false);
      setSelectionMode(false);
      setSelectedIds(new Set());
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["pending-movements", "pages"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["pending-movements", "summary"],
        }),
      ]);
      toast.show(t("movementUx.bulkDiscarded"), { preset: "success" });
    },
    onError: (error) => {
      setConfirmBulkDiscard(false);
      toast.show(t("movementUx.bulkDiscardError"), {
        message: error instanceof Error ? error.message : undefined,
        preset: "error",
      });
    },
  });

  const openItem = (item: PendingMovementCard) => {
    setExpandedId((current) => (current === item.id ? null : item.id));
    setCategory("");
    setPaymentOccurrenceId(NORMAL_MOVEMENT);
    setCategoryError(undefined);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterSelectionMode = (initialId?: string) => {
    setExpandedId(null);
    setSelectionMode(true);
    setSelectedIds(initialId ? new Set([initialId]) : new Set());
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    setSelectedIds((current) =>
      current.size === items.length
        ? new Set()
        : new Set(items.map((item) => item.id)),
    );
  };

  const confirm = async (item: PendingMovementCard) => {
    if (
      !item.accountSuggestion ||
      !item.type ||
      item.amount === null ||
      !item.currency ||
      item.requiresReview
    ) {
      router.push({ pathname: "/pending-review", params: { id: item.id } });
      return;
    }
    const selectedOccurrence = capabilities.features.pendingToPayment
      ? occurrencesQuery.data?.find(
          (occurrence) => occurrence.id === paymentOccurrenceId,
        )
      : undefined;
    if (selectedOccurrence) {
      confirmMutation.mutate({
        id: item.id,
        input: {
          mode: "payment",
          paymentOccurrenceId: selectedOccurrence.id,
          title: item.title,
          type: "expense",
          amount: item.amount,
          currency: item.currency,
          transactionDate: item.detectedAt.slice(0, 10),
          accountId: item.accountSuggestion.id,
          categoryId: null,
          note: item.title,
          originInstallationId: await getInstallationId(),
        },
      });
      return;
    }
    const selectedCategory = categoriesQuery.data?.find(
      (candidate) => candidate.name === category,
    );
    if (!selectedCategory) {
      setCategoryError(
        getValidationMessage(t, i18n.resolvedLanguage, "required"),
      );
      return;
    }
    confirmMutation.mutate({
      id: item.id,
      input: {
        mode: "transaction",
        title: item.title,
        type: item.type,
        amount: item.amount,
        currency: item.currency,
        transactionDate: item.detectedAt.slice(0, 10),
        accountId: item.accountSuggestion.id,
        categoryId: selectedCategory.id,
        note: item.title,
      },
    });
  };

  return (
    <YStack flex={1} bg="$background">
      <Stack.Screen options={{ title: t("movementUx.pendingTitle") }} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: Math.max(
            insets.bottom,
            selectionMode ? 96 : 24,
          ),
          flexGrow: items.length ? undefined : 1,
        }}
        ItemSeparatorComponent={() => <YStack height={8} />}
        ListHeaderComponent={
          <FintCard bg="$accent1" borderColor="$accent4" mb="$4">
            <XStack items="center" gap="$3">
              <YStack
                width={42}
                height={42}
                rounded="$10"
                bg="$accent3"
                items="center"
                justify="center"
              >
                <Mail size={20} color="$primary" />
              </YStack>
              <YStack flex={1} gap="$1">
                <Paragraph
                  color="$color12"
                  fontFamily="$heading"
                  fontSize="$4"
                  fontWeight="800"
                >
                  {t("movementUx.pendingTitle")}
                </Paragraph>
                <Paragraph color="$color10" fontSize="$2">
                  {t("movementUx.pendingReviewHint")}
                </Paragraph>
              </YStack>
            </XStack>
            {items.length ? (
              <XStack items="center" justify="space-between" mt="$3">
                {selectionMode ? (
                  <Button size="$2" chromeless onPress={toggleSelectAll}>
                    {t("movementUx.selectedCount", {
                      count: selectedIds.size,
                    })}
                  </Button>
                ) : (
                  <YStack />
                )}
                <Button
                  size="$2"
                  chromeless
                  color="$primary"
                  onPress={() =>
                    selectionMode ? exitSelectionMode() : enterSelectionMode()
                  }
                >
                  {selectionMode
                    ? t("movementUx.cancelSelection")
                    : t("movementUx.selectMode")}
                </Button>
              </XStack>
            ) : null}
          </FintCard>
        }
        refreshControl={
          <RefreshControl
            refreshing={
              pendingQuery.isRefetching && !pendingQuery.isFetchingNextPage
            }
            onRefresh={() => {
              void pendingQuery.refetch();
            }}
          />
        }
        onEndReached={() => {
          if (pendingQuery.hasNextPage && !pendingQuery.isFetchingNextPage)
            void pendingQuery.fetchNextPage();
        }}
        onEndReachedThreshold={0.35}
        ListEmptyComponent={
          pendingQuery.isLoading ? (
            <SkeletonGroup label={t("states.loading")}>
              <SkeletonList rows={4} />
            </SkeletonGroup>
          ) : pendingQuery.error ? (
            <DataStateCard
              message={t("movementUx.pendingError")}
              onRetry={() => {
                void pendingQuery.refetch();
              }}
            />
          ) : (
            <DataStateCard message={t("movementUx.noPending")} />
          )
        }
        ListFooterComponent={
          pendingQuery.isFetchingNextPage ? (
            <YStack py="$4" items="center">
              <FintSpinner color="$primary" />
            </YStack>
          ) : null
        }
        renderItem={({ item }) => (
          <PendingCard
            item={item}
            expanded={expandedId === item.id}
            selectionMode={selectionMode}
            selected={selectedIds.has(item.id)}
            category={expandedId === item.id ? category : ""}
            categoryError={expandedId === item.id ? categoryError : undefined}
            categories={
              expandedId === item.id ? (categoriesQuery.data ?? []) : []
            }
            paymentOccurrenceId={
              expandedId === item.id ? paymentOccurrenceId : NORMAL_MOVEMENT
            }
            paymentOccurrences={
              expandedId === item.id && capabilities.features.pendingToPayment
                ? compatibleOccurrences(occurrencesQuery.data ?? [], item)
                : []
            }
            referencesLoading={
              expandedId === item.id && categoriesQuery.isLoading
            }
            isPending={
              (confirmMutation.isPending &&
                confirmMutation.variables?.id === item.id) ||
              (discardMutation.isPending &&
                discardMutation.variables === item.id)
            }
            onToggle={() =>
              selectionMode ? toggleSelection(item.id) : openItem(item)
            }
            onLongPress={() =>
              selectionMode ? undefined : enterSelectionMode(item.id)
            }
            onCategoryChange={(value) => {
              setCategory(value);
              setCategoryError(undefined);
            }}
            onPaymentOccurrenceChange={(value) => {
              setPaymentOccurrenceId(value);
              setCategoryError(undefined);
            }}
            onConfirm={() => confirm(item)}
            onDiscard={() => setDiscardTarget(item)}
            onEdit={() =>
              capabilities.features.editablePendingMovements
                ? router.push({
                    pathname: "/pending-review",
                    params: { id: item.id },
                  })
                : undefined
            }
          />
        )}
      />
      {selectionMode && selectedIds.size > 0 ? (
        <XStack
          position="absolute"
          l={0}
          r={0}
          b={0}
          p="$3"
          pb={Math.max(insets.bottom, 12)}
          bg="$background"
          borderTopWidth={1}
          borderColor="$borderColor"
        >
          <FintButton
            width="100%"
            minH={48}
            color="$red10"
            borderColor="$red6"
            variant="outlined"
            icon={<Trash2 size={17} />}
            onPress={() => setConfirmBulkDiscard(true)}
          >
            {t("movementUx.discardSelected", { count: selectedIds.size })}
          </FintButton>
        </XStack>
      ) : null}
      <DiscardPendingDialog
        item={discardTarget}
        isPending={discardMutation.isPending}
        onCancel={() => setDiscardTarget(null)}
        onConfirm={() =>
          discardTarget && discardMutation.mutate(discardTarget.id)
        }
      />
      <FintConfirmDialog
        open={confirmBulkDiscard}
        isPending={bulkDiscardMutation.isPending}
        title={t("movementUx.discardSelectedTitle", {
          count: selectedIds.size,
        })}
        description={t("movementUx.discardSelectedDescription")}
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("movementUx.discardSelected", {
          count: selectedIds.size,
        })}
        destructive
        icon={<Trash2 size={17} color="$primaryForeground" />}
        onCancel={() => setConfirmBulkDiscard(false)}
        onConfirm={() => bulkDiscardMutation.mutate(Array.from(selectedIds))}
      />
    </YStack>
  );
}

async function invalidatePendingAndFinance(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["pending-movements"] }),
    queryClient.invalidateQueries({ queryKey: ["transactions"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["summary"] }),
    queryClient.invalidateQueries({ queryKey: ["accounts"] }),
    queryClient.invalidateQueries({ queryKey: ["reports"] }),
  ]);
}

function PendingCard({
  categories,
  category,
  categoryError,
  expanded,
  isPending,
  item,
  onCategoryChange,
  onConfirm,
  onDiscard,
  onEdit,
  onLongPress,
  onPaymentOccurrenceChange,
  onToggle,
  paymentOccurrenceId,
  paymentOccurrences,
  referencesLoading,
  selected,
  selectionMode,
}: {
  categories: Awaited<ReturnType<typeof financeApi.listCategories>>;
  category: string;
  categoryError?: string;
  expanded: boolean;
  isPending: boolean;
  item: PendingMovementCard;
  onCategoryChange: (value: string) => void;
  onConfirm: () => void;
  onDiscard: () => void;
  onEdit: () => void;
  onLongPress: () => void;
  onPaymentOccurrenceChange: (value: string) => void;
  onToggle: () => void;
  paymentOccurrenceId: string;
  paymentOccurrences: Awaited<
    ReturnType<typeof financeApi.listPaymentOccurrences>
  >;
  referencesLoading: boolean;
  selected: boolean;
  selectionMode: boolean;
}) {
  const { t, i18n } = useTranslation();
  const detectedDate = new Intl.DateTimeFormat(i18n.language, {
    day: "2-digit",
    month: "short",
  }).format(new Date(item.detectedAt));
  const canQuickConfirm = Boolean(
    item.accountSuggestion &&
    item.type &&
    item.amount !== null &&
    item.currency &&
    !item.requiresReview,
  );
  const typeLabel = item.type
    ? t(`forms.${item.type}`)
    : t("movementUx.reviewRequired");
  const amountLabel =
    item.amount !== null && item.currency
      ? `${item.type === "income" ? "+" : item.type === "expense" ? "-" : ""}${formatMoney(item.amount, item.currency)}`
      : t("movementUx.reviewRequired");
  const isPayment = paymentOccurrenceId !== NORMAL_MOVEMENT;
  return (
    <FintCard
      p="$3"
      gap="$3"
      opacity={isPending ? 0.65 : 1}
      borderColor={selected ? "$primary" : "$borderColor"}
      borderWidth={selected ? 2 : 1}
    >
      <XStack
        items="center"
        gap="$3"
        role="button"
        onPress={isPending ? undefined : onToggle}
        onLongPress={isPending ? undefined : onLongPress}
      >
        {selectionMode ? (
          <YStack
            width={22}
            height={22}
            rounded="$10"
            borderWidth={2}
            borderColor={selected ? "$primary" : "$borderColor"}
            bg={selected ? "$primary" : "transparent"}
            items="center"
            justify="center"
          >
            {selected ? <Check size={14} color="$primaryForeground" /> : null}
          </YStack>
        ) : (
          <Mail size={18} color="$primary" />
        )}
        <YStack flex={1} minW={0} gap="$1">
          <Paragraph color="$color12" fontWeight="800" numberOfLines={2}>
            {item.title}
          </Paragraph>
          <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>
            {typeLabel} · {detectedDate}
            {item.accountSuggestion ? ` · ${item.accountSuggestion.name}` : ""}
          </Paragraph>
        </YStack>
        <Paragraph
          color={
            item.type === "income"
              ? "$green10"
              : item.type === "expense"
                ? "$red10"
                : "$yellow10"
          }
          fontWeight="900"
        >
          {amountLabel}
        </Paragraph>
      </XStack>
      {expanded && !selectionMode ? (
        <YStack gap="$3">
          {canQuickConfirm && item.type ? (
            <>
              {referencesLoading ? (
                <SkeletonGroup label={t("states.loading")}>
                  <SkeletonList rows={1} />
                </SkeletonGroup>
              ) : null}
              {item.type === "expense" && paymentOccurrences.length ? (
                <FintFormField
                  label={t("movementUx.applyToPayment")}
                  showLabel={false}
                >
                  <FintSheetSelect
                    label={t("movementUx.applyToPayment")}
                    showLabel={false}
                    placeholder={t("movementUx.normalMovement")}
                    value={paymentOccurrenceId}
                    onValueChange={onPaymentOccurrenceChange}
                    options={[
                      {
                        value: NORMAL_MOVEMENT,
                        label: t("movementUx.normalMovement"),
                      },
                      ...paymentOccurrences.map((occurrence) => ({
                        value: occurrence.id,
                        label: `${occurrence.title} · ${formatMoney(occurrence.remainingAmount ?? 0, occurrence.currency)}`,
                      })),
                    ]}
                    renderTrigger={({ onPress, selectedLabel }) => (
                      <MovementPickerTrigger
                        icon={<CalendarClock size={20} color="$primary" />}
                        label={t("movementUx.applyToPayment")}
                        onPress={onPress}
                        value={selectedLabel}
                      />
                    )}
                  />
                </FintFormField>
              ) : null}
              {!referencesLoading && !isPayment ? (
                <FintFormField
                  label={t("forms.category")}
                  required
                  error={categoryError}
                  showLabel={false}
                >
                  <CategoryPickerSheet
                    categories={categories}
                    type={item.type}
                    value={category}
                    showLabel={false}
                    onValueChange={onCategoryChange}
                    renderTrigger={({ onPress, selectedLabel }) => (
                      <MovementPickerTrigger
                        icon={<Shapes size={20} color="$primary" />}
                        invalid={Boolean(categoryError)}
                        label={t("forms.category")}
                        required
                        onPress={onPress}
                        value={selectedLabel}
                      />
                    )}
                  />
                </FintFormField>
              ) : null}
              {isPayment ? (
                <Paragraph color="$color10" fontSize="$1">
                  {t("movementUx.paymentAppliedHint")}
                </Paragraph>
              ) : null}
            </>
          ) : (
            <YStack bg="$muted" rounded="$5" p="$3" gap="$2">
              <Paragraph color="$color12" fontWeight="700">
                {t("movementUx.reviewRequired")}
              </Paragraph>
              <Paragraph color="$color10" fontSize="$2">
                {t("movementUx.pendingNeedsEdit")}
              </Paragraph>
            </YStack>
          )}
          <YStack gap="$2">
            {canQuickConfirm ? (
              <FintButton
                width="100%"
                minH={48}
                disabled={isPending || referencesLoading}
                icon={<Check size={17} />}
                onPress={onConfirm}
              >
                {t("movementUx.confirmPending")}
              </FintButton>
            ) : null}
            <FintButton
              width="100%"
              minH={46}
              variant={canQuickConfirm ? "outlined" : "solid"}
              disabled={isPending}
              icon={<Pencil size={16} />}
              onPress={onEdit}
            >
              {t("actions.edit")}
            </FintButton>
            <FintButton
              width="100%"
              minH={46}
              variant="outlined"
              color="$red10"
              borderColor="$red6"
              disabled={isPending}
              icon={<Trash2 size={16} />}
              onPress={onDiscard}
            >
              {t("movementUx.discardShort")}
            </FintButton>
          </YStack>
        </YStack>
      ) : null}
    </FintCard>
  );
}

function compatibleOccurrences(
  occurrences: Awaited<ReturnType<typeof financeApi.listPaymentOccurrences>>,
  item: PendingMovementCard,
) {
  if (item.type !== "expense" || item.amount === null || !item.currency)
    return [];
  return occurrences.filter(
    (occurrence) =>
      occurrence.currency === item.currency &&
      occurrence.amountStatus === "confirmed" &&
      (occurrence.remainingAmount ?? 0) >= item.amount!,
  );
}

function DiscardPendingDialog({
  isPending,
  item,
  onCancel,
  onConfirm,
}: {
  isPending: boolean;
  item: PendingMovementCard | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <FintConfirmDialog
      open={Boolean(item)}
      isPending={isPending}
      title={t("movementUx.discardPendingTitle")}
      description={t("movementUx.discardPendingDescription")}
      cancelLabel={t("actions.cancel")}
      confirmLabel={t("movementUx.discardPending")}
      destructive
      icon={<Trash2 size={17} color="$primaryForeground" />}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
