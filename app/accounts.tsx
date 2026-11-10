import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, ChevronLeft, CreditCard, Landmark, Pencil, Plus, Trash2, Wallet } from "@tamagui/lucide-icons-2";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack, useTheme } from "tamagui";
import { accountLines, assetsAndLiabilities, groupAccounts } from "../src/accounts/logic";
import { financeApi } from "../src/api/finance";
import { normalizeAccount } from "../src/api/mappers";
import type { Account } from "../src/api/types";
import { DataStateCard } from "../src/components/DataStateCard";
import { getAccountTypeLabel } from "../src/finance/accountTypes";
import { usePressOnce } from "../src/hooks/usePressOnce";
import { SkeletonBlock, SkeletonGroup } from "../src/components/Skeleton";
import { COMPACT_FONT_SCALE, space, ticket } from "../src/theme/tokens";
import { fontFace } from "../src/theme/typography";
import { useScreenStatusBar } from "../src/theme/useScreenStatusBar";
import { Amount, FintButton, FintConfirmDialog, FintLottie, FText, IconButton, PressableScale, RowAmount, Ticket, TicketBar } from "../src/ui";
import { useNotify } from "../src/ui/notify";
import { SwipeActions, type SwipeAction } from "../src/ui/SwipeActions";

/**
 * Cuentas (marca D, F-08; pantalla apilada, se abre desde la boleta del Inicio): volver, título y el botón para
 * crear una cuenta; el patrimonio neto en una boleta amarilla con su moneda (PEN | USD en tinta) y, tras el filete,
 * activos y pasivos; y las cuentas agrupadas en Bancos, Efectivo y Tarjetas de crédito, cada grupo con su total,
 * en filas a todo el ancho con el ícono del tipo en un cuadro de 44 (las cuentas no tienen emoji).
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
  const { fontScale } = useWindowDimensions();
  const pressOnce = usePressOnce();
  const [currency, setCurrency] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [pulling, setPulling] = useState(false);

  useScreenStatusBar();

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
            tintColor={theme.ink.val}
            colors={[theme.ink.val]}
            progressBackgroundColor={theme.surface.val}
          />
        }
      >
        {/* Volver, título y crear cuenta. Es una pantalla apilada: sin barra de tabs. */}
        <XStack items="center" px={space[5]} gap={10}>
          <IconButton label={t("accountsScreen.back")} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
          <FText accessibilityRole="header" maxFontSizeMultiplier={COMPACT_FONT_SCALE} numberOfLines={2} style={{ ...SCREEN_TITLE, flex: 1 }}>
            {t("accountsScreen.title")}
          </FText>
          <IconButton label={t("actions.newAccount")} icon={<Plus size={20} color="$ink" strokeWidth={2.2} />} onPress={openCreate} />
        </XStack>

        {/* Patrimonio neto en la boleta: la cifra arriba y, tras el filete, activos y pasivos. */}
        <View mx={space[5]} mt={10}>
          <Ticket
            top={
              <>
                <XStack items="center" justify="space-between" gap={space[3]} flexWrap="wrap">
                  <FText tone="slabInk" maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.sans[600], fontSize: 14, lineHeight: 19 }}>
                    {t("accountsScreen.netWorth")}
                  </FText>
                  {(overview?.currencies.length ?? 0) > 1 ? (
                    <CurrencySwitch currencies={overview!.currencies} value={selected} onChange={setCurrency} label={t("accountsScreen.currency")} />
                  ) : null}
                </XStack>
                {!overview ? (
                  <SkeletonGroup label={t("states.loading")}>
                    <TicketBar width={200} height={40} rounded={12} mt={10} />
                  </SkeletonGroup>
                ) : (
                  <Amount
                    value={overview.totals.netWorth}
                    currency={selected}
                    variant="amount-hero"
                    onSlab
                    smallCents
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{ fontSize: 44, lineHeight: 52, letterSpacing: -1, marginTop: 6 }}
                  />
                )}
              </>
            }
            bottom={
              <XStack gap={10} flexWrap={fontScale >= COMPACT_FONT_SCALE ? "wrap" : "nowrap"}>
                <TicketFigure label={t("accountsScreen.assets")} value={overview ? assets : null} currency={selected} />
                <TicketFigure label={t("accountsScreen.liabilities")} value={overview ? -liabilities : null} currency={selected} />
              </XStack>
            }
          />
        </View>

        {accountsQuery.error ? (
          <View mx={space[5]} mt={space[4]}>
            <DataStateCard message={t("states.error")} onRetry={() => void accountsQuery.refetch()} />
          </View>
        ) : null}

        {accountsQuery.isLoading ? (
          <ListSkeleton />
        ) : overview && accounts.length === 0 ? (
          <YStack items="center" gap={space[3]} px={space[6]} pt={space[8]}>
            <FintLottie name="coin-stack" size={76} loop="breathe" />
            <FText style={{ ...SECTION_TITLE, textAlign: "center" }}>
              {t("accountsScreen.emptyTitle")}
            </FText>
            <FintButton icon={<Plus size={16} color="$onBrand" />} onPress={openCreate}>
              {t("accountsScreen.emptyAction")}
            </FintButton>
          </YStack>
        ) : (
          groups.map((group) => (
            <YStack key={group.key} mt={22} mx={space[5]}>
              <XStack items="baseline" justify="space-between" gap={space[3]} mb={4} flexWrap="wrap">
                <FText accessibilityRole="header" maxFontSizeMultiplier={1.5} style={{ fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21 }}>
                  {t(`accountsScreen.groups.${group.key}`)}
                </FText>
                <Amount value={group.total} currency={selected} tone="inkMuted" style={{ fontFamily: fontFace.mono[600], fontSize: 14, lineHeight: 19 }} />
              </XStack>
              {group.accounts.map((account, i) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  first={i === 0}
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

/** Títulos de la marca D: pantalla secundaria 26 y sección 20, en Figtree Bold (no hay 800 cargado). */
const SCREEN_TITLE = { fontFamily: fontFace.display[700], fontSize: 26, lineHeight: 31, letterSpacing: -0.6 } as const;
const SECTION_TITLE = { fontFamily: fontFace.display[700], fontSize: 20, lineHeight: 25, letterSpacing: -0.4 } as const;

/** PEN | USD dentro de la boleta: la elegida en tinta (`slabInk`, igual en los dos temas) con texto amarillo, el resto sobre la ficha al 10 %. */
function CurrencySwitch({ currencies, value, onChange, label }: { currencies: string[]; value: string; onChange: (c: string) => void; label: string }) {
  return (
    <XStack p={3} rounded={999} style={{ backgroundColor: ticket.control }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {currencies.map((c) => {
        const active = c === value;
        return (
          <PressableScale
            key={c}
            onPress={() => onChange(c)}
            haptic="select"
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={c}
          >
            <View height={28} px={12} rounded={999} items="center" justify="center" bg={active ? "$slabInk" : undefined}>
              <FText
                maxFontSizeMultiplier={COMPACT_FONT_SCALE}
                color={active ? "$slab" : "$slabInk"}
                style={{ fontFamily: fontFace.sans[600], fontSize: 12, lineHeight: 16 }}
              >
                {c}
              </FText>
            </View>
          </PressableScale>
        );
      })}
    </XStack>
  );
}

/** Una cifra de la parte de abajo de la boleta: etiqueta en `slabMuted` y el monto a 18 en `slabInk`. */
function TicketFigure({ label, value, currency }: { label: string; value: number | null; currency: string }) {
  return (
    <YStack flex={1} minW={140} gap={2}>
      <FText tone="slabMuted" style={{ fontFamily: fontFace.sans[600], fontSize: 12, lineHeight: 16 }}>
        {label}
      </FText>
      {value === null ? (
        <TicketBar width={110} height={20} mt={2} />
      ) : (
        <Amount value={value} currency={currency} onSlab style={{ fontFamily: fontFace.mono[600], fontSize: 18, lineHeight: 24 }} />
      )}
    </YStack>
  );
}

/** El ícono del tipo de cuenta en el cuadro de 44: las cuentas no tienen emoji en la API. */
function AccountIcon({ type }: { type: string }) {
  const Icon = type === "cash" ? Banknote : type === "credit_card" ? CreditCard : type === "checking_account" || type === "savings_account" ? Landmark : Wallet;
  return (
    <View width={44} height={44} rounded={14} bg="$surface" items="center" justify="center" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Icon size={22} color="$ink" strokeWidth={2} />
    </View>
  );
}

/**
 * Fila de una cuenta (marca D): el ícono de su tipo, nombre, tipo y saldo, a todo el ancho con el filete arriba
 * salvo la primera del grupo. Una cuenta con saldo en dos monedas los muestra apilados, como la fila de producción.
 * Desde `COMPACT_FONT_SCALE` los saldos bajan debajo del nombre. Tocarla la edita; deslizar muestra Editar (tinta)
 * y Eliminar.
 */
function AccountRow({ account, first, onEdit, onDelete }: { account: Account; first: boolean; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= COMPACT_FONT_SCALE;
  const lines = accountLines(account);
  const typeLabel = getAccountTypeLabel(account.accountType, t);
  const actions: SwipeAction[] = [
    { key: "edit", label: t("accountsScreen.edit"), icon: <Pencil size={18} color="$canvas" />, tone: "ink", run: onEdit },
    { key: "delete", label: t("accountsScreen.delete"), icon: <Trash2 size={18} color="$onDanger" />, tone: "danger", run: onDelete },
  ];
  // Una línea por moneda: la tarjeta de crédito lleva soles y dólares.
  const balances = (
    <YStack items={stacked ? "flex-start" : "flex-end"} shrink={0}>
      {lines.map((line) => (
        <RowAmount key={line.currency} value={line.balance} currency={line.currency} tone={line.balance < 0 ? "flowOut" : "ink"} />
      ))}
    </YStack>
  );
  return (
    <SwipeActions actions={actions}>
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={t("accounts.editAccessibility", { name: account.name })}
        accessibilityActions={actions.map((a) => ({ name: a.key, label: a.label }))}
        onAccessibilityAction={(e) => actions.find((a) => a.key === e.nativeEvent.actionName)?.run()}
      >
        {({ pressed }) => (
          <XStack items={stacked ? "flex-start" : "center"} gap={space[3]} py={12} bg={pressed ? "$surfaceSunken" : "$canvas"} borderTopWidth={first ? 0 : 1} borderColor="$line">
            <AccountIcon type={account.accountType} />
            <YStack flex={1} minW={0} gap={2}>
              <FText numberOfLines={stacked ? undefined : 1} style={{ fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21, letterSpacing: -0.15 }}>
                {account.name}
              </FText>
              <FText tone="inkFaint" numberOfLines={stacked ? undefined : 1} style={{ fontSize: 13, lineHeight: 18 }}>
                {typeLabel}
              </FText>
              {stacked ? <View mt={2}>{balances}</View> : null}
            </YStack>
            {stacked ? null : balances}
          </XStack>
        )}
      </Pressable>
    </SwipeActions>
  );
}

/** Carga: el título de un grupo y tres filas con el cuadro de 44. */
function ListSkeleton() {
  const { t } = useTranslation();
  return (
    <SkeletonGroup label={t("states.loading")}>
      <YStack mx={space[5]} mt={22} gap={4}>
        <SkeletonBlock width={90} height={16} rounded={6} mb={6} />
        {[0, 1, 2].map((i) => (
          <XStack key={i} items="center" gap={space[3]} py={12} borderTopWidth={i ? 1 : 0} borderColor="$line">
            <SkeletonBlock width={44} height={44} rounded={14} />
            <YStack flex={1} gap={8}>
              <SkeletonBlock width="55%" height={14} rounded={6} />
              <SkeletonBlock width="35%" height={11} rounded={6} />
            </YStack>
            <SkeletonBlock width={80} height={14} rounded={6} />
          </XStack>
        ))}
      </YStack>
    </SkeletonGroup>
  );
}
