import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarCheck, Check, ChevronDown, Plus, Repeat, Trash2 } from "@tamagui/lucide-icons-2";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack, useTheme } from "tamagui";
import { useCapabilities } from "../../src/api/capabilities";
import { financeApi } from "../../src/api/finance";
import type { PaymentOccurrence, PaymentRule } from "../../src/api/types";
import { DataStateCard } from "../../src/components/DataStateCard";
import { floatingTabBarHeight } from "../../src/components/FintTabBar";
import { OccurrencePaymentSheet } from "../../src/components/OccurrencePaymentSheet";
import { useCategoryIcons } from "../../src/finance/useCategoryIcons";
import { usePressOnce } from "../../src/hooks/usePressOnce";
import { getAppLocale } from "../../src/i18n";
import { buildPendingItems, groupHistory, groupPending, leadOccurrence, monthSummaries, type PendingGroupKey } from "../../src/payments/logic";
import { HistoryRow, PaymentRow } from "../../src/payments/PaymentRow";
import { useThemeMode } from "../../src/theme/ThemeMode";
import { radius, space } from "../../src/theme/tokens";
import { fontFace } from "../../src/theme/typography";
import { Amount, FintButton, FintCard, FintConfirmDialog, FintSheet, FText, IconButton, ListRow, PressableScale, SegmentedControl } from "../../src/ui";
import { AmountSkeleton } from "../../src/ui/AmountSkeleton";
import { useNotify } from "../../src/ui/notify";

type PaymentsTab = "pending" | "history";

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Tab Pagos v3: título con el botón para crear un pago recurrente, el resumen
 * del mes (falta pagar, barra de lo pagado, activos), Pendientes e Historial,
 * y los pendientes agrupados en Vencido, Esta semana y Más adelante.
 *
 * Conserva la lógica anterior: ocurrencias abiertas y pagadas, la hoja de pago
 * que ya existe, editar y eliminar la regla, y los períodos atrasados de una
 * misma regla en una sola fila, cada uno pagable por separado.
 */
