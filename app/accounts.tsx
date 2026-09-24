import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, ChevronLeft, Pencil, Plus, Trash2, Wallet } from "@tamagui/lucide-icons-2";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack, useTheme } from "tamagui";
import { accountLines, assetsAndLiabilities, groupAccounts } from "../src/accounts/logic";
import { financeApi } from "../src/api/finance";
import { normalizeAccount } from "../src/api/mappers";
import type { Account } from "../src/api/types";
import { DataStateCard } from "../src/components/DataStateCard";
import { getAccountTypeLabel } from "../src/finance/accountTypes";
import { usePressOnce } from "../src/hooks/usePressOnce";
import { AccountMonogram } from "../src/movement-form/AccountSheet";
import { useThemeMode } from "../src/theme/ThemeMode";
import { radius, space } from "../src/theme/tokens";
import { Amount, FintButton, FintCard, FintConfirmDialog, FText, IconButton, SegmentedControl } from "../src/ui";
import { AmountSkeleton } from "../src/ui/AmountSkeleton";
import { GroupedCell } from "../src/ui/GroupedCell";
import { useNotify } from "../src/ui/notify";
import { SwipeActions, type SwipeAction } from "../src/ui/SwipeActions";

/**
 * Cuentas v3 (pantalla apilada, se abre desde el hero): volver, título y el
 * botón para crear una cuenta; el patrimonio neto con su moneda y la barra
 * entre activos y pasivos; y las cuentas agrupadas en Bancos, Efectivo y
 * Tarjetas de crédito, cada grupo con su total.
 *
 * Conserva la lógica anterior: `getAccountsOverview` por moneda, editar al
 * tocar, eliminar con confirmación, y las cuentas con saldo en dos monedas
 * (una tarjeta con línea en soles y dólares) con los montos apilados.
 */
