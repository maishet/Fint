import { useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Check, CheckCheck, ChevronLeft, Inbox, Mail, Receipt, Shield, TrendingUp, TriangleAlert } from "@tamagui/lucide-icons-2";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack, useTheme } from "tamagui";
import { financeApi } from "../src/api/finance";
import type { NotificationPage, PaymentOccurrence, UserNotification } from "../src/api/types";
import { DataStateCard } from "../src/components/DataStateCard";
import { OccurrencePaymentSheet } from "../src/components/OccurrencePaymentSheet";
import { SwipeableRow } from "../src/components/SwipeableRow";
import type { AttentionItem } from "../src/home/attention";
import { transactionDay } from "../src/home/spending";
import { useAttention } from "../src/home/useAttention";
import { getAppLocale } from "../src/i18n";
import { formatMoney } from "../src/api/mappers";
import { getCategoryLabel } from "../src/finance/categoryLabels";
import { feedGroups, feedTime, growthPercent, namesSummary, notificationRoute, timesUsual } from "../src/notifications/logic";
import { getInstallationId } from "../src/notifications/pushNotifications";
import { NOTIFICATIONS_KEY, useNotificationsFeed } from "../src/notifications/useNotificationsFeed";
import { withAlpha } from "../src/theme/color";
import { motion, radius, space } from "../src/theme/tokens";
import { fontFace } from "../src/theme/typography";
import { useScreenStatusBar } from "../src/theme/useScreenStatusBar";
import { Amount, FintConfirmDialog, FText, IconButton, PressableScale, SegmentedControl } from "../src/ui";
import { AmountSkeleton } from "../src/ui/AmountSkeleton";
import { useNotify } from "../src/ui/notify";

const layout = LinearTransition.springify().damping(motion.springUi.damping).stiffness(motion.springUi.stiffness);

type Tab = "all" | "todo";

/**
 * Avisos (`Avisos` del design system). "Por hacer" (pagos vencidos y por vencer, movimientos por revisar, Gmail sin
 * sincronizar: lo mismo que los avisos del Inicio) y lo informativo de `GET /api/me/notifications` (consumos
 * importados de Gmail, pagos registrados), en las pestañas Todos / Por hacer. Sin ese endpoint (backend anterior),
 * solo "Por hacer" y sin pestañas. Al abrir, lo informativo se marca leído en el servidor (la campana se apaga) y los
 * puntos se quedan a la vista hasta "Marcar leídos" o la próxima visita. Un pago se resuelve con "Pagar", "Ya lo pagué"
 * (o deslizando: "Listo") o "Recordar el día que vence"; al resolverse sale con `fade` y los de abajo suben.
 */
