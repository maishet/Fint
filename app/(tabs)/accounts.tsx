import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CreditCard,
  PiggyBank,
  Plus,
  Trash2,
  Wallet,
} from "@tamagui/lucide-icons-2";
import { useNotify } from "../../src/ui/notify";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Paragraph, XStack, YStack } from "tamagui";
import { financeApi } from "../../src/api/finance";
import { normalizeAccount } from "../../src/api/mappers";
import type { Account, AccountsOverview } from "../../src/api/types";
import { DataStateCard } from "../../src/components/DataStateCard";
import { EmptyState } from "../../src/components/EmptyState";
import { Screen } from "../../src/components/Screen";
import { SwipeableRow } from "../../src/components/SwipeableRow";
import {
  SkeletonBlock,
  SkeletonGroup,
  SkeletonList,
} from "../../src/components/Skeleton";
import { getCurrencySymbol } from "../../src/finance/currencies";
import { usePressOnce } from "../../src/hooks/usePressOnce";
import {
  FintButton,
  FintCard,
  FintConfirmDialog,
  FintSheetSelect,
  FintSpinner,
} from "../../src/ui";
import { SensitiveAmountToggle } from "../../src/privacy/SensitiveAmountToggle";
import { useSensitiveMoney } from "../../src/privacy/useSensitiveMoney";

export default function AccountsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useNotify();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [currency, setCurrency] = useState("");
  const [initialLoadSettled, setInitialLoadSettled] = useState(false);
  const pressOnce = usePressOnce();
  const accountsQuery = useQuery({
    queryKey: ["accounts", "overview", currency],
    queryFn: ({ signal }) =>
      financeApi.getAccountsOverview(currency || undefined, signal),  });
  const accounts = (accountsQuery.data?.items ?? []).map(normalizeAccount);
  const isInitialFetch = !initialLoadSettled && accountsQuery.isFetching;
  const isLoading = accountsQuery.isLoading || isInitialFetch;
  const isRefreshing = accountsQuery.isRefetching;
  const error = accountsQuery.error;
  const deleteMutation = useMutation({
    mutationFn: (accountId: string) => financeApi.deleteAccount(accountId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["summary"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
      setDeleteTarget(null);
      toast.show(t("accounts.deletedToast"), {
        message: t("accounts.deletedMessage"),
        preset: "success",
        duration: 3500,
      });
    },
    onError: (mutationError) =>
      toast.show(t("accounts.deleteError"), {
        message:
          mutationError instanceof Error
            ? mutationError.message
            : t("states.error"),
        preset: "error",
        duration: 4500,
      }),
  });

  useEffect(() => {
    if (!accountsQuery.isFetching) setInitialLoadSettled(true);
  }, [accountsQuery.isFetching]);

  const openCreate = () => pressOnce(() => router.push("/account-form"));
  const openEdit = (account: Account) =>
    pressOnce(() =>
      router.push({
        pathname: "/account-form",
        params: { accountId: account.id },
      }),
    );

  return (
    <>
      <Screen
        isRefreshing={isRefreshing}
        onRefresh={() => {
          void accountsQuery.refetch();
        }}
        ground={
          !isLoading && !error && accountsQuery.data ? (
            <AccountsSummary overview={accountsQuery.data} />
          ) : (
            <YStack gap="$2">
              <SkeletonBlock height={14} width="42%" opacity={0.5} />
              <SkeletonBlock height={40} width="70%" opacity={0.5} />
            </YStack>
          )
        }
      >
        {!isLoading && (accountsQuery.data?.currencies.length ?? 0) > 1 ? (
          <FintSheetSelect
            label={t("forms.currency")}
            placeholder={t("forms.currency")}
            value={accountsQuery.data?.currency}
            options={(accountsQuery.data?.currencies ?? []).map((value) => ({
              value,
              label: value,
            }))}
            onValueChange={setCurrency}
          />
        ) : null}

        <XStack items="center" justify="space-between" gap="$3">
          <YStack gap="$1" flex={1}>
            <Paragraph
              color="$color12"
              fontFamily="$heading"
              fontSize="$6"
              fontWeight="600"
            >
              {t("accounts.myAccounts")}
            </Paragraph>
            {!isLoading ? (
              <Paragraph color="$color10" fontSize="$2">
                {t("accounts.accountCount", { count: accounts.length })}
              </Paragraph>
            ) : null}
          </YStack>
          <YStack
            width={42}
            height={42}
            rounded="$10"
            bg="$primary"
            items="center"
            justify="center"
            pressStyle={{ bg: "$accent10", scale: 0.96 }}
            cursor="pointer"
            role="button"
            onPress={openCreate}
            aria-label={t("actions.newAccount")}
          >
            <Plus size={22} color="$primaryForeground" />
          </YStack>
        </XStack>

        {isLoading ? (
          <SkeletonGroup label={t("states.loading")}>
            <SkeletonList rows={3} />
          </SkeletonGroup>
        ) : null}
        {error ? (
          <DataStateCard
            message={t("states.error")}
            onRetry={() => {
              void accountsQuery.refetch();
            }}
          />
        ) : null}
        {!isLoading && !error && accounts.length === 0 ? (
          <EmptyState
            icon={<Wallet size={26} color="$primary" />}
            title={t("accounts.emptyTitle")}
            description={t("accounts.emptyDescription")}
            actionLabel={t("actions.newAccount")}
            actionIcon={<Plus size={16} />}
            onAction={openCreate}
          />
        ) : null}
        {!isLoading && !error
          ? accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                isDeleting={
                  deleteMutation.isPending && deleteTarget?.id === account.id
                }
                onDelete={() => setDeleteTarget(account)}
                onPress={() => openEdit(account)}
              />
            ))
          : null}
      </Screen>

      <DeleteAccountDialog
        account={deleteTarget}
        isPending={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </>
  );
}

