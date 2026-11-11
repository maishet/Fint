import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Check, ChevronDown, Plus, Trash2 } from "@tamagui/lucide-icons-2";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
import { COMPACT_FONT_SCALE, radius, space } from "../../src/theme/tokens";
import { fontFace } from "../../src/theme/typography";
import { useScreenStatusBar } from "../../src/theme/useScreenStatusBar";
import { Amount, FintButton, FintConfirmDialog, FintLottie, FintSheet, FText, IconButton, ListRow, PressableScale, SegmentedControl } from "../../src/ui";
import { AmountSkeleton } from "../../src/ui/AmountSkeleton";
import { useNotify } from "../../src/ui/notify";

type PaymentsTab = "pending" | "history";

const PILE_SIZE = 76;
const SUMMARY_SIZE = 44;
const SUMMARY_LINE = 52;
/** Título de pestaña de la marca D: 32, como Movimientos y Reportes. */
const TAB_TITLE = { fontFamily: fontFace.display[700], fontSize: 32, lineHeight: 38, letterSpacing: -0.9 } as const;
/** Monedas del resumen: cada una es un doceavo del total del mes. */
const COINS = 12;

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Tab Pagos (marca D, F-06): título a 32 con el botón para crear un pago
 * recurrente, el resumen del mes (falta pagar, las monedas de lo pagado,
 * activos), la semana con un punto amarillo en los días que vence algo,
 * Pendientes e Historial, y los pendientes agrupados en Vencido, Esta semana y
 * Más adelante, en filas a todo el ancho.
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
  const { capabilities } = useCapabilities();
  const iconFor = useCategoryIcons();
  const pressOnce = usePressOnce();

  const [tab, setTab] = useState<PaymentsTab>("pending");
  const [paymentOccurrence, setPaymentOccurrence] = useState<PaymentOccurrence | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentOccurrence | null>(null);
  const [summaryCurrency, setSummaryCurrency] = useState("");
  const [currencySheet, setCurrencySheet] = useState(false);
  const [pulling, setPulling] = useState(false);

  useScreenStatusBar();

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
      <YStack px={space[5]}>
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
      <XStack px={space[5]} pt={18} pb={2}>
        <FText accessibilityRole="header" maxFontSizeMultiplier={1.5} style={{ fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21 }}>
          {group.date ? capitalize(`${new Intl.DateTimeFormat(locale, { month: "long" }).format(group.date)} ${group.date.getFullYear()}`) : "—"}
        </FText>
      </XStack>
      <YStack px={space[5]}>
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
      <EmptyState icon={<FintLottie name="coin-stack" size={PILE_SIZE} play={["build", "shine"]} loop="breathe" />} bare title={t("paymentsTab.caughtUpTitle")} hint={t("paymentsTab.caughtUpHint")} />
    ) : (
      <EmptyState
        icon={<FintLottie name="coin-stack" size={PILE_SIZE} loop="breathe" />}
        bare
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
        {/* Título a 32 (como las demás pestañas) y crear pago recurrente. */}
        <XStack items="center" justify="space-between" px={space[5]} gap={space[3]}>
          <FText accessibilityRole="header" maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={TAB_TITLE}>
            {t("paymentsTab.title")}
          </FText>
          {capabilities.features.recurringPayments ? (
            <IconButton label={t("payments.newRecurring")} icon={<Plus size={20} color="$ink" strokeWidth={2.2} />} onPress={openCreate} />
          ) : null}
        </XStack>

        {/* Resumen del mes (F-06): lo que falta pagar a 44 con la moneda al lado, una moneda por cada doceavo de lo
            pagado y la línea "Pagado … de …, N activos". */}
        <YStack mx={space[5]} mt={space[2]}>
          <XStack items="flex-end" justify="space-between" gap={space[3]}>
            <YStack gap={2} shrink={1}>
              <FText tone="inkMuted" style={{ fontSize: 14, lineHeight: 19 }}>
                {t("paymentsTab.remaining", { month: monthName })}
              </FText>
              {summaryLoading ? (
                <View mt={6} mb={4}>
                  <AmountSkeleton width={210} height={38} />
                </View>
              ) : (
                <Amount value={summary?.remaining ?? 0} currency={currency} variant="amount-hero" style={{ fontSize: SUMMARY_SIZE, lineHeight: SUMMARY_LINE, letterSpacing: -1 }} />
              )}
            </YStack>
            {currencies.length > 1 ? (
              <PressableScale onPress={() => setCurrencySheet(true)} haptic="tap" hitSlop={6} accessibilityRole="button" accessibilityLabel={`${t("paymentsTab.currency")}: ${currency}`}>
                <XStack height={32} pl={12} pr={10} gap={4} items="center" rounded={radius.pill} bg="$surface" mb={8}>
                  <FText maxFontSizeMultiplier={COMPACT_FONT_SCALE} style={{ fontFamily: fontFace.display[700], fontSize: 13, lineHeight: 18 }}>
                    {currency}
                  </FText>
                  <ChevronDown size={14} color="$ink" strokeWidth={2.2} />
                </XStack>
              </PressableScale>
            ) : null}
          </XStack>
          <PaidCoins paid={summary?.paid ?? 0} total={summary?.total ?? 0} />
          <XStack items="center" gap={4} flexWrap="wrap" mt={8}>
            <FText tone="inkFaint" style={{ fontSize: 13, lineHeight: 18 }}>
              {t("paymentsTab.paid")}
            </FText>
            <Amount value={summary?.paid ?? 0} currency={currency} variant="amount-sm" style={{ fontFamily: fontFace.mono[600], fontSize: 13, lineHeight: 18 }} />
            <FText tone="inkFaint" style={{ fontSize: 13, lineHeight: 18 }}>
              {t("paymentsTab.of")}
            </FText>
            <Amount value={summary?.total ?? 0} currency={currency} variant="amount-sm" tone="inkMuted" style={{ fontSize: 13, lineHeight: 18 }} />
            <FText tone="inkFaint" style={{ fontSize: 13, lineHeight: 18 }}>
              {`· ${t("paymentsTab.active", { count: activeCount })}`}
            </FText>
          </XStack>
        </YStack>

        <WeekStrip open={open} today={today} locale={locale} />

        <View mx={space[5]} mt={space[4]}>
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
            trailing={c === currency ? <Check size={18} color="$ink" strokeWidth={2.4} /> : undefined}
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

/** "Vencido 1", "Esta semana 2" y "Más adelante 2" a 16 en tinta, con la cantidad en `mono`: lo vencido se marca en cada fila. */
function GroupHeader({ group, count }: { group: PendingGroupKey; count: number }) {
  const { t } = useTranslation();
  return (
    <XStack items="baseline" gap={6} px={space[5]} pt={18} pb={2} accessibilityRole="header">
      <FText maxFontSizeMultiplier={1.5} style={{ fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21 }}>
        {t(`paymentsTab.groups.${group}`)}
      </FText>
      <FText tone="inkFaint" maxFontSizeMultiplier={1.5} style={{ fontFamily: fontFace.mono[500], fontSize: 13, lineHeight: 18 }}>
        {String(count)}
      </FText>
    </XStack>
  );
}

/**
 * Lo pagado del mes en monedas (F-06): doce monedas, cada una un doceavo del total; las pagadas en amarillo con su
 * canto, las que faltan en `surface` con filete. Es decorativo: la línea de abajo dice los montos.
 */
function PaidCoins({ paid, total }: { paid: number; total: number }) {
  const filled = total > 0 ? Math.min(COINS, Math.round((paid / total) * COINS)) : 0;
  return (
    <XStack gap={6} mt={12} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: COINS }, (_, i) => (
        <View
          key={i}
          width={20}
          height={20}
          rounded={999}
          bg={i < filled ? "$brand" : "$surface"}
          borderWidth={i < filled ? 0 : 1.5}
          borderColor="$line"
          style={i < filled ? { boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.18)" } : undefined}
        />
      ))}
    </XStack>
  );
}

