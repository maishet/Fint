import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Tag, Trash2, X } from "@tamagui/lucide-icons-2";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, Text as RNText } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, View, XStack, YStack } from "tamagui";
import { financeApi } from "../src/api/finance";
import type { Category, TransactionType } from "../src/api/types";
import { isSystemCategory, sortByUsage, usageFromTransactions, type CategoryUsage } from "../src/categories/logic";
import { CreateCategorySheet } from "../src/components/CreateCategorySheet";
import { DataStateCard } from "../src/components/DataStateCard";
import { suggestedCategoryIcons } from "../src/finance/categoryIcons";
import { getCategoryLabel } from "../src/finance/categoryLabels";
import { categoryColorIndex, spendingRange } from "../src/home/spending";
import { useThemeMode } from "../src/theme/ThemeMode";
import { radius, space } from "../src/theme/tokens";
import { Amount, FintButton, FintSheet, FintSpinner, FText, IconButton, SegmentedControl, SheetField, SheetTextInput, useNotify } from "../src/ui";
import { AmountSkeleton } from "../src/ui/AmountSkeleton";
import { GroupedCell } from "../src/ui/GroupedCell";
import { SwipeActions, type SwipeAction } from "../src/ui/SwipeActions";

const SEARCH_FROM = 8;
const SHEET_UNMOUNT_MS = 600;
type Row = { category: Category; label: string; usage: CategoryUsage | null };

/**
 * Categorías v3 (GestionCategorias): volver, "Categorías" y el botón `brand`
 * que crea con el tipo de la pestaña; Egresos | Ingresos con su cantidad en
 * `mono`; el buscador si son más de ocho; y una tarjeta con una fila por
 * categoría: su emoji en el disco de 40px, el nombre y lo que movió en el mes
 * (egresos e ingresos, sumado en la app). Orden por uso del mes y, las no
 * usadas, por nombre. Tocar una fila la edita; deslizarla ofrece Editar y
 * Eliminar, salvo en las del sistema.
 */