function AccountsSummary({ overview }: { overview: AccountsOverview }) {
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
            {t("accounts.consolidatedBalance")}
          </Paragraph>
          <XStack items="baseline" gap="$2" mt="$2">
            <Paragraph color="$heroMuted" fontSize="$3" fontWeight="500">
              {getCurrencySymbol(overview.currency)}
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
              {formatSensitiveAmountOnly(overview.totals.netWorth)}
            </Paragraph>
          </XStack>
        </YStack>
        <SensitiveAmountToggle color="$heroAccent" inverse />
      </XStack>

      <YStack height={1} bg="rgba(246,251,252,0.13)" />

      <XStack gap="$5">
        <SummaryMetric
          label={t("accounts.assets")}
          value={formatSensitiveAmount(
            overview.totals.assets,
            overview.currency,
          )}
        />
        <YStack width={1} bg="rgba(246,251,252,0.13)" />
        <SummaryMetric
          label={t("accounts.liabilities")}
          value={formatSensitiveAmount(
            overview.totals.liabilities,
            overview.currency,
          )}
        />
      </XStack>
    </YStack>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <YStack flex={1} minW={0} gap="$1.5">
      <Paragraph color="$heroMuted" fontFamily="$body" fontSize="$1">
        {label}
      </Paragraph>
      <Paragraph
        color="$heroForeground"
        fontFamily="$body"
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

function AccountCard({
  account,
  isDeleting,
  onDelete,
  onPress,
}: {
  account: Account;
  isDeleting: boolean;
  onDelete: () => void;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { formatSensitiveAmount } = useSensitiveMoney();
  const isNegative = account.balance < 0;
  const Icon = getAccountIcon(account.accountType);

  return (
    <SwipeableRow
      enabled={!isDeleting}
      onAction={onDelete}
      actionColor="$red9"
      actionIcon={<Trash2 size={20} color="white" />}
      actionLabel={t("accounts.deleteAccessibility", { name: account.name })}
    >
    <FintCard p="$2">
      <XStack items="center" gap="$1">
        <XStack
          flex={1}
          minW={0}
          items="center"
          gap="$3"
          p="$1"
          rounded="$5"
          cursor="pointer"
          role="button"
          bg="transparent"
          transition="quick"
          pressStyle={{ bg: "$secondary", scale: 0.99 }}
          onPress={onPress}
          aria-label={t("accounts.editAccessibility", { name: account.name })}
        >
          <YStack
            width={44}
            height={44}
            rounded="$9"
            bg={isNegative ? "$red2" : "$accent2"}
            borderColor={isNegative ? "$red5" : "$accent4"}
            borderWidth={1}
            items="center"
            justify="center"
          >
            <Icon size={21} color={isNegative ? "$red10" : "$primary"} />
          </YStack>
          <YStack flex={1} minW={0} gap="$1">
            <Paragraph
              color="$color12"
              fontFamily="$heading"
              fontSize="$4"
              fontWeight="600"
              numberOfLines={1}
            >
              {account.name}
            </Paragraph>
            <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>
              {getAccountTypeLabel(account.accountType, t)} · {account.currency}
            </Paragraph>
          </YStack>
          <Paragraph
            color={isNegative ? "$red11" : "$color12"}
            fontSize="$4"
            fontWeight="600"
            shrink={0}
          >
            {formatSensitiveAmount(account.balance, account.currency)}
          </Paragraph>
        </XStack>
        <Button
          circular
          chromeless
          size="$3"
          disabled={isDeleting}
          icon={
            isDeleting ? (
              <FintSpinner size="small" color="$color8" />
            ) : (
              <Trash2 size={18} color="$color8" />
            )
          }
          pressStyle={{ bg: "$color4" }}
          onPress={onDelete}
          aria-label={t("accounts.deleteAccessibility", { name: account.name })}
        />
      </XStack>
    </FintCard>
    </SwipeableRow>
  );
}

function DeleteAccountDialog({
  account,
  isPending,
  onCancel,
  onConfirm,
}: {
  account: Account | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <FintConfirmDialog
      open={Boolean(account)}
      isPending={isPending}
      title={t("accounts.deleteTitle")}
      description={t("accounts.deleteDescription", {
        name: account?.name ?? "",
      })}
      cancelLabel={t("actions.cancel")}
      confirmLabel={t("accounts.deleteConfirm")}
      pendingLabel={t("accounts.deleting")}
      destructive
      icon={<Trash2 size={17} color="$primaryForeground" />}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function getAccountIcon(accountType: string) {
  if (accountType === "credit_card") return CreditCard;
  if (accountType === "checking_account") return Building2;
  if (accountType === "savings_account") return PiggyBank;
  return Wallet;
}

function getAccountTypeLabel(accountType: string, t: (key: string) => string) {
  if (accountType === "cash") return t("accountTypes.cash");
  if (accountType === "credit_card") return t("accountTypes.creditCard");
  if (accountType === "checking_account")
    return t("accountTypes.checkingAccount");
  if (accountType === "savings_account")
    return t("accountTypes.savingsAccount");
  return accountType;
}
