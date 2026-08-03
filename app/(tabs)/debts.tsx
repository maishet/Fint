import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  HandCoins,
  Plus,
  Trash2,
} from "@tamagui/lucide-icons-2";
import { useToastController } from "@tamagui/toast";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Paragraph, Spinner, XStack, YStack } from "tamagui";
import { financeApi } from "../../src/api/finance";
import { formatMoney } from "../../src/api/mappers";
import type { PaymentOccurrence } from "../../src/api/types";
import { CardAmountsSheet } from "../../src/components/CardAmountsSheet";
import { DataStateCard } from "../../src/components/DataStateCard";
import { OccurrencePaymentSheet } from "../../src/components/OccurrencePaymentSheet";
import { Screen } from "../../src/components/Screen";
import {
  SkeletonGroup,
  SkeletonHero,
  SkeletonList,
} from "../../src/components/Skeleton";
import { formatDateString, parseDateString } from "../../src/finance/dates";
import { usePressOnce } from "../../src/hooks/usePressOnce";
import { FintButton, FintCard, FintConfirmDialog } from "../../src/ui";
import { getAppLocale } from "../../src/i18n";
import { useCapabilities } from "../../src/api/capabilities";
import { useSensitiveMoney } from "../../src/privacy/useSensitiveMoney";
import { SensitiveAmountToggle } from "../../src/privacy/SensitiveAmountToggle";

