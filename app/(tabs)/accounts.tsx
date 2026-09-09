import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Wallet } from "@tamagui/lucide-icons-2";
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
import {
  getAccountIcon,
  getAccountTypeLabel,
} from "../../src/finance/accountTypes";
import { usePressOnce } from "../../src/hooks/usePressOnce";
import {
  FintButton,
  FintConfirmDialog,
  FintSheetSelect,
  FintSpinner,
} from "../../src/ui";
import { FintListGroup } from "../../src/components/FintListGroup";
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
          {/* 44 es el mínimo de blanco de toque; estaba en 42. */}
          <YStack
            width={44}
            height={44}
            rounded="$10"
            bg="$primary"
            items="center"
            justify="center"
            transition="quick"
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
          ? groupAccountsByCurrency(accounts).map((section, _index, sections) => (
              <CurrencySection
                key={section.currency}
                section={section}
                showHeader={sections.length > 1}
                deletingId={
                  deleteMutation.isPending ? (deleteTarget?.id ?? null) : null
                }
                onDelete={setDeleteTarget}
                onPress={openEdit}
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

interface CurrencySection {
  currency: string;
  subtotal: number;
  accounts: Account[];
}

/**
 * Una sección por moneda, con su subtotal. Cada cuenta vive en la sección de su
 * moneda principal, pero el subtotal suma **todas** las líneas de esa moneda:
 * una tarjeta con línea en soles y en dólares aporta a las dos, tal como pide
 * el sprint 4 (2.3), aunque su fila se dibuje una sola vez.
 */
function groupAccountsByCurrency(accounts: Account[]): CurrencySection[] {
  const sections = new Map<string, CurrencySection>();
  for (const account of accounts) {
    const section = sections.get(account.currency) ?? {
      currency: account.currency,
      subtotal: 0,
      accounts: [],
    };
    section.accounts.push(account);
    sections.set(account.currency, section);
  }
  for (const account of accounts) {
    for (const line of account.balances ?? []) {
      const section = sections.get(line.currency);
      if (section) section.subtotal += line.balance;
    }
  }
  return [...sections.values()];
}

function CurrencySection({
  section,
  showHeader,
  deletingId,
  onDelete,
  onPress,
}: {
  section: CurrencySection;
  /** Con una sola moneda el encabezado repite lo que ya dice la cabecera. */
  showHeader: boolean;
  deletingId: string | null;
  onDelete: (account: Account) => void;
  onPress: (account: Account) => void;
}) {
  const { formatSensitiveAmount } = useSensitiveMoney();
  return (
    <YStack gap="$2">
      {showHeader ? (
      <XStack items="baseline" justify="space-between" gap="$3" px="$1">
        <Paragraph
          color="$color10"
          fontSize="$1"
          fontWeight="600"
          letterSpacing={0.6}
          textTransform="uppercase"
        >
          {section.currency}
        </Paragraph>
        <Paragraph color="$color10" fontSize="$1" fontWeight="600">
          {formatSensitiveAmount(section.subtotal, section.currency)}
        </Paragraph>
      </XStack>
      ) : null}
      <FintListGroup inset={61}>
        {section.accounts.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            isDeleting={deletingId === account.id}
            onDelete={() => onDelete(account)}
            onPress={() => onPress(account)}
          />
        ))}
      </FintListGroup>
    </YStack>
  );
}

function AccountRow({
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
  const lines = account.balances ?? [
    { currency: account.currency, balance: account.balance },
  ];
  const isNegative = account.balance < 0;
  const Icon = getAccountIcon(account.accountType);

  return (
    <SwipeableRow
      enabled={!isDeleting}
      onAction={onDelete}
      actionColor="$red9"
      actionIcon={<Trash2 size={20} color="white" />}
      actionLabel={t("accounts.deleteAccessibility", { name: account.name })}
      actionRounded={0}
    >
      <XStack
        minH={64}
        items="center"
        gap="$3"
        px={12}
        bg="$card"
        cursor="pointer"
        role="button"
        transition="quick"
        pressStyle={{ bg: "$secondary" }}
        onPress={onPress}
        aria-label={t("accounts.editAccessibility", { name: account.name })}
      >
        <YStack
          width={36}
          height={36}
          rounded="$10"
          bg={isNegative ? "$red2" : "$secondary"}
          items="center"
          justify="center"
          shrink={0}
        >
          <Icon size={18} color={isNegative ? "$red10" : "$primary"} />
        </YStack>
        <YStack flex={1} minW={0}>
          <Paragraph
            color="$color12"
            fontFamily="$heading"
            fontSize="$4"
            fontWeight="600"
            numberOfLines={1}
          >
            {account.name}
          </Paragraph>
          {/* La moneda ya la dice la sección: aquí sólo queda el tipo. */}
          <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>
            {getAccountTypeLabel(account.accountType, t)}
          </Paragraph>
        </YStack>
        <YStack shrink={0} items="flex-end">
          {/* Una línea por moneda: la tarjeta de crédito lleva soles y dólares. */}
          {lines.map((line) => (
            <Paragraph
              key={line.currency}
              color={line.balance < 0 ? "$red11" : "$color12"}
              fontSize="$4"
              fontWeight="600"
            >
              {formatSensitiveAmount(line.balance, line.currency)}
            </Paragraph>
          ))}
        </YStack>
        {/* El botón en línea es el respaldo del deslizamiento, no su duplicado. */}
        <Button
          circular
          chromeless
          size="$2"
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
