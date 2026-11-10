import { ChevronLeft, ChevronRight, Lock, Pencil, Plus, Search, Tag, Trash2, X } from "@tamagui/lucide-icons-2";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, View, XStack, YStack } from "tamagui";
import { financeApi } from "../src/api/finance";
import type { Category, TransactionType } from "../src/api/types";
import { isSystemCategory, sortByUsage, usageFromTransactions, type CategoryUsage } from "../src/categories/logic";
import { CreateCategorySheet } from "../src/components/CreateCategorySheet";
import { DataStateCard } from "../src/components/DataStateCard";
import { suggestedCategoryIcons } from "../src/finance/categoryIcons";
import { getCategoryLabel } from "../src/finance/categoryLabels";
import { spendingRange } from "../src/home/spending";
import { SkeletonBlock, SkeletonGroup } from "../src/components/Skeleton";
import { COMPACT_FONT_SCALE, space } from "../src/theme/tokens";
import { fontFace } from "../src/theme/typography";
import { useScreenStatusBar } from "../src/theme/useScreenStatusBar";
import { Amount, FintButton, FintSheet, FintSpinner, FText, IconButton, Monogram, SegmentedControl, SheetField, SheetTextInput, useNotify } from "../src/ui";
import { SwipeActions, type SwipeAction } from "../src/ui/SwipeActions";

const SEARCH_FROM = 8;
const SHEET_UNMOUNT_MS = 600;
type Row = { category: Category; label: string; usage: CategoryUsage | null };

/**
 * Categorías (marca D, K-06): volver, "Categorías" y el botón amarillo que crea con el tipo de la pestaña;
 * Egresos | Ingresos con su cantidad en `mono`; el buscador si son más de ocho; y una fila a todo el ancho por
 * categoría: su emoji en el cuadro de 44 sobre `categoryTint` de su tono, el nombre y lo que movió en el mes
 * (egresos e ingresos, sumado en la app). Las del sistema llevan el candado. Orden por uso del mes y, las no
 * usadas, por nombre. Tocar una fila la edita; deslizarla ofrece Editar y Eliminar, salvo en las del sistema.
 */