export default function DebtsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToastController();
  const { capabilities } = useCapabilities();
  const [paymentOccurrence, setPaymentOccurrence] =
    useState<PaymentOccurrence | null>(null);
  const [amountOccurrence, setAmountOccurrence] =
    useState<PaymentOccurrence | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentOccurrence | null>(
    null,
  );
  const pressOnce = usePressOnce();
  const occurrencesQuery = useQuery({
    queryKey: ["payment-occurrences", "open"],
    queryFn: ({ signal }) =>
      financeApi.listPaymentOccurrences({ status: "open" }, signal),
    retry: false,
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
      }),
    retry: false,
    enabled: Boolean(paymentOccurrence),
  });
  const occurrences = occurrencesQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];
  const displayCurrency = occurrences[0]?.currency ?? "PEN";
  const totalOutstanding = occurrences
    .filter((item) => item.currency === displayCurrency)
    .reduce((sum, item) => sum + (item.remainingAmount ?? 0), 0);
  const locale = getAppLocale(i18n.resolvedLanguage);
  const nextDueDebt = [...occurrences]
    .filter((item) => item.dueDate)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0];
  const isLoading = occurrencesQuery.isLoading;
  const isRefreshing = occurrencesQuery.isRefetching;
  const error = occurrencesQuery.error;

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
        }}
      >
        {isLoading ? (
          <SkeletonGroup label={t("states.loading")}>
            <SkeletonHero />
          </SkeletonGroup>
        ) : null}
        {!isLoading && !error ? (
          <DebtHero
            count={occurrences.length}
            currency={displayCurrency}
            nextDueDate={nextDueDebt?.dueDate ?? null}
            total={totalOutstanding}
          />
        ) : null}

        <XStack items="center" justify="space-between" gap="$3">
          <YStack gap="$1" flex={1}>
            <Paragraph
              color="$color12"
              fontFamily="$heading"
              fontSize="$6"
              fontWeight="700"
            >
              {t("payments.upcoming")}
            </Paragraph>
            {!isLoading ? (
              <Paragraph color="$color10" fontSize="$2">
                {t("payments.count", { count: occurrences.length })}
              </Paragraph>
            ) : null}
          </YStack>
          {capabilities.features.recurringPayments ? (
            <Button
              circular
              bg="$primary"
              icon={<Plus size={22} color="$primaryForeground" />}
              onPress={openCreate}
              aria-label={t("payments.newRecurring")}
            />
          ) : null}
        </XStack>

        {isLoading ? (
          <SkeletonGroup label={t("states.loading")}>
            <SkeletonList rows={3} />
          </SkeletonGroup>
        ) : null}
        {error ? (
          <DataStateCard
            message={error instanceof Error ? error.message : t("states.error")}
            onRetry={() => {
              void occurrencesQuery.refetch();
            }}
          />
        ) : null}
        {!isLoading && !error && occurrences.length === 0 ? (
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
              fontWeight="700"
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

        {!isLoading && !error
          ? occurrences.map((occurrence) => (
              <OccurrenceCard
                key={occurrence.id}
                occurrence={occurrence}
                isDeleting={
                  deleteMutation.isPending &&
                  deleteTarget?.ruleId === occurrence.ruleId
                }
                locale={locale}
                onConfigureAmount={() => setAmountOccurrence(occurrence)}
                onDelete={() => setDeleteTarget(occurrence)}
                onEdit={() =>
                  occurrence.ruleId &&
                  router.push({
                    pathname: "/debt-form",
                    params: { ruleId: occurrence.ruleId },
                  })
                }
                onPay={() => setPaymentOccurrence(occurrence)}
              />
            ))
          : null}
      </Screen>

      <OccurrencePaymentSheet
        accounts={accounts}
        occurrence={paymentOccurrence}
        open={Boolean(paymentOccurrence)}
        onOpenChange={(open) => !open && setPaymentOccurrence(null)}
      />
      <CardAmountsSheet
        occurrence={amountOccurrence}
        open={Boolean(amountOccurrence)}
        onOpenChange={(open) => !open && setAmountOccurrence(null)}
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

function OccurrenceCard({
  isDeleting,
  locale,
  occurrence,
  onConfigureAmount,
  onDelete,
  onEdit,
  onPay,
}: {
  isDeleting: boolean;
  locale: string;
  occurrence: PaymentOccurrence;
  onConfigureAmount: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onPay: () => void;
}) {
  const { t } = useTranslation();
  const { formatSensitiveAmount } = useSensitiveMoney();
  const due = getDueState(occurrence.dueDate, locale, t);
  const total = occurrence.totalAmount ?? 0;
  const remaining = occurrence.remainingAmount ?? total;
  const progress =
    total > 0
      ? Math.min(100, Math.round((occurrence.paidAmount / total) * 100))
      : 0;
  const needsAmount = occurrence.amountStatus === "required";
  const kindLabel =
    occurrence.kind === "credit_card"
      ? t("payments.creditCard")
      : t("payments.fixed");
  return (
    <FintCard
      p="$3"
      gap="$3"
      onPress={onEdit}
      role="button"
      cursor="pointer"
      pressStyle={{ opacity: 0.78 }}
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
            fontWeight="700"
            numberOfLines={1}
          >
            {occurrence.title}
          </Paragraph>
          <Paragraph color="$color10" fontSize="$1">
            {kindLabel}
            {occurrence.cardAccount ? ` · ${occurrence.cardAccount}` : ""}
          </Paragraph>
          <Paragraph
            color={due.overdue ? "$red10" : "$color10"}
            fontSize="$1"
            fontWeight={due.overdue ? "700" : "500"}
          >
            {due.label}
          </Paragraph>
        </YStack>
        <YStack items="flex-end" gap="$1">
          <Paragraph
            color={needsAmount ? "$yellow10" : "$color12"}
            fontSize="$4"
            fontWeight="800"
            shrink={0}
          >
            {needsAmount
              ? t("payments.configureAmount")
              : formatSensitiveAmount(remaining, occurrence.currency)}
          </Paragraph>
          <Paragraph color="$color10" fontSize="$1">
            {statusLabel(occurrence.paymentStatus, t)}
          </Paragraph>
          <XStack gap="$1">
            <Button
              circular
              chromeless
              size="$3"
              icon={
                needsAmount ? (
                  <CreditCard size={19} color="$yellow10" />
                ) : (
                  <CheckCircle2 size={19} color="$primary" />
                )
              }
              onPress={(event) => {
                event.stopPropagation();
                needsAmount ? onConfigureAmount() : onPay();
              }}
              aria-label={
                needsAmount
                  ? t("payments.configureAmountAction")
                  : t("payments.registerPayment")
              }
            />
            <Button
              circular
              chromeless
              size="$3"
              disabled={isDeleting}
              icon={
                isDeleting ? (
                  <Spinner size="small" color="$red10" />
                ) : (
                  <Trash2 size={17} color="$red10" />
                )
              }
              pressStyle={{ bg: "$red3" }}
              onPress={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              aria-label={t("payments.deleteRecurring")}
            />
          </XStack>
        </YStack>
      </XStack>
      <YStack gap="$1">
        <XStack justify="space-between">
          <Paragraph color="$color10" fontSize="$1">
            {t("debts.paidProgress", { progress })}
          </Paragraph>
          <Paragraph color="$color10" fontSize="$1">
            {formatSensitiveAmount(occurrence.paidAmount, occurrence.currency)}{" "}
            /{" "}
            {needsAmount
              ? "-"
              : formatSensitiveAmount(total, occurrence.currency)}
          </Paragraph>
        </XStack>
        <YStack height={5} rounded="$10" bg="$muted" overflow="hidden">
          <YStack
            width={`${progress}%`}
            height="100%"
            bg="$primary"
            rounded="$10"
          />
        </YStack>
      </YStack>
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
  if (status === "paid") return t("payments.statusPaid");
  if (status === "minimum_met") return t("payments.statusMinimumMet");
  if (status === "partial") return t("payments.statusPartial");
  return t("payments.statusPending");
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
  const { formatSensitiveAmount } = useSensitiveMoney();
  const locale = getAppLocale(i18n.resolvedLanguage);
  return (
    <FintCard bg="$heroBackground" borderColor="$heroBorder" gap="$4" p="$4">
      <XStack items="center" justify="space-between" gap="$3">
        <YStack flex={1} minW={0} gap="$1">
          <Paragraph
            color="$heroMuted"
            fontFamily="$heading"
            fontSize="$2"
            fontWeight="700"
            textTransform="uppercase"
          >
            {t("payments.totalPending")}
          </Paragraph>
          <Paragraph
            color="$heroForeground"
            fontFamily="$body"
            fontSize="$9"
            fontWeight="800"
            lineHeight="$9"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatSensitiveAmount(total, currency)}
          </Paragraph>
        </YStack>
        <SensitiveAmountToggle color="$heroAccent" inverse />
      </XStack>
      <XStack gap="$4">
        <HeroMetric
          accent="$heroAccent"
          label={t("payments.activePayments")}
          value={String(count)}
        />
        <HeroMetric
          accent="$destructive"
          label={t("payments.nextDue")}
          value={
            nextDueDate
              ? formatDateString(nextDueDate, locale)
              : t("debts.noDueDate")
          }
        />
      </XStack>
    </FintCard>
  );
}

function HeroMetric({
  accent,
  label,
  value,
}: {
  accent: string;
  label: string;
  value: string;
}) {
  return (
    <YStack flex={1} minW={0} gap="$1">
      <YStack height={4} rounded="$10" bg={accent as never} />
      <Paragraph color="$heroMuted" fontSize="$1">
        {label}
      </Paragraph>
      <Paragraph
        color="$heroForeground"
        fontSize="$3"
        fontWeight="800"
        numberOfLines={1}
      >
        {value}
      </Paragraph>
    </YStack>
  );
}

function getDueState(
  value: string | null | undefined,
  locale: string,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const date = parseDateString(value);
  if (!date) return { overdue: false, label: t("debts.noDueDate") };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const formatted = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  if (days < 0)
    return {
      overdue: true,
      label: t("debts.overdueDays", { days: Math.abs(days), date: formatted }),
    };
  if (days === 0) return { overdue: false, label: t("debts.dueToday") };
  return {
    overdue: false,
    label: t("debts.dueInDays", { days, date: formatted }),
  };
}
