import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  HandCoins,
  Landmark,
  Plus,
  Trash2,
} from "@tamagui/lucide-icons-2";
import { useNotify } from "../../src/ui/notify";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Paragraph, XStack, YStack } from "tamagui";
import { financeApi } from "../../src/api/finance";
import { formatMoney } from "../../src/api/mappers";
import type { PaymentOccurrence } from "../../src/api/types";
import { DataStateCard } from "../../src/components/DataStateCard";
import { OccurrencePaymentSheet } from "../../src/components/OccurrencePaymentSheet";
import { Screen } from "../../src/components/Screen";
import { SwipeableRow } from "../../src/components/SwipeableRow";
import {
  SkeletonGroup,
  SkeletonBlock,
  SkeletonList,
} from "../../src/components/Skeleton";
import { getCurrencySymbol } from "../../src/finance/currencies";
import { formatDateString, parseDateString } from "../../src/finance/dates";
import { getDueState } from "../../src/finance/dueState";
import { usePressOnce } from "../../src/hooks/usePressOnce";
import {
  FintButton,
  FintCard,
  FintConfirmDialog,
  FintSpinner,
} from "../../src/ui";
import { getAppLocale } from "../../src/i18n";
import { useCapabilities } from "../../src/api/capabilities";
import { useSensitiveMoney } from "../../src/privacy/useSensitiveMoney";
import { SensitiveAmountToggle } from "../../src/privacy/SensitiveAmountToggle";

type PaymentsTab = "pending" | "history";

type PendingItem =
  | { kind: "single"; occurrence: PaymentOccurrence }
  | { kind: "group"; ruleId: string; periods: PaymentOccurrence[] };

function pendingItemDueDate(item: PendingItem): string | null {
  return item.kind === "group" ? item.periods[0].dueDate : item.occurrence.dueDate;
}

function buildPendingItems(occurrences: PaymentOccurrence[]): PendingItem[] {
  const byRule = new Map<string, PaymentOccurrence[]>();
  const standalone: PaymentOccurrence[] = [];
  for (const occurrence of occurrences) {
    if (!occurrence.ruleId) {
      standalone.push(occurrence);
      continue;
    }
    const list = byRule.get(occurrence.ruleId) ?? [];
    list.push(occurrence);
    byRule.set(occurrence.ruleId, list);
  }
  const items: PendingItem[] = [];
  for (const [ruleId, periods] of byRule) {
    const sorted = [...periods].sort((a, b) =>
      String(a.dueDate).localeCompare(String(b.dueDate)),
    );
    items.push(
      sorted.length > 1
        ? { kind: "group", ruleId, periods: sorted }
        : { kind: "single", occurrence: sorted[0] },
    );
  }
  for (const occurrence of standalone) items.push({ kind: "single", occurrence });
  return items.sort((a, b) => {
    const dueA = pendingItemDueDate(a);
    const dueB = pendingItemDueDate(b);
    if (!dueA) return 1;
    if (!dueB) return -1;
    return dueA.localeCompare(dueB);
  });
}

type HistoryGroup = { key: string; label: string; items: PaymentOccurrence[] };

function groupHistory(occurrences: PaymentOccurrence[], locale: string): HistoryGroup[] {
  const sorted = [...occurrences].sort((a, b) => {
    const dateA = a.paidAt ?? a.dueDate ?? "";
    const dateB = b.paidAt ?? b.dueDate ?? "";
    return dateB.localeCompare(dateA);
  });
  const groups: HistoryGroup[] = [];
  for (const occurrence of sorted) {
    const date = parseDateString(occurrence.paidAt ?? occurrence.dueDate);
    const key = date ? `${date.getFullYear()}-${date.getMonth()}` : "unknown";
    let group = groups.find((item) => item.key === key);
    if (!group) {
      const rawLabel = date
        ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date)
        : "";
      group = {
        key,
        label: rawLabel ? rawLabel.charAt(0).toLocaleUpperCase(locale) + rawLabel.slice(1) : "",
        items: [],
      };
      groups.push(group);
    }
    group.items.push(occurrence);
  }
  return groups;
}