export default function AccountsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useNotify();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { themeMode } = useThemeMode();
  const pressOnce = usePressOnce();
  const [currency, setCurrency] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [pulling, setPulling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(themeMode === "dark" ? "light" : "dark");
      return () => setStatusBarStyle("light");
    }, [themeMode]),
  );

  const accountsQuery = useQuery({
    queryKey: ["accounts", "overview", currency],
    queryFn: ({ signal }) => financeApi.getAccountsOverview(currency || undefined, signal),
    placeholderData: (previous) => previous,
  });
  const overview = accountsQuery.data;
  const selected = overview?.currency ?? currency;
  const accounts = useMemo(() => (overview?.items ?? []).map(normalizeAccount), [overview]);
  const groups = useMemo(() => groupAccounts(accounts, selected), [accounts, selected]);

  const deleteMutation = useMutation({
    mutationFn: (accountId: string) => financeApi.deleteAccount(accountId),
    onSuccess: async () => {
      await Promise.all(["accounts", "summary", "transactions", "reports"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      setDeleteTarget(null);
      toast.show(t("accounts.deletedToast"), { message: t("accounts.deletedMessage"), preset: "success", duration: 3500 });
    },
    onError: (mutationError) =>
      toast.show(t("accounts.deleteError"), {
        message: mutationError instanceof Error ? mutationError.message : t("states.error"),
        preset: "error",
        duration: 4500,
      }),
  });

  const openCreate = () => pressOnce(() => router.push("/account-form"));
  const openEdit = (account: Account) => pressOnce(() => router.push({ pathname: "/account-form", params: { accountId: account.id } }));

  // Activos y pasivos desde los saldos de la moneda elegida, para que activos menos pasivos sea el patrimonio.
  const { assets, liabilities } = useMemo(() => assetsAndLiabilities(accounts, selected), [accounts, selected]);

  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <ScrollView
        contentContainerStyle={{ paddingTop: space[2], paddingBottom: insets.bottom + space[6] }}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => {
              setPulling(true);
              void accountsQuery.refetch().finally(() => setPulling(false));
            }}
            tintColor={theme.brand.val}
            colors={[theme.brand.val]}
            progressBackgroundColor={theme.surface.val}
          />
        }
      >
        {/* Volver, título y crear cuenta. Es una pantalla apilada: sin barra de tabs. */}
        <XStack items="center" px={space[4]} gap={space[3]}>
          <IconButton label={t("accountsScreen.back")} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
          <FText variant="display-lg" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
            {t("accountsScreen.title")}
          </FText>
          <IconButton tone="brand" label={t("actions.newAccount")} icon={<Plus size={20} color="$onBrand" strokeWidth={2.2} />} onPress={openCreate} />
        </XStack>

        {/* Patrimonio neto: activos en `chart1`, pasivos en `flowOut`. */}
        <FintCard mx={space[4]} mt={space[4]} p={space[5]}>
          <XStack items="center" justify="space-between" gap={space[3]}>
            <FText variant="caption" tone="inkMuted" style={{ fontSize: 13 }}>
              {t("accountsScreen.netWorth")}
            </FText>
            {(overview?.currencies.length ?? 0) > 1 ? (
              <View width={overview!.currencies.length * 64}>
                <SegmentedControl
                  size="sm"
                  options={overview!.currencies.map((c) => ({ value: c, label: c }))}
                  value={selected}
                  onChange={setCurrency}
                  accessibilityLabel={t("accountsScreen.currency")}
                />
              </View>
            ) : null}
          </XStack>
          {!overview ? (
            <YStack mt={10} gap={16}>
              <AmountSkeleton width={200} height={30} />
              <AmountSkeleton width={260} height={10} />
            </YStack>
          ) : (
            <>
              <Amount value={overview.totals.netWorth} currency={selected} variant="amount-lg" style={{ fontSize: 34, lineHeight: 40, letterSpacing: -1.2, marginTop: 6 }} />
              <XStack height={10} mt={16} mb={14} rounded={radius.pill} overflow="hidden" gap={assets > 0 && liabilities > 0 ? 3 : 0} bg="$chartTrack">
                {assets > 0 ? <View height="100%" bg="$chart1" style={{ flex: assets }} /> : null}
                {liabilities > 0 ? <View height="100%" bg="$flowOut" style={{ flex: liabilities }} /> : null}
              </XStack>
              <XStack>
                <YStack flex={1} minW={0} pr={space[3]}>
                  <Legend color="$chart1" label={t("accountsScreen.assets")} />
                  <Amount value={assets} currency={selected} style={{ fontSize: 17, lineHeight: 22, marginTop: 4 }} />
                </YStack>
                <YStack flex={1} minW={0} pl={space[4]} borderLeftWidth={1} borderColor="$line">
                  <Legend color="$flowOut" label={t("accountsScreen.liabilities")} />
                  <Amount value={-liabilities} currency={selected} style={{ fontSize: 17, lineHeight: 22, marginTop: 4 }} />
                </YStack>
              </XStack>
            </>
          )}
        </FintCard>

        {accountsQuery.error ? (
          <View mx={space[4]} mt={space[4]}>
            <DataStateCard message={t("states.error")} onRetry={() => void accountsQuery.refetch()} />
          </View>
        ) : null}

        {accountsQuery.isLoading ? (
          <ListSkeleton />
        ) : overview && accounts.length === 0 ? (
          <YStack items="center" gap={space[3]} px={space[6]} pt={space[8]}>
            <View width={52} height={52} rounded={999} bg="$surfaceSunken" items="center" justify="center">
              <Wallet size={22} color="$inkMuted" />
            </View>
            <FText variant="heading" style={{ textAlign: "center" }}>
              {t("accountsScreen.emptyTitle")}
            </FText>
            <FintButton icon={<Plus size={16} />} onPress={openCreate}>
              {t("accountsScreen.emptyAction")}
            </FintButton>
          </YStack>
        ) : (
          groups.map((group) => (
            <YStack key={group.key} mt={space[6]} mx={space[4]}>
              <XStack items="baseline" justify="space-between" gap={space[3]} mb={space[3]}>
                <FText variant="body-strong" accessibilityRole="header">
                  {t(`accountsScreen.groups.${group.key}`)}
                </FText>
                <Amount value={group.total} currency={selected} variant="amount-sm" tone="inkMuted" />
              </XStack>
              {group.accounts.map((account, i) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  first={i === 0}
                  last={i === group.accounts.length - 1}
                  onEdit={() => openEdit(account)}
                  onDelete={() => setDeleteTarget(account)}
                />
              ))}
            </YStack>
          ))
        )}
      </ScrollView>

      <FintConfirmDialog
        open={Boolean(deleteTarget)}
        isPending={deleteMutation.isPending}
        title={t("accounts.deleteTitle")}
        description={t("accounts.deleteDescription", { name: deleteTarget?.name ?? "" })}
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("accounts.deleteConfirm")}
        pendingLabel={t("accounts.deleting")}
        destructive
        icon={<Trash2 size={17} color="$onDanger" />}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </YStack>
  );
}