export default function CategoriesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { themeMode } = useThemeMode();
  const [type, setType] = useState<TransactionType>("expense");
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteMounted, setDeleteMounted] = useState<Category | null>(null);
  const [pulling, setPulling] = useState(false);
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: () => financeApi.listCategories() });
  // El uso del mes de cada egreso, en la moneda principal (la misma del Inicio): no se suman monedas. Se suma desde
  // los egresos con la misma consulta (y caché) que la serie de gasto del Inicio.
  const overviewQuery = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: ({ signal }) => financeApi.getDashboardOverview(undefined, signal),
  });
  const currency = overviewQuery.data?.currency;
  const range = spendingRange();
  const monthTxQuery = useQuery({
    queryKey: ["dashboard", "spending-series", range.from, range.to],
    queryFn: () => financeApi.listAllTransactions({ from: range.from, to: range.to, type: "expense" }),
    staleTime: 60_000,
  });
  // Los ingresos del mes, para la pestaña Ingresos: se piden al abrirla. Cuelgan de "dashboard" para que registrar un
  // movimiento los refresque, como al resto del Inicio.
  const incomeTxQuery = useQuery({
    queryKey: ["dashboard", "income-series", range.from, range.to],
    queryFn: () => financeApi.listAllTransactions({ from: range.from, to: range.to, type: "income" }),
    staleTime: 60_000,
    enabled: type === "income",
  });

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(themeMode === "dark" ? "light" : "dark");
      return () => setStatusBarStyle("light");
    }, [themeMode]),
  );
  useEffect(() => {
    if (deleteTarget) return;
    const id = setTimeout(() => setDeleteMounted(null), SHEET_UNMOUNT_MS);
    return () => clearTimeout(id);
  }, [deleteTarget]);

  const all = categoriesQuery.data ?? [];
  const counts = { expense: all.filter((c) => c.type === "expense").length, income: all.filter((c) => c.type === "income").length };
  const needle = query.trim().toLocaleLowerCase();
  // El mes de hoy ("2026-09"): `range.to` es mañana y el último día del mes daría el siguiente.
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const txs = type === "income" ? incomeTxQuery.data : monthTxQuery.data;
  const usage = useMemo(
    () => (currency && txs ? usageFromTransactions(txs, currency, month, type) : new Map<string, CategoryUsage>()),
    [currency, txs, month, type],
  );
  const list: Row[] = useMemo(
    () =>
      sortByUsage(
        all
          .filter((c) => c.type === type)
          .map((c) => ({
            category: c,
            label: getCategoryLabel(c.name, t),
            usage: usage.get(c.name.trim().toLowerCase()) ?? null,
          }))
          .filter((row) => !needle || row.label.toLocaleLowerCase().includes(needle)),
      ),
    [all, type, needle, t, usage],
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financeApi.deleteCategory(id),
    onSuccess: async () => {
      setDeleteTarget(null);
      await Promise.all(["categories", "dashboard", "reports", "transactions"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      notify.success(t("categories.deletedToast"), { message: t("categories.deletedMessage") });
    },
    onError: (error) => notify.error(t("categories.deleteError"), { message: error instanceof Error ? error.message : t("states.error") }),
  });

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (category: Category) => {
    setEditing(category);
    setEditorOpen(true);
  };
  const askDelete = (category: Category) => {
    setEditorOpen(false);
    setDeleteMounted(category);
    setDeleteTarget(category);
  };

  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <ScrollView
        contentContainerStyle={{ paddingTop: space[2], paddingBottom: insets.bottom + space[8] }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => {
              setPulling(true);
              void Promise.all([categoriesQuery.refetch(), type === "income" ? incomeTxQuery.refetch() : monthTxQuery.refetch()]).finally(() =>
                setPulling(false),
              );
            }}
            tintColor={theme.brand.val}
            colors={[theme.brand.val]}
            progressBackgroundColor={theme.surface.val}
          />
        }
      >
        <XStack items="center" px={space[4]} gap={space[3]}>
          <IconButton label={t("settingsScreen.back")} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
          <FText variant="title" accessibilityRole="header" style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.5, flex: 1 }} numberOfLines={1}>
            {t("categories.routeTitle")}
          </FText>
          <IconButton
            tone="brand"
            label={t("categoriesScreen.newCategory")}
            icon={<Plus size={20} color="$onBrand" strokeWidth={2.2} />}
            onPress={openCreate}
          />
        </XStack>
        <FText variant="label" tone="inkMuted" style={{ paddingHorizontal: space[4], paddingTop: 6, lineHeight: 19 }}>
          {t("categoriesScreen.intro")}
        </FText>

        <View mx={space[4]} mt={space[4]}>
          <SegmentedControl
            options={[
              { value: "expense" as const, label: t("categoriesScreen.expenses"), count: categoriesQuery.isSuccess ? counts.expense : undefined },
              { value: "income" as const, label: t("categoriesScreen.incomes"), count: categoriesQuery.isSuccess ? counts.income : undefined },
            ]}
            value={type}
            onChange={(next) => {
              setType(next);
              setQuery("");
            }}
          />
        </View>

        {counts[type] > SEARCH_FROM ? (
          <View mx={space[4]} mt={space[3]}>
            <SheetField focused={searchFocused}>
              <Search size={18} color="$inkFaint" strokeWidth={2} />
              <SheetTextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t("movementForm.categorySheet.search")}
                accessibilityLabel={t("movementForm.categorySheet.search")}
                returnKeyType="search"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              {query ? (
                <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("movementForm.clearSearch")}>
                  <X size={16} color="$inkFaint" />
                </Pressable>
              ) : null}
            </SheetField>
          </View>
        ) : null}

        {categoriesQuery.error ? (
          <View mx={space[4]} mt={space[4]}>
            <DataStateCard message={t("categories.loadError")} onRetry={() => void categoriesQuery.refetch()} />
          </View>
        ) : null}

        {categoriesQuery.isLoading ? (
          <ListSkeleton />
        ) : categoriesQuery.isSuccess && counts[type] === 0 ? (
          <YStack items="center" gap={10} mx={space[6]} mt={40}>
            <View width={64} height={64} rounded={999} bg="$brandWash" items="center" justify="center">
              <Tag size={26} color="$brand" strokeWidth={2} />
            </View>
            <FText variant="section-title" style={{ textAlign: "center", marginTop: 6 }}>
              {type === "income" ? t("categoriesScreen.emptyIncomeTitle") : t("categoriesScreen.emptyExpenseTitle")}
            </FText>
            <FText tone="inkMuted" style={{ textAlign: "center", fontSize: 14, lineHeight: 20, maxWidth: 270 }}>
              {type === "income" ? t("categoriesScreen.emptyIncomeBody") : t("categoriesScreen.emptyExpenseBody")}
            </FText>
            <View width={240} mt={10}>
              <FintButton icon={<Plus size={18} color="$onBrand" strokeWidth={2.2} />} onPress={openCreate}>
                {t("categoriesScreen.newCategory")}
              </FintButton>
            </View>
          </YStack>
        ) : (
          <>
            <YStack mx={space[4]} mt={14}>
              {list.map((row, i) => (
                <CategoryRow
                  key={row.category.id}
                  row={row}
                  currency={currency}
                  first={i === 0}
                  last={i === list.length - 1}
                  onEdit={() => openEdit(row.category)}
                  onDelete={() => askDelete(row.category)}
                />
              ))}
              {needle && list.length === 0 ? (
                <FText variant="label" tone="inkFaint" style={{ textAlign: "center", marginTop: space[4] }}>
                  {t("movementForm.categorySheet.empty")}
                </FText>
              ) : null}
            </YStack>
            {list.length ? (
              <FText variant="caption" tone="inkFaint" style={{ textAlign: "center", paddingHorizontal: space[4], paddingTop: 14 }}>
                {t("categoriesScreen.footer")}
              </FText>
            ) : null}
          </>
        )}
      </ScrollView>

      <CreateCategorySheet
        initialType={type}
        category={editing}
        open={editorOpen}
        onDelete={editing && !isSystemCategory(editing) ? askDelete : undefined}
        onOpenChange={(next) => {
          setEditorOpen(next);
          if (!next) setEditing(null);
        }}
      />

      {/* Confirmar eliminar: la misma hoja que eliminar un movimiento. */}
      {deleteMounted ? (
        <FintSheet open={Boolean(deleteTarget)} onClose={() => !deleteMutation.isPending && setDeleteTarget(null)}>
          <YStack items="center" px={space[5]} pt={space[4]}>
            <View width={56} height={56} rounded={999} bg="$red2" items="center" justify="center">
              <Trash2 size={24} color="$dangerHard" strokeWidth={2} />
            </View>
            <FText variant="title" style={{ fontSize: 22, lineHeight: 28, marginTop: 14, textAlign: "center" }}>
              {t("categories.deleteTitle")}
            </FText>
            <FText tone="inkMuted" style={{ fontSize: 14, lineHeight: 21, marginTop: 6, textAlign: "center" }}>
              {t("categories.deleteDescription", { name: getCategoryLabel(deleteMounted.name, t) })}
            </FText>
            <YStack self="stretch" gap={10} mt={22}>
              <FintButton
                variant="danger"
                haptic="warning"
                disabled={deleteMutation.isPending}
                onPress={() => deleteMutation.mutate(deleteMounted.id)}
              >
                {deleteMutation.isPending ? <FintSpinner color="$onDanger" /> : t("categories.deleteConfirm")}
              </FintButton>
              <FintButton variant="ghost" bg="$surfaceSunken" color="$ink" disabled={deleteMutation.isPending} onPress={() => setDeleteTarget(null)}>
                {t("actions.cancel")}
              </FintButton>
            </YStack>
          </YStack>
        </FintSheet>
      ) : null}
    </YStack>
  );
}