export default function PaymentsScreen() {
  const { t, i18n } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useNotify();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { themeMode } = useThemeMode();
  const { capabilities } = useCapabilities();
  const iconFor = useCategoryIcons();
  const pressOnce = usePressOnce();

  const [tab, setTab] = useState<PaymentsTab>("pending");
  const [paymentOccurrence, setPaymentOccurrence] = useState<PaymentOccurrence | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentOccurrence | null>(null);
  const [summaryCurrency, setSummaryCurrency] = useState("");
  const [currencySheet, setCurrencySheet] = useState(false);
  const [pulling, setPulling] = useState(false);

  // El fondo de esta pantalla es `canvas`: la barra de estado va con iconos oscuros en claro.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(themeMode === "dark" ? "light" : "dark");
      return () => setStatusBarStyle("light");
    }, [themeMode]),
  );

  const openQuery = useQuery({
    queryKey: ["payment-occurrences", "open"],
    queryFn: ({ signal }) => financeApi.listPaymentOccurrences({ status: "open" }, signal),
  });
  // Los pagados alimentan el Historial y también lo pagado del resumen del mes.
  const paidQuery = useQuery({
    queryKey: ["payment-occurrences", "paid"],
    queryFn: ({ signal }) => financeApi.listPaymentOccurrences({ status: "paid" }, signal),
  });
  const rulesQuery = useQuery({ queryKey: ["payment-rules"], queryFn: financeApi.listPaymentRules });
  const accountsQuery = useQuery({
    queryKey: ["account-options", "occurrence-payment", paymentOccurrence?.currency],
    queryFn: () => financeApi.listAccountOptions({ currency: paymentOccurrence?.currency, excludeAccountType: "credit_card" }),
    enabled: Boolean(paymentOccurrence),
  });

  // Un solo "hoy" para los grupos y el resumen; se renueva cada vez que llegan datos (al volver a la pestaña o al tirar).
  const today = useMemo(() => new Date(), [openQuery.dataUpdatedAt]);
  const open = useMemo(() => openQuery.data ?? [], [openQuery.data]);
  const paid = useMemo(() => paidQuery.data ?? [], [paidQuery.data]);
  const rules = useMemo(() => new Map((rulesQuery.data ?? []).map((r) => [r.id, r])), [rulesQuery.data]);

  const groups = useMemo(() => groupPending(buildPendingItems(open), today), [open, today]);
  const history = useMemo(() => groupHistory(paid), [paid]);
  const summaries = useMemo(() => monthSummaries(open, paid, today), [open, paid, today]);
  const currencies = summaries.map((s) => s.currency);
  const summary = summaries.find((s) => s.currency === summaryCurrency) ?? summaries[0];
  const currency = summary?.currency ?? open[0]?.currency ?? "PEN";
  const activeCount = rulesQuery.data
    ? rulesQuery.data.filter((r) => r.status === "active" && r.currency === currency).length
    : new Set(open.filter((o) => o.currency === currency && o.ruleId).map((o) => o.ruleId)).size;

  const emojiFor = (rule: PaymentRule | undefined) => (rule?.category ? iconFor(rule.category, "expense") : null);

  const openCreate = () =>
    pressOnce(() =>
      capabilities.features.recurringPayments ? router.push("/debt-form") : toast.show(t("payments.disabled"), { preset: "error" }),
    );
  const openEdit = (ruleId: string) => router.push({ pathname: "/debt-form", params: { ruleId } });

  const deleteMutation = useMutation({
    mutationFn: financeApi.deletePaymentRule,
    onSuccess: async () => {
      await Promise.all(
        ["payment-rules", "payment-occurrences", "summary", "reports"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
      setDeleteTarget(null);
      toast.show(t("payments.deletedToast"), { message: t("payments.deletedMessage"), preset: "success" });
    },
    onError: () => toast.show(t("payments.deleteError"), { preset: "error" }),
  });

  // El resumen espera también a los pagados: si no, mostraría "Pagado S/ 0.00" un instante.
  const summaryLoading = openQuery.isLoading || paidQuery.isLoading;
  // Dentro de la frase el mes va en minúscula ("Falta pagar en setiembre"); en inglés, como lo da Intl.
  const monthRaw = new Intl.DateTimeFormat(locale, { month: "long" }).format(today);
  const monthName = i18n.resolvedLanguage === "en" ? monthRaw : monthRaw.toLocaleLowerCase(locale);
  const hasRules = (rulesQuery.data?.length ?? 0) > 0;

  const pendingList = groups.map((group) => (
    <YStack key={group.key}>
      <GroupHeader group={group.key} count={group.items.length} />
      <YStack px={space[4]}>
        {group.items.map((item, i) => {
          const lead = leadOccurrence(item);
          const rule = lead.ruleId ? rules.get(lead.ruleId) : undefined;
          return (
            <PaymentRow
              key={item.kind === "group" ? item.ruleId : item.occurrence.id}
              item={item}
              rule={rule}
              emoji={emojiFor(rule)}
              first={i === 0}
              last={i === group.items.length - 1}
              late={group.key === "overdue"}
              today={today}
              onPay={setPaymentOccurrence}
              onEdit={lead.ruleId ? () => openEdit(lead.ruleId!) : undefined}
              onDelete={lead.ruleId ? () => setDeleteTarget(lead) : undefined}
            />
          );
        })}
      </YStack>
    </YStack>
  ));

  const historyList = history.map((group) => (
    <YStack key={group.key}>
      <XStack px={space[4]} pt={18} pb={8}>
        <FText variant="body-strong" style={{ fontSize: 13 }}>
          {group.date ? capitalize(`${new Intl.DateTimeFormat(locale, { month: "long" }).format(group.date)} ${group.date.getFullYear()}`) : "—"}
        </FText>
      </XStack>
      <YStack px={space[4]}>
        {group.items.map((occurrence, i) => (
          <HistoryRow
            key={occurrence.id}
            occurrence={occurrence}
            emoji={emojiFor(occurrence.ruleId ? rules.get(occurrence.ruleId) : undefined)}
            first={i === 0}
            last={i === group.items.length - 1}
          />
        ))}
      </YStack>
    </YStack>
  ));

  const activeQuery = tab === "pending" ? openQuery : paidQuery;
  let body: React.ReactNode;
  // Las filas esperan también a las reglas (emoji y frecuencia) para no reacomodarse al llegar.
  if (activeQuery.isLoading || rulesQuery.isLoading) body = <ListSkeleton />;
  else if (activeQuery.error)
    body = (
      <View mx={space[4]} mt={space[4]}>
        <DataStateCard message={t("states.error")} onRetry={() => void activeQuery.refetch()} />
      </View>
    );
  else if (tab === "pending" && groups.length === 0)
    body = hasRules ? (
      <EmptyState icon={<CalendarCheck size={22} color="$flowIn" />} title={t("paymentsTab.caughtUpTitle")} hint={t("paymentsTab.caughtUpHint")} />
    ) : (
      <EmptyState
        icon={<Repeat size={22} color="$inkMuted" />}
        title={t("paymentsTab.emptyTitle")}
        action={capabilities.features.recurringPayments ? { label: t("paymentsTab.emptyAction"), onPress: openCreate } : undefined}
      />
    );
  else if (tab === "history" && history.length === 0)
    body = (
      <EmptyState icon={<CalendarCheck size={22} color="$inkMuted" />} title={t("payments.historyEmptyTitle")} hint={t("payments.historyEmptyDescription")} />
    );
  else body = tab === "pending" ? pendingList : historyList;

  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <ScrollView
        contentContainerStyle={{ paddingTop: space[2], paddingBottom: floatingTabBarHeight(insets.bottom) + space[4] }}
        refreshControl={
          <RefreshControl
            // Solo cuando la persona tira: las recargas en segundo plano no muestran spinner.
            refreshing={pulling}
            onRefresh={() => {
              setPulling(true);
              void Promise.all([openQuery.refetch(), paidQuery.refetch(), rulesQuery.refetch()]).finally(() => setPulling(false));
            }}
            tintColor={theme.brand.val}
            colors={[theme.brand.val]}
            progressBackgroundColor={theme.surface.val}
          />
        }
      >
        {/* Título y crear pago recurrente. */}
        <XStack items="center" justify="space-between" px={space[4]} gap={space[3]}>
          <FText variant="display-lg" accessibilityRole="header">
            {t("paymentsTab.title")}
          </FText>
          {capabilities.features.recurringPayments ? (
            <IconButton tone="brand" label={t("payments.newRecurring")} icon={<Plus size={20} color="$onBrand" strokeWidth={2.2} />} onPress={openCreate} />
          ) : null}
        </XStack>

        {/* Resumen del mes: lleva riel porque el total es un límite conocido. */}
        <FintCard mx={space[4]} mt={space[4]} p={space[5]}>
          <XStack items="center" justify="space-between" gap={space[3]}>
            <FText variant="label" tone="inkMuted" style={{ fontSize: 13, fontFamily: fontFace.sans[400] }}>
              {t("paymentsTab.remaining", { month: monthName })}
            </FText>
            {currencies.length > 1 ? (
              <PressableScale onPress={() => setCurrencySheet(true)} haptic="tap" accessibilityRole="button" accessibilityLabel={`${t("paymentsTab.currency")}: ${currency}`}>
                <XStack height={28} pl={10} pr={8} gap={4} items="center" rounded={radius.pill} borderWidth={1} borderColor="$lineStrong">
                  <FText variant="caption" style={{ fontFamily: fontFace.sans[600] }}>
                    {currency}
                  </FText>
                  <ChevronDown size={14} color="$ink" strokeWidth={2.2} />
                </XStack>
              </PressableScale>
            ) : null}
          </XStack>
          {summaryLoading ? (
            <View mt={8} mb={2}>
              <AmountSkeleton width={170} height={26} />
            </View>
          ) : (
            <Amount value={summary?.remaining ?? 0} currency={currency} variant="amount-lg" style={{ fontSize: 30, lineHeight: 34, letterSpacing: -1, marginTop: 2 }} />
          )}
          <View height={8} mt={16} mb={10} rounded={radius.pill} bg="$chartTrack" overflow="hidden">
            {summary && summary.total > 0 ? (
              <View width={`${Math.round((summary.paid / summary.total) * 100)}%`} height="100%" rounded={radius.pill} bg="$flowIn" />
            ) : null}
          </View>
          <XStack justify="space-between" items="center" gap={space[3]}>
            <XStack items="center" gap={4} shrink={1} flexWrap="wrap">
              <FText variant="caption" tone="inkMuted">
                {t("paymentsTab.paid")}
              </FText>
              <Amount value={summary?.paid ?? 0} currency={currency} variant="amount-sm" style={{ fontSize: 12, lineHeight: 16 }} />
              <FText variant="caption" tone="inkMuted">
                {t("paymentsTab.of")}
              </FText>
              <Amount value={summary?.total ?? 0} currency={currency} variant="amount-sm" style={{ fontSize: 12, lineHeight: 16 }} />
            </XStack>
            <FText variant="caption" tone="inkMuted">
              {t("paymentsTab.active", { count: activeCount })}
            </FText>
          </XStack>
        </FintCard>

        <View mx={space[4]} mt={space[4]}>
          <SegmentedControl
            options={[
              { value: "pending", label: t("paymentsTab.tabs.pending") },
              { value: "history", label: t("paymentsTab.tabs.history") },
            ]}
            value={tab}
            onChange={setTab}
            accessibilityLabel={t("paymentsTab.tabsLabel")}
          />
        </View>

        {body}
      </ScrollView>

      <OccurrencePaymentSheet
        accounts={accountsQuery.data ?? []}
        occurrence={paymentOccurrence}
        open={Boolean(paymentOccurrence)}
        onOpenChange={(next) => !next && setPaymentOccurrence(null)}
      />
      <FintSheet open={currencySheet} onClose={() => setCurrencySheet(false)} title={t("paymentsTab.currency")}>
        <View height={8} />
        {currencies.map((c, i) => (
          <ListRow
            key={c}
            divider={i > 0}
            title={c}
            trailing={c === currency ? <Check size={18} color="$brand" strokeWidth={2.4} /> : undefined}
            onPress={() => {
              setSummaryCurrency(c);
              setCurrencySheet(false);
            }}
          />
        ))}
      </FintSheet>
      <FintConfirmDialog
        open={Boolean(deleteTarget)}
        isPending={deleteMutation.isPending}
        title={t("payments.deleteRecurring")}
        description={t("payments.deleteDescription", { title: deleteTarget?.title ?? "" })}
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        pendingLabel={t("payments.deleting")}
        destructive
        icon={<Trash2 size={17} color="$onDanger" />}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget?.ruleId && deleteMutation.mutate(deleteTarget.ruleId)}
      />
    </YStack>
  );
}