export default function DebtsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useNotify();
  const { capabilities } = useCapabilities();
  const [tab, setTab] = useState<PaymentsTab>("pending");
  const [paymentOccurrence, setPaymentOccurrence] =
    useState<PaymentOccurrence | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentOccurrence | null>(
    null,
  );
  const pressOnce = usePressOnce();
  const locale = getAppLocale(i18n.resolvedLanguage);

  const occurrencesQuery = useQuery({
    queryKey: ["payment-occurrences", "open"],
    queryFn: ({ signal }) =>
      financeApi.listPaymentOccurrences({ status: "open" }, signal),
  });
  const historyQuery = useQuery({
    queryKey: ["payment-occurrences", "paid"],
    queryFn: ({ signal }) =>
      financeApi.listPaymentOccurrences({ status: "paid" }, signal),
    enabled: tab === "history",
  });
  const accountsQuery = useQuery({
    queryKey: [
      "account-options",
      "occurrence-payment",
      paymentOccurrence?.currency,
    ],
    queryFn: () =>
      financeApi.listAccountOptions({
        currency: paymentOccurrence?.currency,
        excludeAccountType: "credit_card",
      }),    enabled: Boolean(paymentOccurrence),
  });

  const occurrences = occurrencesQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];
  const pendingItems = useMemo(() => buildPendingItems(occurrences), [occurrences]);
  const displayCurrency = occurrences[0]?.currency ?? "PEN";
  const totalOutstanding = occurrences
    .filter((item) => item.currency === displayCurrency)
    .reduce((sum, item) => sum + (item.remainingAmount ?? 0), 0);
  const nextDueDebt = [...occurrences]
    .filter((item) => item.dueDate)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0];
  const isLoading = occurrencesQuery.isLoading;
  const isRefreshing = occurrencesQuery.isRefetching;
  const error = occurrencesQuery.error;

  const history = historyQuery.data ?? [];
  const historyGroups = useMemo(() => groupHistory(history, locale), [history, locale]);
  const sortedHistory = useMemo(
    () =>
      [...history].sort((a, b) =>
        (b.paidAt ?? b.dueDate ?? "").localeCompare(a.paidAt ?? a.dueDate ?? ""),
      ),
    [history],
  );
  const historyDisplayCurrency = history[0]?.currency ?? "PEN";
  const now = new Date();
  const paidThisMonthTotal = history
    .filter((item) => {
      if (item.currency !== historyDisplayCurrency) return false;
      const paidDate = parseDateString(item.paidAt);
      return (
        paidDate !== null &&
        paidDate.getFullYear() === now.getFullYear() &&
        paidDate.getMonth() === now.getMonth()
      );
    })
    .reduce((sum, item) => sum + (item.totalAmount ?? item.paidAmount ?? 0), 0);
  const historyLoading = historyQuery.isLoading;
  const historyError = historyQuery.error;

  const activeLoading = tab === "pending" ? isLoading : historyLoading;
  const activeError = tab === "pending" ? error : historyError;

  const openCreate = () =>
    pressOnce(() =>
      capabilities.features.recurringPayments
        ? router.push("/debt-form")
        : toast.show(t("payments.disabled"), { preset: "error" }),
    );
  const deleteMutation = useMutation({
    mutationFn: financeApi.deletePaymentRule,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payment-rules"] }),
        queryClient.invalidateQueries({ queryKey: ["payment-occurrences"] }),
        queryClient.invalidateQueries({ queryKey: ["summary"] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
      setDeleteTarget(null);
      toast.show(t("payments.deletedToast"), {
        message: t("payments.deletedMessage"),
        preset: "success",
      });
    },
    onError: () => toast.show(t("payments.deleteError"), { preset: "error" }),
  });
  return (
    <>
      <Screen
        isRefreshing={isRefreshing}
        onRefresh={() => {
          void occurrencesQuery.refetch();
          if (tab === "history") void historyQuery.refetch();
        }}
        ground={
          !activeLoading && !activeError ? (
            tab === "pending" ? (
              <DebtHero
                count={pendingItems.length}
                currency={displayCurrency}
                nextDueDate={nextDueDebt?.dueDate ?? null}
                total={totalOutstanding}
              />
            ) : (
              <HistoryHero
                count={sortedHistory.length}
                currency={historyDisplayCurrency}
                lastPaidAt={sortedHistory[0]?.paidAt ?? null}
                total={paidThisMonthTotal}
              />
            )
          ) : (
            <YStack gap="$2">
              <SkeletonBlock height={14} width="42%" opacity={0.5} />
              <SkeletonBlock height={40} width="70%" opacity={0.5} />
            </YStack>
          )
        }
      >
        <PaymentsTabs active={tab} onChange={setTab} />

        <XStack items="center" justify="space-between" gap="$3">
          <YStack gap="$1" flex={1}>
            <Paragraph
              color="$color12"
              fontFamily="$heading"
              fontSize="$6"
              fontWeight="600"
            >
              {tab === "pending" ? t("payments.upcoming") : t("payments.historyTitle")}
            </Paragraph>
            {tab === "pending" && !isLoading ? (
              <Paragraph color="$color10" fontSize="$2">
                {t("payments.count", { count: pendingItems.length })}
              </Paragraph>
            ) : null}
            {tab === "history" && !historyLoading ? (
              <Paragraph color="$color10" fontSize="$2">
                {t("payments.count", { count: sortedHistory.length })}
              </Paragraph>
            ) : null}
          </YStack>
          {tab === "pending" && capabilities.features.recurringPayments ? (
            <Button
              circular
              bg="$primary"
              icon={<Plus size={22} color="$primaryForeground" />}
              onPress={openCreate}
              aria-label={t("payments.newRecurring")}
            />
          ) : null}
        </XStack>

        {activeLoading ? (
          <SkeletonGroup label={t("states.loading")}>
            <SkeletonList rows={3} />
          </SkeletonGroup>
        ) : null}
        {activeError ? (
          <DataStateCard
            message={activeError instanceof Error ? activeError.message : t("states.error")}
            onRetry={() => {
              if (tab === "pending") void occurrencesQuery.refetch();
              else void historyQuery.refetch();
            }}
          />
        ) : null}

        {tab === "pending" && !isLoading && !error && pendingItems.length === 0 ? (
          <FintCard items="center" gap="$3" py="$6">
            <YStack
              width={54}
              height={54}
              rounded="$10"
              bg="$secondary"
              items="center"
              justify="center"
            >
              <HandCoins size={26} color="$primary" />
            </YStack>
            <Paragraph
              color="$color12"
              fontFamily="$heading"
              fontSize="$5"
              fontWeight="600"
            >
              {t("payments.emptyTitle")}
            </Paragraph>
            <Paragraph color="$color10" text="center" maxW={280}>
              {t("payments.emptyDescription")}
            </Paragraph>
            {capabilities.features.recurringPayments ? (
              <FintButton icon={<Plus size={16} />} onPress={openCreate}>
                {t("payments.newRecurring")}
              </FintButton>
            ) : null}
          </FintCard>
        ) : null}

        {tab === "pending" && !isLoading && !error
          ? pendingItems.map((item) =>
              item.kind === "group" ? (
                <OccurrenceGroupCard
                  key={item.ruleId}
                  periods={item.periods}
                  isDeleting={
                    deleteMutation.isPending && deleteTarget?.ruleId === item.ruleId
                  }
                  locale={locale}
                  onDelete={() => setDeleteTarget(item.periods[0])}
                  onEdit={() =>
                    router.push({
                      pathname: "/debt-form",
                      params: { ruleId: item.ruleId },
                    })
                  }
                  onPayPeriod={(occurrence) => setPaymentOccurrence(occurrence)}
                />
              ) : (
                <OccurrenceCard
                  key={item.occurrence.id}
                  occurrence={item.occurrence}
                  isDeleting={
                    deleteMutation.isPending &&
                    deleteTarget?.ruleId === item.occurrence.ruleId
                  }
                  locale={locale}
                  onDelete={() => setDeleteTarget(item.occurrence)}
                  onEdit={() =>
                    item.occurrence.ruleId &&
                    router.push({
                      pathname: "/debt-form",
                      params: { ruleId: item.occurrence.ruleId },
                    })
                  }
                  onPay={() => setPaymentOccurrence(item.occurrence)}
                />
              ),
            )
          : null}

        {tab === "history" && !historyLoading && !historyError && sortedHistory.length === 0 ? (
          <FintCard items="center" gap="$3" py="$6">
            <YStack
              width={54}
              height={54}
              rounded="$10"
              bg="$secondary"
              items="center"
              justify="center"
            >
              <CheckCircle2 size={26} color="$primary" />
            </YStack>
            <Paragraph
              color="$color12"
              fontFamily="$heading"
              fontSize="$5"
              fontWeight="600"
            >
              {t("payments.historyEmptyTitle")}
            </Paragraph>
            <Paragraph color="$color10" text="center" maxW={280}>
              {t("payments.historyEmptyDescription")}
            </Paragraph>
          </FintCard>
        ) : null}

        {tab === "history" && !historyLoading && !historyError
          ? historyGroups.flatMap((group) => [
              <Paragraph
                key={`label-${group.key}`}
                color="$color10"
                fontSize="$2"
                fontWeight="600"
              >
                {group.label}
              </Paragraph>,
              ...group.items.map((occurrence) => (
                <HistoryRow key={occurrence.id} occurrence={occurrence} locale={locale} />
              )),
            ])
          : null}
      </Screen>

      <OccurrencePaymentSheet
        accounts={accounts}
        occurrence={paymentOccurrence}
        open={Boolean(paymentOccurrence)}
        onOpenChange={(open) => !open && setPaymentOccurrence(null)}
      />
      <DeletePaymentRuleDialog
        occurrence={deleteTarget}
        isPending={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteTarget?.ruleId && deleteMutation.mutate(deleteTarget.ruleId)
        }
      />
    </>
  );
}