/**
 * La semana de hoy (F-06): de lunes a domingo, la inicial, el número y un punto amarillo en los días en que vence un
 * pago pendiente; hoy va en tinta. Solo informa: cada día se lee con su fecha y, si corresponde, "con pagos".
 */
function WeekStrip({ open, today, locale }: { open: readonly PaymentOccurrence[]; today: Date; locale: string }) {
  const { t } = useTranslation();
  const letters = t("movementForm.dateSheet.weekdays").split(",");
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const dueDays = new Set(open.map((o) => o.dueDate?.slice(0, 10)).filter(Boolean));
  const dayLabel = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return (
    <XStack mx={space[5]} mt={16} gap={4}>
      {letters.map((letter, i) => {
        const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        const isToday = day.getDate() === today.getDate() && day.getMonth() === today.getMonth();
        const due = dueDays.has(iso(day));
        return (
          <YStack
            key={i}
            flex={1}
            py={8}
            gap={6}
            items="center"
            rounded={16}
            bg={isToday ? "$ink" : "transparent"}
            accessible
            accessibilityLabel={due ? `${dayLabel.format(day)}, ${t("movementForm.dateSheet.withMovements")}` : dayLabel.format(day)}
          >
            <FText color={isToday ? "$canvas" : "$inkFaint"} maxFontSizeMultiplier={1.3} style={{ fontFamily: fontFace.display[700], fontSize: 11, lineHeight: 14 }}>
              {letter}
            </FText>
            <FText color={isToday ? "$canvas" : "$ink"} maxFontSizeMultiplier={1.3} style={{ fontFamily: fontFace.mono[600], fontSize: 17, lineHeight: 22 }}>
              {String(day.getDate())}
            </FText>
            <View width={6} height={6} rounded={999} bg={due ? "$brand" : "transparent"} />
          </YStack>
        );
      })}
    </XStack>
  );
}

function EmptyState({ icon, bare = false, title, hint, action }: { icon: React.ReactNode; bare?: boolean; title: string; hint?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <YStack items="center" gap={space[3]} px={space[6]} pt={space[8]}>
      {bare ? (
        icon
      ) : (
        <View width={52} height={52} rounded={999} bg="$surfaceSunken" items="center" justify="center">
          {icon}
        </View>
      )}
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

/** Esqueleto con la forma de las filas de F-06: a todo el ancho, el cuadro de 44 y el texto. */
function ListSkeleton() {
  return (
    <YStack px={space[5]} pt={18} gap={8}>
      <AmountSkeleton width={110} height={14} />
      <YStack>
        {[0, 1, 2].map((i) => (
          <XStack key={i} items="center" gap={space[3]} py={14} borderTopWidth={i ? 1 : 0} borderColor="$line">
            <View width={44} height={44} rounded={14} bg="$surface" />
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