/** "Vencido 1" en `dangerHard` con el icono de alerta; "Esta semana 2" y "Más adelante 2" en `ink`. */
function GroupHeader({ group, count }: { group: PendingGroupKey; count: number }) {
  const { t } = useTranslation();
  const late = group === "overdue";
  return (
    <XStack items="center" gap={6} px={space[4]} pt={18} pb={8} accessibilityRole="header">
      {late ? <AlertTriangle size={14} color="$dangerHard" strokeWidth={2.4} /> : null}
      <FText variant="body-strong" tone={late ? "dangerHard" : "ink"} style={{ fontSize: 13 }}>
        {t(`paymentsTab.groups.${group}`)}
      </FText>
      <FText variant="caption" tone="inkFaint" style={{ fontFamily: fontFace.mono[500] }}>
        {String(count)}
      </FText>
    </XStack>
  );
}

function EmptyState({ icon, title, hint, action }: { icon: React.ReactNode; title: string; hint?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <YStack items="center" gap={space[3]} px={space[6]} pt={space[8]}>
      <View width={52} height={52} rounded={999} bg="$surfaceSunken" items="center" justify="center">
        {icon}
      </View>
      <FText variant="heading" style={{ textAlign: "center" }}>
        {title}
      </FText>
      {hint ? (
        <FText variant="body" tone="inkMuted" style={{ textAlign: "center" }}>
          {hint}
        </FText>
      ) : null}
      {action ? (
        <FintButton icon={<Plus size={16} />} onPress={action.onPress}>
          {action.label}
        </FintButton>
      ) : null}
    </YStack>
  );
}

function ListSkeleton() {
  return (
    <YStack px={space[4]} pt={18} gap={8}>
      <AmountSkeleton width={110} height={14} />
      <YStack rounded={radius.lg} borderWidth={1} borderColor="$line" bg="$surface" overflow="hidden">
        {[0, 1, 2].map((i) => (
          <XStack key={i} items="center" gap={space[3]} px={space[4]} py={space[3]} borderTopWidth={i ? 1 : 0} borderColor="$line">
            <View width={38} height={38} rounded={radius.md} bg="$surfaceSunken" />
            <YStack flex={1} gap={6}>
              <AmountSkeleton width={120} height={12} />
              <AmountSkeleton width={90} height={10} />
            </YStack>
            <YStack items="flex-end" gap={6}>
              <AmountSkeleton width={70} height={12} />
              <AmountSkeleton width={54} height={20} />
            </YStack>
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}