function PaymentsTabs({
  active,
  onChange,
}: {
  active: PaymentsTab;
  onChange: (tab: PaymentsTab) => void;
}) {
  const { t } = useTranslation();
  return (
    <XStack bg="$secondary" rounded="$5" p="$1" gap="$1">
      <PaymentsTabButton
        active={active === "pending"}
        label={t("payments.tabPending")}
        onPress={() => onChange("pending")}
      />
      <PaymentsTabButton
        active={active === "history"}
        label={t("payments.tabHistory")}
        onPress={() => onChange("history")}
      />
    </XStack>
  );
}

function PaymentsTabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      flex={1}
      size="$3"
      bg={active ? "$card" : "transparent"}
      color={active ? "$color12" : "$primaryStrong"}
      fontWeight="600"
      rounded="$4"
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
    >
      {label}
    </Button>
  );
}

function OccurrenceCard({
  isDeleting,
  locale,
  occurrence,
  onDelete,
  onEdit,
  onPay,
}: {
  isDeleting: boolean;
  locale: string;
  occurrence: PaymentOccurrence;
  onDelete: () => void;
  onEdit: () => void;
  onPay: () => void;
}) {
  const { t } = useTranslation();
  const { formatSensitiveAmount } = useSensitiveMoney();
  const due = getDueState(occurrence.dueDate, locale, t);
  const amount = occurrence.totalAmount ?? occurrence.remainingAmount ?? 0;
  const isPaid = occurrence.paymentStatus === "paid";
  // Legacy credit_card items are read-only history; the app no longer supports paying them.
  const isLegacy = occurrence.kind === "credit_card";
  return (
    <SwipeableRow
      enabled={!isDeleting}
      onAction={onDelete}
      actionIcon={<Trash2 size={20} color="white" />}
      actionLabel={t("payments.deleteRecurring")}
    >
    <FintCard
      p="$3"
      gap="$3"
      onPress={onEdit}
      role="button"
      cursor="pointer"
      transition="quick"
      pressStyle={{ scale: 0.98, bg: "$secondary" }}
    >
      <XStack items="flex-start" gap="$3">
        <YStack
          width={42}
          height={42}
          rounded="$9"
          bg={due.overdue ? "$red2" : "$secondary"}
          items="center"
          justify="center"
        >
          <CalendarClock
            size={21}
            color={due.overdue ? "$red10" : "$primary"}
          />
        </YStack>
        <YStack flex={1} minW={0} gap="$1">
          <Paragraph
            color="$color12"
            fontFamily="$heading"
            fontSize="$4"
            fontWeight="600"
            numberOfLines={1}
          >
            {occurrence.title}
          </Paragraph>
          <Paragraph
            color={due.overdue ? "$red10" : "$color10"}
            fontSize="$1"
            fontWeight={due.overdue ? "700" : "500"}
          >
            {due.label}
          </Paragraph>
          {occurrence.autoPayEnabled && !isPaid ? (
            <XStack>
              <XStack
                bg="$secondary"
                rounded="$3"
                px="$2"
                py="$1"
                gap="$1"
                items="center"
              >
                <Landmark size={12} color="$primary" />
                <Paragraph color="$primary" fontSize="$1" fontWeight="600">
                  {t("payments.autoPayBadge")}
                </Paragraph>
              </XStack>
            </XStack>
          ) : null}
        </YStack>
        <YStack items="flex-end" gap="$1">
          <Paragraph color="$color12" fontSize="$4" fontWeight="600" shrink={0}>
            {formatSensitiveAmount(amount, occurrence.currency)}
          </Paragraph>
          <Paragraph color="$color10" fontSize="$1">
            {statusLabel(occurrence.paymentStatus, t)}
          </Paragraph>
          <XStack gap="$1">
            {!isLegacy ? (
              <Button
                circular
                chromeless
                size="$3"
                disabled={isPaid}
                icon={<CheckCircle2 size={19} color={isPaid ? "$color8" : "$primary"} />}
                onPress={(event) => {
                  event.stopPropagation();
                  onPay();
                }}
                aria-label={t("payments.registerPayment")}
              />
            ) : null}
            <Button
              circular
              chromeless
              size="$3"
              disabled={isDeleting}
              icon={
                isDeleting ? (
                  <FintSpinner size="small" color="$color8" />
                ) : (
                  <Trash2 size={16} color="$color8" />
                )
              }
              pressStyle={{ bg: "$color4" }}
              onPress={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              aria-label={t("payments.deleteRecurring")}
            />
          </XStack>
        </YStack>
      </XStack>
    </FintCard>
    </SwipeableRow>
  );
}

function OccurrenceGroupCard({
  isDeleting,
  locale,
  periods,
  onDelete,
  onEdit,
  onPayPeriod,
}: {
  isDeleting: boolean;
  locale: string;
  periods: PaymentOccurrence[];
  onDelete: () => void;
  onEdit: () => void;
  onPayPeriod: (occurrence: PaymentOccurrence) => void;
}) {
  const { t } = useTranslation();
  const { formatSensitiveAmount } = useSensitiveMoney();
  const oldest = periods[0];
  const due = getDueState(oldest.dueDate, locale, t);
  const amount = oldest.totalAmount ?? oldest.remainingAmount ?? 0;
  return (
    <SwipeableRow
      enabled={!isDeleting}
      onAction={onDelete}
      actionIcon={<Trash2 size={20} color="white" />}
      actionLabel={t("payments.deleteRecurring")}
    >
    <FintCard
      p="$3"
      gap="$3"
      onPress={onEdit}
      role="button"
      cursor="pointer"
      transition="quick"
      pressStyle={{ scale: 0.98, bg: "$secondary" }}
    >
      <XStack items="flex-start" gap="$3">
        <YStack
          width={42}
          height={42}
          rounded="$9"
          bg="$red2"
          items="center"
          justify="center"
        >
          <CalendarClock size={21} color="$red10" />
        </YStack>
        <YStack flex={1} minW={0} gap="$1">
          <Paragraph
            color="$color12"
            fontFamily="$heading"
            fontSize="$4"
            fontWeight="600"
            numberOfLines={1}
          >
            {oldest.title}
          </Paragraph>
          <Paragraph color="$red10" fontSize="$1" fontWeight="700">
            {due.label}
          </Paragraph>
          <XStack>
            <XStack bg="$red2" rounded="$3" px="$2" py="$1">
              <Paragraph color="$red10" fontSize="$1" fontWeight="700">
                {t("payments.periodsPending", { count: periods.length })}
              </Paragraph>
            </XStack>
          </XStack>
          <XStack gap="$3" mt="$1">
            {periods.map((period, index) => (
              <YStack
                key={period.id}
                items="center"
                gap="$0.5"
                role="button"
                pressStyle={{ opacity: 0.6 }}
                onPress={(event) => {
                  event.stopPropagation();
                  onPayPeriod(period);
                }}
                aria-label={t("payments.registerPayment")}
              >
                <YStack
                  width={9}
                  height={9}
                  rounded={999}
                  bg={index === 0 ? "$red9" : "$color6"}
                />
                <Paragraph
                  color={index === 0 ? "$red10" : "$color9"}
                  fontSize={9}
                  fontWeight="600"
                  textTransform="uppercase"
                >
                  {parseDateString(period.dueDate)
                    ? new Intl.DateTimeFormat(locale, { month: "short" }).format(
                        parseDateString(period.dueDate) as Date,
                      )
                    : ""}
                </Paragraph>
              </YStack>
            ))}
          </XStack>
        </YStack>
        <YStack items="flex-end" gap="$1">
          <Paragraph color="$color12" fontSize="$4" fontWeight="600" shrink={0}>
            {formatSensitiveAmount(amount, oldest.currency)}
          </Paragraph>
          <Paragraph color="$color10" fontSize="$1">
            {statusLabel(oldest.paymentStatus, t)}
          </Paragraph>
          <XStack gap="$1">
            <Button
              circular
              chromeless
              size="$3"
              icon={<CheckCircle2 size={19} color="$primary" />}
              onPress={(event) => {
                event.stopPropagation();
                onPayPeriod(oldest);
              }}
              aria-label={t("payments.registerPayment")}
            />
            <Button
              circular
              chromeless
              size="$3"
              disabled={isDeleting}
              icon={
                isDeleting ? (
                  <FintSpinner size="small" color="$color8" />
                ) : (
                  <Trash2 size={16} color="$color8" />
                )
              }
              pressStyle={{ bg: "$color4" }}
              onPress={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              aria-label={t("payments.deleteRecurring")}
            />
          </XStack>
        </YStack>
      </XStack>
    </FintCard>
    </SwipeableRow>
  );
}

function HistoryRow({
  locale,
  occurrence,
}: {
  locale: string;
  occurrence: PaymentOccurrence;
}) {
  const { t } = useTranslation();
  const { formatSensitiveAmount } = useSensitiveMoney();
  const amount = occurrence.totalAmount ?? occurrence.paidAmount;
  const dateLabel = occurrence.paidAt ? formatDateString(occurrence.paidAt, locale) : null;
  const subtitle = dateLabel
    ? occurrence.paidAccount
      ? t("payments.paidOnWithAccount", { date: dateLabel, account: occurrence.paidAccount })
      : t("payments.paidOn", { date: dateLabel })
    : t("payments.statusPaid");
  return (
    <FintCard p="$3">
      <XStack items="center" gap="$3">
        <YStack
          width={42}
          height={42}
          rounded="$9"
          bg="$green2"
          items="center"
          justify="center"
        >
          <CheckCircle2 size={20} color="$green10" />
        </YStack>
        <YStack flex={1} minW={0} gap="$1">
          <Paragraph color="$color12" fontSize="$3" fontWeight="600" numberOfLines={1}>
            {occurrence.title}
          </Paragraph>
          <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>
            {subtitle}
          </Paragraph>
        </YStack>
        <Paragraph color="$color12" fontSize="$3" fontWeight="600">
          {formatSensitiveAmount(amount, occurrence.currency)}
        </Paragraph>
      </XStack>
    </FintCard>
  );
}

function DeletePaymentRuleDialog({
  isPending,
  occurrence,
  onCancel,
  onConfirm,
}: {
  isPending: boolean;
  occurrence: PaymentOccurrence | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <FintConfirmDialog
      open={Boolean(occurrence)}
      isPending={isPending}
      title={t("payments.deleteRecurring")}
      description={t("payments.deleteDescription", {
        title: occurrence?.title ?? "",
      })}
      cancelLabel={t("actions.cancel")}
      confirmLabel={t("actions.delete")}
      pendingLabel={t("payments.deleting")}
      destructive
      icon={<Trash2 size={17} color="$primaryForeground" />}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function statusLabel(
  status: PaymentOccurrence["paymentStatus"],
  t: (key: string) => string,
) {
  // Fixed payments are binary: paid or pending. 'partial'/'minimum_met' only appear on
  // legacy credit_card occurrences kept for history.
  return status === "paid" ? t("payments.statusPaid") : t("payments.statusPending");
}

function DebtHero({
  count,
  currency,
  nextDueDate,
  total,
}: {
  count: number;
  currency: string;
  nextDueDate: string | null;
  total: number;
}) {
  const { t, i18n } = useTranslation();
  const { formatSensitiveAmountOnly } = useSensitiveMoney();
  const locale = getAppLocale(i18n.resolvedLanguage);
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
            {t("payments.totalPending")}
          </Paragraph>
          <XStack items="baseline" gap="$2" mt="$2">
            <Paragraph color="$heroMuted" fontSize="$3" fontWeight="500">
              {getCurrencySymbol(currency)}
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
              {formatSensitiveAmountOnly(total)}
            </Paragraph>
          </XStack>
        </YStack>
        <SensitiveAmountToggle color="$heroAccent" inverse />
      </XStack>

      <YStack height={1} bg="rgba(246,251,252,0.13)" />

      <XStack gap="$5">
        <HeroMetric
          label={t("payments.activePayments")}
          value={String(count)}
        />
        <YStack width={1} bg="rgba(246,251,252,0.13)" />
        <HeroMetric
          label={t("payments.nextDue")}
          value={
            nextDueDate
              ? formatDateString(nextDueDate, locale)
              : t("debts.noDueDate")
          }
        />
      </XStack>
    </YStack>
  );
}

function HistoryHero({
  count,
  currency,
  lastPaidAt,
  total,
}: {
  count: number;
  currency: string;
  lastPaidAt: string | null;
  total: number;
}) {
  const { t, i18n } = useTranslation();
  const { formatSensitiveAmountOnly } = useSensitiveMoney();
  const locale = getAppLocale(i18n.resolvedLanguage);
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
            {t("payments.paidThisMonth")}
          </Paragraph>
          <XStack items="baseline" gap="$2" mt="$2">
            <Paragraph color="$heroMuted" fontSize="$3" fontWeight="500">
              {getCurrencySymbol(currency)}
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
              {formatSensitiveAmountOnly(total)}
            </Paragraph>
          </XStack>
        </YStack>
        <SensitiveAmountToggle color="$heroAccent" inverse />
      </XStack>

      <YStack height={1} bg="rgba(246,251,252,0.13)" />

      <XStack gap="$5">
        <HeroMetric
          label={t("payments.paymentsLogged")}
          value={String(count)}
        />
        <YStack width={1} bg="rgba(246,251,252,0.13)" />
        <HeroMetric
          label={t("payments.lastPayment")}
          value={
            lastPaidAt ? formatDateString(lastPaidAt, locale) : t("debts.noDueDate")
          }
        />
      </XStack>
    </YStack>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <YStack flex={1} minW={0} gap="$1.5">
      <Paragraph color="$heroMuted" fontSize="$1">
        {label}
      </Paragraph>
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