function CategoryRow({
  row,
  currency,
  first,
  last,
  onEdit,
  onDelete,
}: {
  row: Row;
  currency?: string;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { category, label, usage } = row;
  const system = isSystemCategory(category);
  const emoji = category.icon || suggestedCategoryIcons(category.name, category.type)[0];
  const actions: SwipeAction[] = [
    { key: "edit", label: t("actions.edit"), icon: <Pencil size={18} color="$ink" />, tone: "neutral", run: onEdit },
    { key: "delete", label: t("actions.delete"), icon: <Trash2 size={18} color="$onDanger" />, tone: "danger", run: onDelete },
  ];

  const content = (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={t("categories.editAccessibility", { name: label })}
      accessibilityActions={system ? undefined : actions.map((a) => ({ name: a.key, label: a.label }))}
      onAccessibilityAction={(e) => actions.find((a) => a.key === e.nativeEvent.actionName)?.run()}
    >
      {({ pressed }) => (
        <XStack items="center" gap={space[3]} px={space[4]} py={12} minH={64} bg={pressed ? "$surfaceSunken" : "$surface"}>
          {/* El emoji en el disco neutro de 40px; sin emoji, la inicial en su color de la rampa. */}
          <View width={40} height={40} rounded={999} bg="$surfaceSunken" items="center" justify="center">
            {emoji ? (
              <RNText style={{ fontSize: 19, lineHeight: 24, includeFontPadding: false }}>{emoji}</RNText>
            ) : (
              <FText variant="body-strong" tone={`chart${categoryColorIndex(category.name)}` as never}>
                {label.charAt(0).toUpperCase()}
              </FText>
            )}
          </View>
          <YStack flex={1} minW={0}>
            <FText variant="body-strong" numberOfLines={1} style={{ letterSpacing: -0.15 }}>
              {label}
            </FText>
            {system ? (
              <FText variant="caption" tone="inkFaint" numberOfLines={1}>
                {t("categoriesScreen.system")}
              </FText>
            ) : usage && usage.count > 0 && currency ? (
              <XStack items="center" gap={4}>
                <Amount value={usage.amount} currency={currency} variant="figure-caption" tone="inkMuted" style={{ fontSize: 12 }} />
                <FText variant="caption" tone="inkFaint" numberOfLines={1}>
                  {t("categoriesScreen.thisMonth")} · {t("categoriesScreen.movements", { count: usage.count })}
                </FText>
              </XStack>
            ) : (
              <FText variant="caption" tone="inkFaint" numberOfLines={1}>
                {t("categoriesScreen.noUsage")}
              </FText>
            )}
          </YStack>
          <ChevronRight size={16} color="$inkFaint" strokeWidth={2} />
        </XStack>
      )}
    </Pressable>
  );

  return (
    <GroupedCell first={first} last={last}>
      {/* Las del sistema no se eliminan: sin acciones de deslizar. */}
      {system ? content : <SwipeActions actions={actions}>{content}</SwipeActions>}
    </GroupedCell>
  );
}

function ListSkeleton() {
  return (
    <YStack mx={space[4]} mt={14} rounded={radius.lg} borderWidth={1} borderColor="$line" bg="$surface" overflow="hidden">
      {[0, 1, 2, 3, 4].map((i) => (
        <XStack key={i} items="center" gap={space[3]} px={space[4]} py={12} minH={64} borderTopWidth={i ? 1 : 0} borderColor="$line">
          <View width={40} height={40} rounded={999} bg="$surfaceSunken" />
          <YStack gap={8}>
            <AmountSkeleton width={130} height={12} />
            <AmountSkeleton width={170} height={9} />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}