export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const notify = useNotify();
  const queryClient = useQueryClient();
  useScreenStatusBar();
  const attention = useAttention();
  const feed = useNotificationsFeed();
  const installationQuery = useQuery({ queryKey: ["installation-id"], queryFn: getInstallationId, staleTime: Infinity });
  const accountsQuery = useQuery({ queryKey: ["account-options"], queryFn: () => financeApi.listAccountOptions() });
  const [tab, setTab] = useState<Tab>("all");
  const [paying, setPaying] = useState<PaymentOccurrence | null>(null);
  const [settling, setSettling] = useState<PaymentOccurrence | null>(null);
  const [pulling, setPulling] = useState(false);
  // Los pagos ya resueltos aquí (se ocultan al instante, antes de que vuelva la lista).
  const [resolved, setResolved] = useState<Set<string>>(() => new Set());
  // Lo que estaba sin leer al abrir: sus puntos se ven hasta "Marcar leídos" o la próxima visita.
  const [unreadShown, setUnreadShown] = useState<Set<string>>(() => new Set());
  const markedOnOpen = useRef(false);

  const refreshPayments = () => Promise.all([queryClient.invalidateQueries({ queryKey: ["payment-occurrences"] }), queryClient.invalidateQueries({ queryKey: ["dashboard"] })]);
  const hide = (id: string, hidden: boolean) =>
    setResolved((current) => {
      const next = new Set(current);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });

  // Al abrir: lo informativo queda leído en el servidor y en la caché (la campana del Inicio se apaga).
  const markAllRead = () =>
    financeApi
      .markNotificationsRead()
      .then(() =>
        queryClient.setQueryData<InfiniteData<NotificationPage>>(NOTIFICATIONS_KEY, (data) =>
          data ? { ...data, pages: data.pages.map((page) => ({ ...page, unread: 0, items: page.items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })) })) } : data,
        ),
      )
      .catch(() => undefined);
  useEffect(() => {
    if (!feed.available || markedOnOpen.current) return;
    markedOnOpen.current = true;
    const unread = feed.items.filter((item) => !item.readAt).map((item) => item.id);
    if (!unread.length) return;
    setUnreadShown(new Set(unread));
    void markAllRead();
    // Solo la primera vez que llega el feed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.available]);

  const settle = useMutation({
    mutationFn: (occurrence: PaymentOccurrence) => financeApi.settlePaymentOccurrence(occurrence.id),
    onSuccess: (_, occurrence) => {
      setSettling(null);
      hide(occurrence.id, true);
      void refreshPayments();
      notify.success(t("notificationsScreen.settled", { title: occurrence.title }), {
        action: {
          label: t("notificationsScreen.undo"),
          onPress: () => {
            hide(occurrence.id, false);
            void financeApi.unsettlePaymentOccurrence(occurrence.id).then(refreshPayments, () => notify.error(t("notificationsScreen.actionError")));
          },
        },
      });
    },
    onError: () => {
      setSettling(null);
      notify.error(t("notificationsScreen.actionError"));
    },
  });

  const snooze = useMutation({
    mutationFn: (occurrence: PaymentOccurrence) => financeApi.snoozePaymentOccurrence(occurrence.id),
    onSuccess: (_, occurrence) => {
      hide(occurrence.id, true);
      void refreshPayments();
      notify.success(t("notificationsScreen.snoozed", dayParams(occurrence.title, occurrence.dueDate, locale)), {
        action: {
          label: t("notificationsScreen.undo"),
          onPress: () => {
            hide(occurrence.id, false);
            void financeApi.unsnoozePaymentOccurrence(occurrence.id).then(refreshPayments, () => notify.error(t("notificationsScreen.actionError")));
          },
        },
      });
    },
    onError: () => notify.error(t("notificationsScreen.actionError")),
  });

  const todo = attention.items.filter((item) => !item.occurrenceId || !resolved.has(item.occurrenceId));
  const overdue = todo.filter((item) => item.kind === "overdue");
  const pending = todo.filter((item) => item.kind !== "overdue");
  const occurrenceOf = (item: AttentionItem) => attention.occurrences.find((o) => o.id === item.occurrenceId) ?? null;
  // "Ya lo pagué" y "Recordar" existen desde el backend que manda `settledAt` (aunque sea null) en cada cuota.
  const canResolve = (occurrence: PaymentOccurrence | null) => Boolean(occurrence && "settledAt" in occurrence);
  const showTabs = feed.available;
  const groups = feedGroups(feed.items);

  const card = (item: AttentionItem) => {
    const occurrence = occurrenceOf(item);
    return (
      <Animated.View key={item.key} entering={FadeIn.duration(motion.fade.duration)} exiting={FadeOut.duration(motion.fade.duration)} layout={layout}>
        {/* Deslizar a la izquierda: "Listo" (un pago se marca pagado, después de confirmar). */}
        <SwipeableRow
          enabled={canResolve(occurrence)}
          onAction={() => occurrence && setSettling(occurrence)}
          actionColor="$flowIn"
          actionLabel={t("notificationsScreen.done")}
          actionIcon={
            <XStack items="center" gap={6}>
              <Check size={20} color="$onBrand" strokeWidth={2.4} />
              <FText tone="onBrand" style={{ fontFamily: fontFace.sans[600], fontSize: 14 }}>
                {t("notificationsScreen.done")}
              </FText>
            </XStack>
          }
        >
          <NoticeCard
            item={item}
            occurrence={occurrence}
            onPay={setPaying}
            canResolve={canResolve(occurrence)}
            onSettle={setSettling}
            onSnooze={(o) => snooze.mutate(o)}
            onReview={() => router.push("/pending-movements")}
            onReconnect={() => router.push("/gmail-settings")}
          />
        </SwipeableRow>
      </Animated.View>
    );
  };

  const todoList =
    tab === "todo" || !showTabs ? (
      <>
        {overdue.length ? <Group title={t("notificationsScreen.overdueGroup")}>{overdue.map(card)}</Group> : null}
        {pending.length ? <Group title={t("notificationsScreen.pendingGroup")}>{pending.map(card)}</Group> : null}
      </>
    ) : todo.length ? (
      <Group title={t("notificationsScreen.todoGroup")}>{todo.map(card)}</Group>
    ) : null;

  const nothing = todo.length === 0 && (tab === "todo" || !showTabs || feed.items.length === 0);

  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space[6] }}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => {
              setPulling(true);
              void Promise.all([attention.refetch(), feed.refetch()]).finally(() => setPulling(false));
            }}
          />
        }
      >
        <YStack px={space[4]} pt={space[2]}>
          <XStack items="center" justify="space-between">
            <IconButton label={t("notificationsScreen.back")} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
            {unreadShown.size ? (
              <PressableScale
                onPress={() => {
                  setUnreadShown(new Set());
                  void markAllRead();
                }}
                haptic="tap"
                hitSlop={8}
                accessibilityRole="button"
              >
                <FText tone="brand" style={{ fontFamily: fontFace.sans[600], fontSize: 14, lineHeight: 19 }}>
                  {t("notificationsScreen.markRead")}
                </FText>
              </PressableScale>
            ) : null}
          </XStack>
          <FText variant="display-lg" accessibilityRole="header" style={{ marginTop: space[3] }}>
            {t("notificationsScreen.title")}
          </FText>
          {showTabs ? (
            <View mt={space[4]}>
              <SegmentedControl
                options={[
                  { value: "all" as const, label: t("notificationsScreen.tabs.all") },
                  { value: "todo" as const, label: t("notificationsScreen.tabs.todo"), count: todo.length || undefined },
                ]}
                value={tab}
                onChange={setTab}
              />
            </View>
          ) : null}
        </YStack>

        {attention.isLoading ? (
          <YStack px={space[4]} mt={space[5]} gap={10} accessibilityRole="progressbar">
            {[0, 1].map((i) => (
              <YStack key={i} p={14} gap={10} rounded={radius.lg} bg="$surface" borderWidth={1} borderColor="$line">
                <AmountSkeleton width={200} height={16} />
                <AmountSkeleton width={240} height={12} />
                <AmountSkeleton width={90} height={30} />
              </YStack>
            ))}
          </YStack>
        ) : attention.error ? (
          <YStack px={space[4]} mt={space[5]}>
            <DataStateCard message={t("notificationsScreen.loadError")} onRetry={() => void attention.refetch()} />
          </YStack>
        ) : nothing ? (
          <AllClear upcoming={attention.upcoming} onChoose={() => router.push("/settings")} />
        ) : (
          <YStack px={space[4]}>
            {todoList}
            {showTabs && tab === "all"
              ? groups.map((group) => (
                  <Group key={group.key} title={t(`notificationsScreen.feed.${group.key}`)}>
                    <YStack rounded={radius.lg} bg="$surface" borderWidth={1} borderColor="$line" overflow="hidden">
                      {group.items.map((item, i) => (
                        <FeedRow
                          key={item.id}
                          item={item}
                          first={i === 0}
                          unread={unreadShown.has(item.id)}
                          locale={locale}
                          installationId={installationQuery.data ?? null}
                          onPress={() => router.push(notificationRoute(item) as never)}
                        />
                      ))}
                    </YStack>
                  </Group>
                ))
              : null}
            {showTabs && tab === "all" && feed.hasMore ? (
              <PressableScale onPress={feed.loadMore} disabled={feed.loadingMore} accessibilityRole="button" style={{ alignSelf: "center", marginTop: space[4] }}>
                <FText tone="brand" style={{ fontFamily: fontFace.sans[600], fontSize: 14, opacity: feed.loadingMore ? 0.5 : 1 }}>
                  {t("notificationsScreen.loadMore")}
                </FText>
              </PressableScale>
            ) : null}
          </YStack>
        )}
      </ScrollView>

      <OccurrencePaymentSheet
        accounts={accountsQuery.data ?? []}
        occurrence={paying}
        open={paying !== null}
        onOpenChange={(open) => {
          if (!open) setPaying(null);
        }}
      />
      <FintConfirmDialog
        open={settling !== null}
        isPending={settle.isPending}
        title={t("notificationsScreen.settleTitle", { title: settling?.title ?? "" })}
        description={t("notificationsScreen.settleBody")}
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("notificationsScreen.settleConfirm")}
        icon={<Check size={17} color="$onBrand" strokeWidth={2.4} />}
        onCancel={() => setSettling(null)}
        onConfirm={() => settling && settle.mutate(settling)}
      />
    </YStack>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <YStack mt={space[5]} gap={10}>
      <FText variant="caption" tone="inkMuted" style={{ fontFamily: fontFace.sans[600], marginLeft: 2 }}>
        {title}
      </FText>
      {children}
    </YStack>
  );
}