function Legend({ color, label }: { color: "$chart1" | "$flowOut"; label: string }) {
  return (
    <XStack items="center" gap={6}>
      <View width={8} height={8} bg={color} style={{ borderRadius: 2 }} />
      <FText variant="caption" tone="inkMuted" style={{ fontSize: 13 }}>
        {label}
      </FText>
    </XStack>
  );
}

/**
 * Fila de una cuenta: su inicial (o el billete si es efectivo), nombre, tipo y
 * saldo. Una cuenta con saldo en dos monedas los muestra apilados, como la
 * fila anterior. Tocarla la edita; deslizar muestra Editar y Eliminar.
 */
function AccountRow({ account, first, last, onEdit, onDelete }: { account: Account; first: boolean; last: boolean; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  const lines = accountLines(account);
  const typeLabel = getAccountTypeLabel(account.accountType, t);
  const actions: SwipeAction[] = [
    { key: "edit", label: t("accountsScreen.edit"), icon: <Pencil size={18} color="$ink" />, tone: "neutral", run: onEdit },
    { key: "delete", label: t("accountsScreen.delete"), icon: <Trash2 size={18} color="$onDanger" />, tone: "danger", run: onDelete },
  ];
  return (
    <GroupedCell first={first} last={last}>
      <SwipeActions actions={actions}>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={t("accounts.editAccessibility", { name: account.name })}
          accessibilityActions={actions.map((a) => ({ name: a.key, label: a.label }))}
          onAccessibilityAction={(e) => actions.find((a) => a.key === e.nativeEvent.actionName)?.run()}
        >
          {({ pressed }) => (
            <XStack items="center" gap={space[3]} px={space[4]} py={14} bg={pressed ? "$surfaceSunken" : "$surface"}>
              {account.accountType === "cash" ? (
                <View width={38} height={38} rounded={999} bg="$surfaceSunken" items="center" justify="center">
                  <Banknote size={18} color="$inkMuted" strokeWidth={1.9} />
                </View>
              ) : (
                <AccountMonogram name={account.name} />
              )}
              <YStack flex={1} minW={0}>
                <FText variant="body-strong" numberOfLines={1} style={{ letterSpacing: -0.15 }}>
                  {account.name}
                </FText>
                <FText variant="caption" tone="inkFaint" numberOfLines={1} style={{ marginTop: 1 }}>
                  {typeLabel}
                </FText>
              </YStack>
              {/* Una línea por moneda: la tarjeta de crédito lleva soles y dólares. */}
              <YStack items="flex-end" shrink={0}>
                {lines.map((line) => (
                  <Amount key={line.currency} value={line.balance} currency={line.currency} />
                ))}
              </YStack>
            </XStack>
          )}
        </Pressable>
      </SwipeActions>
    </GroupedCell>
  );
}

function ListSkeleton() {
  return (
    <YStack mx={space[4]} mt={space[6]} gap={space[3]}>
      <AmountSkeleton width={90} height={14} />
      <YStack rounded={radius.lg} borderWidth={1} borderColor="$line" bg="$surface" overflow="hidden">
        {[0, 1, 2].map((i) => (
          <XStack key={i} items="center" gap={space[3]} px={space[4]} py={14} borderTopWidth={i ? 1 : 0} borderColor="$line">
            <View width={38} height={38} rounded={999} bg="$surfaceSunken" />
            <YStack flex={1} gap={6}>
              <AmountSkeleton width={130} height={12} />
              <AmountSkeleton width={80} height={10} />
            </YStack>
            <AmountSkeleton width={90} height={12} />
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}