export default function CategoriesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const notify = useNotify();
  const queryClient = useQueryClient();
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

  useScreenStatusBar();
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
            tintColor={theme.ink.val}
            colors={[theme.ink.val]}
            progressBackgroundColor={theme.surface.val}
          />
        }
      >
        <XStack items="center" px={space[5]} gap={10}>
          <IconButton label={t("settingsScreen.back")} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
          <FText accessibilityRole="header" maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ ...SCREEN_TITLE, flex: 1 }} numberOfLines={2}>
            {t("categories.routeTitle")}
          </FText>
          {/* "Nueva categoría" en amarillo; desde 1.3 queda solo el ícono para que el título no se parta en tres. */}
          {fontScale >= COMPACT_FONT_SCALE ? (
            <IconButton label={t("categoriesScreen.newCategory")} tone="brand" icon={<Plus size={20} color="$onBrand" strokeWidth={2.2} />} onPress={openCreate} />
          ) : (
            <FintButton size="mini" px={14} icon={<Plus size={16} color="$onBrand" strokeWidth={2.4} />} onPress={openCreate}>
              {t("categoriesScreen.newCategory")}
            </FintButton>
          )}
        </XStack>
        <FText tone="inkMuted" style={{ paddingHorizontal: space[5], paddingTop: 4, fontSize: 15, lineHeight: 22 }}>
          {t("categoriesScreen.intro")}
        </FText>

        <View mx={space[5]} mt={space[4]}>
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
          <View mx={space[5]} mt={space[3]}>
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
          <View mx={space[5]} mt={space[4]}>
            <DataStateCard message={t("categories.loadError")} onRetry={() => void categoriesQuery.refetch()} />
          </View>
        ) : null}

        {categoriesQuery.isLoading ? (
          <ListSkeleton />
        ) : categoriesQuery.isSuccess && counts[type] === 0 ? (
          <YStack items="center" gap={10} mx={space[6]} mt={40}>
            <View width={64} height={64} rounded={20} bg="$surface" items="center" justify="center">
              <Tag size={26} color="$ink" strokeWidth={2} />
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
            <YStack mx={space[5]} mt={6}>
              {list.map((row, i) => (
                <CategoryRow
                  key={row.category.id}
                  row={row}
                  currency={currency}
                  first={i === 0}
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
              <FText variant="caption" tone="inkFaint" style={{ textAlign: "center", paddingHorizontal: space[5], paddingTop: 14 }}>
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
            <View width={60} height={60} rounded={20} bg="$dangerWash" items="center" justify="center">
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
                pending={deleteMutation.isPending}
                onPress={() => deleteMutation.mutate(deleteMounted.id)}
              >
                {deleteMutation.isPending ? <FintSpinner color="$onDanger" /> : t("categories.deleteConfirm")}
              </FintButton>
              <FintButton variant="soft" pending={deleteMutation.isPending} onPress={() => setDeleteTarget(null)}>
                {t("actions.cancel")}
              </FintButton>
            </YStack>
          </YStack>
        </FintSheet>
      ) : null}
    </YStack>
  );
}

/** Título de pantalla secundaria (marca D): 26 en Figtree Bold, tope 1.3 y hasta dos líneas. */
const SCREEN_TITLE = { fontFamily: fontFace.display[700], fontSize: 26, lineHeight: 31, letterSpacing: -0.6 } as const;

function CategoryRow({
  row,
  currency,
  first,
  onEdit,
  onDelete,
}: {
  row: Row;
  currency?: string;
  first: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const { category, label, usage } = row;
  const system = isSystemCategory(category);
  const emoji = category.icon || suggestedCategoryIcons(category.name, category.type)[0];
  const actions: SwipeAction[] = [
    { key: "edit", label: t("actions.edit"), icon: <Pencil size={18} color="$canvas" />, tone: "ink", run: onEdit },
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
        <XStack items={fontScale >= COMPACT_FONT_SCALE ? "flex-start" : "center"} gap={space[3]} py={11} minH={66} bg={pressed ? "$surfaceSunken" : "$canvas"} borderTopWidth={first ? 0 : 1} borderColor="$line">
          {/* El emoji en el cuadro de 44 sobre `categoryTint` de su propio tono; sin emoji, la inicial sobre `surface`. Desde 1.3 el cuadro va arriba, junto al nombre. */}
          <Monogram name={label} emoji={emoji} size={44} />
          <YStack flex={1} minW={0} gap={2}>
            <FText style={{ fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21, letterSpacing: -0.15 }}>{label}</FText>
            {usage && usage.count > 0 && currency ? (
              <XStack items="baseline" gap={4} flexWrap="wrap">
                <Amount value={usage.amount} currency={currency} variant="amount-sm" tone="inkMuted" style={{ fontFamily: fontFace.mono[600], fontSize: 13 }} />
                <FText tone="inkFaint" style={{ fontSize: 13, lineHeight: 18 }}>
                  {t("categoriesScreen.thisMonth")} · {t("categoriesScreen.movements", { count: usage.count })}
                </FText>
              </XStack>
            ) : (
              <FText tone="inkFaint" style={{ fontSize: 13, lineHeight: 18 }}>
                {t("categoriesScreen.noUsage")}
              </FText>
            )}
            {/* Las del sistema: candado y la palabra, en `inkFaint`. */}
            {system ? (
              <XStack items="center" gap={4}>
                <Lock size={12} color="$inkFaint" strokeWidth={2.4} />
                <FText tone="inkFaint" style={{ fontFamily: fontFace.sans[600], fontSize: 12, lineHeight: 16 }}>
                  {t("categoriesScreen.system")}
                </FText>
              </XStack>
            ) : null}
          </YStack>
          <ChevronRight size={18} color="$inkFaint" strokeWidth={2} />
        </XStack>
      )}
    </Pressable>
  );

  // Las del sistema no se eliminan: sin acciones de deslizar.
  return system ? content : <SwipeActions actions={actions}>{content}</SwipeActions>;
}

/** Carga: la forma de las filas, con el cuadro de 44 y dos barras. */
function ListSkeleton() {
  const { t } = useTranslation();
  return (
    <SkeletonGroup label={t("states.loading")}>
      <YStack mx={space[5]} mt={6}>
        {[0, 1, 2, 3, 4].map((i) => (
          <XStack key={i} items="center" gap={space[3]} py={11} minH={66} borderTopWidth={i ? 1 : 0} borderColor="$line">
            <SkeletonBlock width={44} height={44} rounded={14} />
            <YStack flex={1} gap={8}>
              <SkeletonBlock width="50%" height={14} rounded={6} />
              <SkeletonBlock width="70%" height={11} rounded={6} />
            </YStack>
          </XStack>
        ))}
      </YStack>
    </SkeletonGroup>
  );
}