/** "jueves" y "26" para "Recordar el jueves" / "no dia 26". */
function dayParams(title: string, dueDate: string | null, locale: string) {
  const day = dueDate ? transactionDay(dueDate) : null;
  const date = day ? new Date(day.y, day.m, day.d) : new Date();
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
  return { title, day: locale.startsWith("en") ? weekday : weekday.toLocaleLowerCase(locale), date: String(date.getDate()) };
}

/** Una tarjeta de "Por hacer": icono en un círculo teñido, título, detalle y los botones que lo resuelven. */
function NoticeCard({
  item,
  occurrence,
  onPay,
  canResolve,
  onSettle,
  onSnooze,
  onReview,
  onReconnect,
}: {
  item: AttentionItem;
  occurrence: PaymentOccurrence | null;
  onPay: (occurrence: PaymentOccurrence) => void;
  canResolve: boolean;
  onSettle: (occurrence: PaymentOccurrence) => void;
  onSnooze: (occurrence: PaymentOccurrence) => void;
  onReview: () => void;
  onReconnect: () => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const locale = getAppLocale(i18n.resolvedLanguage);

  let color: string = theme.signal.val;
  let icon = <Receipt size={18} color={color as never} strokeWidth={2} />;
  let title = "";
  let detail: ReactNode = null;
  const actions: Array<{ label: string; onPress: () => void; soft?: boolean }> = [];
  const danger = item.kind === "overdue";
  const settleTarget = canResolve ? occurrence : null;

  if (item.kind === "review") {
    color = theme.brand.val;
    icon = <Inbox size={18} color={color as never} strokeWidth={2} />;
    title = t("notificationsScreen.review", { count: item.count ?? 0 });
    detail = <Line>{t("notificationsScreen.reviewBody")}</Line>;
    actions.push({ label: t("notificationsScreen.reviewAction"), onPress: onReview });
  } else if (item.kind === "gmail") {
    color = theme.dangerHard.val;
    icon = <Mail size={18} color={color as never} strokeWidth={2} />;
    title = t("notificationsScreen.gmail");
    detail = <Line>{t("notificationsScreen.gmailBody")}</Line>;
    actions.push({ label: t("notificationsScreen.gmailAction"), onPress: onReconnect });
  } else {
    if (danger) {
      color = theme.dangerHard.val;
      icon = <TriangleAlert size={18} color={color as never} strokeWidth={2} />;
    }
    const days = item.days ?? 0;
    title =
      item.kind === "overdue"
        ? t("notificationsScreen.overdue", { title: item.title, count: Math.max(1, Math.abs(days)) })
        : item.kind === "due_today"
          ? t("notificationsScreen.dueToday", { title: item.title })
          : days === 1
            ? t("notificationsScreen.dueTomorrow", { title: item.title })
            : t("notificationsScreen.dueIn", { title: item.title, count: days });
    const day = item.dueDate ? transactionDay(item.dueDate) : null;
    const when = day ? weekdayAndDay(new Date(day.y, day.m, day.d), locale) : null;
    detail = (
      <XStack items="center" flexWrap="wrap" columnGap={4}>
        {item.amount != null && item.currency ? <Amount value={item.amount} currency={item.currency} variant="amount-sm" kind="neutral" /> : null}
        <Line>{[when, occurrence?.cardAccount ? t("notificationsScreen.paidFrom", { account: occurrence.cardAccount }) : null].filter(Boolean).map((s) => ` · ${s}`).join("")}</Line>
      </XStack>
    );
    if (occurrence) {
      actions.push({ label: t("notificationsScreen.pay"), onPress: () => onPay(occurrence) });
      // Vencido: "Ya lo pagué". Vence más adelante: "Recordar el <día que vence>"; hoy ya no hay a qué posponer.
      // Con el backend anterior, solo "Pagar".
      if (canResolve && danger) actions.push({ label: t("notificationsScreen.settle"), onPress: () => onSettle(occurrence), soft: true });
      else if (canResolve && days > 0) actions.push({ label: t("notificationsScreen.snooze", dayParams(item.title, item.dueDate, locale)), onPress: () => onSnooze(occurrence), soft: true });
    }
  }

  return (
    <XStack
      p={14}
      gap={12}
      rounded={radius.lg}
      bg="$surface"
      borderWidth={1}
      borderColor={danger ? "$dangerHard" : "$line"}
      accessible={false}
      accessibilityLabel={title}
    >
      <View width={40} height={40} rounded={radius.pill} items="center" justify="center" style={{ backgroundColor: withAlpha(color, 0.14) }}>
        {icon}
      </View>
      <YStack flex={1} minW={0}>
        {/* Deslizar para "Listo" no existe con lector de pantalla (el deslizamiento es de navegación): la misma acción
            va en el título, que abre la misma confirmación. */}
        <FText
          variant="body-strong"
          style={{ letterSpacing: -0.15 }}
          accessibilityActions={settleTarget ? [{ name: "settle", label: t("notificationsScreen.settle") }] : undefined}
          onAccessibilityAction={() => settleTarget && onSettle(settleTarget)}
        >
          {title}
        </FText>
        <View mt={2}>{detail}</View>
        {actions.length ? (
          <XStack mt={10} gap={8} flexWrap="wrap">
            {actions.map((action) => (
              <PressableScale key={action.label} onPress={action.onPress} haptic="tap" accessibilityRole="button">
                <XStack height={34} px={14} rounded={radius.pill} bg={action.soft ? "$brandWash" : "$brand"} items="center">
                  <FText tone={action.soft ? "brand" : "onBrand"} style={{ fontFamily: fontFace.sans[600], fontSize: 13, lineHeight: 18 }}>
                    {action.label}
                  </FText>
                </XStack>
              </PressableScale>
            ))}
          </XStack>
        ) : null}
      </YStack>
    </XStack>
  );
}

/** Una fila de lo informativo: icono de 34px, título (a peso 600 si no se leyó, con el punto), detalle y la hora. */
function FeedRow({
  item,
  first,
  unread,
  locale,
  installationId,
  onPress,
}: {
  item: UserNotification;
  first: boolean;
  unread: boolean;
  locale: string;
  /** El de este teléfono: el aviso de inicio de sesión dice si fue aquí. */
  installationId: string | null;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  let color: string = theme.flowIn.val;
  let icon: ReactNode = <CheckCheck size={16} color={color as never} strokeWidth={2.2} />;
  let title: string;
  let detail: ReactNode;
  if (item.kind === "gmail_imported") {
    const { shown, rest } = namesSummary(item.data.titles, item.data.count);
    color = theme.chart2.val;
    icon = <Mail size={16} color={color as never} strokeWidth={2} />;
    title = t("notificationsScreen.gmailImported", { count: item.data.count });
    detail = <Line>{rest ? t("notificationsScreen.namesMore", { names: shown.join(", "), count: rest }) : shown.join(", ")}</Line>;
  } else if (item.kind === "unusual_spend") {
    const data = item.data;
    color = theme.chart1.val;
    icon = <TrendingUp size={16} color={color as never} strokeWidth={2} />;
    if (data.scope === "category") {
      title = t("notificationsScreen.unusualCategory", { category: getCategoryLabel(data.category, t), percent: growthPercent(data.amount, data.average) });
      detail = <Line>{t("notificationsScreen.unusualCategoryDetail", { amount: formatMoney(data.amount, data.currency, locale), day: new Date(item.createdAt).getDate() })}</Line>;
    } else {
      const where = data.title || (data.category ? getCategoryLabel(data.category, t) : "");
      title = t("notificationsScreen.unusualTransaction", { times: timesUsual(data.amount, data.typical) });
      detail = (
        <XStack items="center" flexWrap="wrap" columnGap={4}>
          <Amount value={data.amount} currency={data.currency} variant="amount-sm" kind="neutral" />
          {where ? <Line>{t("notificationsScreen.unusualAt", { title: where })}</Line> : null}
        </XStack>
      );
    }
  } else if (item.kind === "new_login") {
    color = theme.inkMuted.val;
    icon = <Shield size={16} color={color as never} strokeWidth={2} />;
    const device = item.data.deviceName || t(item.data.platform === "ios" ? "notificationsScreen.iphone" : "notificationsScreen.android");
    title = t("notificationsScreen.newLogin");
    detail = <Line>{item.data.installationId === installationId ? t("notificationsScreen.newLoginHere", { device }) : device}</Line>;
  } else {
    title = t("notificationsScreen.paymentRecorded", { title: item.data.title });
    detail = (
      <XStack items="center" flexWrap="wrap" columnGap={4}>
        <Amount value={item.data.amount} currency={item.data.currency} variant="amount-sm" kind="neutral" />
        {item.data.account ? <Line>{t("notificationsScreen.paymentFrom", { account: item.data.account })}</Line> : null}
      </XStack>
    );
  }
  return (
    <PressableScale onPress={onPress} scaleTo={0.99} accessibilityRole="button" accessibilityLabel={unread ? `${t("notificationsScreen.unread")}. ${title}` : title}>
      <XStack items="center" gap={12} px={14} py={12} borderTopWidth={first ? 0 : 1} borderColor="$line">
        <View width={8} height={8} rounded={4} bg={unread ? "$brand" : "transparent"} ml={-4} />
        <View
          width={34}
          height={34}
          rounded={radius.pill}
          items="center"
          justify="center"
          // El de inicio de sesión va neutro, como en el diseño: informa, no alerta.
          bg={item.kind === "new_login" ? "$surfaceSunken" : undefined}
          style={item.kind === "new_login" ? undefined : { backgroundColor: withAlpha(color, 0.14) }}
          ml={-8}
        >
          {icon}
        </View>
        <YStack flex={1} minW={0}>
          <FText numberOfLines={1} style={{ fontFamily: unread ? fontFace.sans[600] : fontFace.sans[500], fontSize: 14, lineHeight: 19 }}>
            {title}
          </FText>
          <View mt={1}>{detail}</View>
        </YStack>
        <FText tone="inkFaint" style={{ fontFamily: fontFace.mono[500], fontSize: 12, lineHeight: 16 }}>
          {feedTime(item.createdAt, new Date(), locale)}
        </FText>
      </XStack>
    </PressableScale>
  );
}

function Line({ children }: { children: ReactNode }) {
  return (
    <FText variant="caption" tone="inkMuted" style={{ lineHeight: 17 }}>
      {children}
    </FText>
  );
}

/** Sin nada por hacer: el check, la frase, el próximo pago y el enlace a elegir qué avisa. */
function AllClear({ upcoming, onChoose }: { upcoming: PaymentOccurrence | null; onChoose: () => void }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const day = upcoming?.dueDate ? transactionDay(upcoming.dueDate) : null;
  const amount = upcoming ? (upcoming.remainingAmount ?? upcoming.totalAmount) : null;

  return (
    <Animated.View entering={FadeIn.duration(motion.fade.duration)}>
      <YStack items="center" px={space[6]} mt={48}>
        <View width={64} height={64} rounded={radius.pill} items="center" justify="center" style={{ backgroundColor: withAlpha(theme.flowIn.val, 0.14) }}>
          <Check size={28} color="$flowIn" strokeWidth={2.4} />
        </View>
        <FText variant="section-title" style={{ marginTop: space[4], textAlign: "center" }}>
          {t("notificationsScreen.allClear")}
        </FText>
        <FText variant="body" tone="inkMuted" style={{ marginTop: 6, textAlign: "center", fontSize: 14, lineHeight: 20 }}>
          {t("notificationsScreen.allClearBody")}
        </FText>
      </YStack>
      {upcoming ? (
        <XStack mx={space[4]} mt={space[5]} p={14} gap={12} items="center" rounded={radius.lg} bg="$surface" borderWidth={1} borderColor="$line">
          <View width={40} height={40} rounded={radius.md} items="center" justify="center" style={{ backgroundColor: withAlpha(theme.signal.val, 0.14) }}>
            <Receipt size={18} color={theme.signal.val as never} strokeWidth={2} />
          </View>
          <YStack flex={1} minW={0}>
            <FText variant="caption" tone="inkFaint">
              {t("notificationsScreen.nextPayment")}
            </FText>
            <FText variant="body-strong" numberOfLines={1}>
              {[upcoming.title, day ? weekdayAndDay(new Date(day.y, day.m, day.d), locale) : null].filter(Boolean).join(" · ")}
            </FText>
          </YStack>
          {amount != null ? <Amount value={amount} currency={upcoming.currency} variant="amount" kind="neutral" /> : null}
        </XStack>
      ) : null}
      <PressableScale onPress={onChoose} accessibilityRole="button" style={{ alignSelf: "center", marginTop: space[5] }}>
        <FText variant="label" tone="brand" style={{ fontFamily: fontFace.sans[600] }}>
          {t("notificationsScreen.choose")}
        </FText>
      </PressableScale>
    </Animated.View>
  );
}

/** "jueves 26": el día de la semana y el número, como en las tarjetas del diseño. */
function weekdayAndDay(date: Date, locale: string) {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
  return `${weekday} ${date.getDate()}`;
}
