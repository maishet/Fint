import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, Inbox, Mail, Receipt, TriangleAlert } from "@tamagui/lucide-icons-2";
import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack, useTheme } from "tamagui";
import { financeApi } from "../src/api/finance";
import type { PaymentOccurrence } from "../src/api/types";
import { DataStateCard } from "../src/components/DataStateCard";
import { OccurrencePaymentSheet } from "../src/components/OccurrencePaymentSheet";
import type { AttentionItem } from "../src/home/attention";
import { transactionDay } from "../src/home/spending";
import { useAttention } from "../src/home/useAttention";
import { getAppLocale } from "../src/i18n";
import { withAlpha } from "../src/theme/color";
import { motion, radius, space } from "../src/theme/tokens";
import { fontFace } from "../src/theme/typography";
import { useScreenStatusBar } from "../src/theme/useScreenStatusBar";
import { Amount, FText, IconButton, PressableScale } from "../src/ui";
import { AmountSkeleton } from "../src/ui/AmountSkeleton";

const layout = LinearTransition.springify().damping(motion.springUi.damping).stiffness(motion.springUi.stiffness);

/**
 * Avisos (`Avisos` del design system): lo que la app tiene que decirle a la persona. Por ahora solo "Por hacer"
 * (pagos vencidos y por vencer, movimientos por revisar y Gmail sin sincronizar, lo mismo que los avisos del
 * Inicio): lo informativo espera `GET /api/me/notifications` y, sin él, las pestañas Todos / Por hacer no se muestran.
 * Cada aviso se resuelve con su botón; cuando se resuelve, sale con `fade` y los de abajo suben con `spring-ui`.
 */
export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useScreenStatusBar();
  const attention = useAttention();
  const accountsQuery = useQuery({ queryKey: ["account-options"], queryFn: () => financeApi.listAccountOptions() });
  const [paying, setPaying] = useState<PaymentOccurrence | null>(null);
  const [pulling, setPulling] = useState(false);

  const overdue = attention.items.filter((item) => item.kind === "overdue");
  const pending = attention.items.filter((item) => item.kind !== "overdue");
  const occurrenceOf = (item: AttentionItem) => attention.occurrences.find((o) => o.id === item.occurrenceId) ?? null;

  const card = (item: AttentionItem) => (
    <Animated.View key={item.key} entering={FadeIn.duration(motion.fade.duration)} exiting={FadeOut.duration(motion.fade.duration)} layout={layout}>
      <NoticeCard
        item={item}
        occurrence={occurrenceOf(item)}
        onPay={(occurrence) => setPaying(occurrence)}
        onReview={() => router.push("/pending-movements")}
        onReconnect={() => router.push("/gmail-settings")}
      />
    </Animated.View>
  );

  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space[6] }}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => {
              setPulling(true);
              void attention.refetch().finally(() => setPulling(false));
            }}
          />
        }
      >
        <YStack px={space[4]} pt={space[2]}>
          <XStack items="center" justify="space-between">
            <IconButton label={t("notificationsScreen.back")} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
          </XStack>
          <FText variant="display-lg" accessibilityRole="header" style={{ marginTop: space[3] }}>
            {t("notificationsScreen.title")}
          </FText>
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
        ) : attention.items.length === 0 ? (
          <AllClear upcoming={attention.upcoming} onChoose={() => router.push("/settings")} />
        ) : (
          <YStack px={space[4]}>
            {overdue.length ? (
              <Group title={t("notificationsScreen.overdueGroup")}>{overdue.map(card)}</Group>
            ) : null}
            {pending.length ? (
              <Group title={t("notificationsScreen.pendingGroup")}>{pending.map(card)}</Group>
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

/** Una tarjeta de "Por hacer": icono en un círculo teñido, título, detalle y el botón que lo resuelve. */
function NoticeCard({
  item,
  occurrence,
  onPay,
  onReview,
  onReconnect,
}: {
  item: AttentionItem;
  occurrence: PaymentOccurrence | null;
  onPay: (occurrence: PaymentOccurrence) => void;
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
  let action: { label: string; onPress: () => void } | null = null;
  const danger = item.kind === "overdue";

  if (item.kind === "review") {
    color = theme.brand.val;
    icon = <Inbox size={18} color={color as never} strokeWidth={2} />;
    title = t("notificationsScreen.review", { count: item.count ?? 0 });
    detail = <Line>{t("notificationsScreen.reviewBody")}</Line>;
    action = { label: t("notificationsScreen.reviewAction"), onPress: onReview };
  } else if (item.kind === "gmail") {
    color = theme.dangerHard.val;
    icon = <Mail size={18} color={color as never} strokeWidth={2} />;
    title = t("notificationsScreen.gmail");
    detail = <Line>{t("notificationsScreen.gmailBody")}</Line>;
    action = { label: t("notificationsScreen.gmailAction"), onPress: onReconnect };
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
    if (occurrence) action = { label: t("notificationsScreen.pay"), onPress: () => onPay(occurrence) };
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
        <FText variant="body-strong" style={{ letterSpacing: -0.15 }}>
          {title}
        </FText>
        <View mt={2}>{detail}</View>
        {action ? (
          <XStack mt={10}>
            <PressableScale onPress={action.onPress} haptic="tap" accessibilityRole="button">
              <XStack height={34} px={14} rounded={radius.pill} bg="$brand" items="center">
                <FText tone="onBrand" style={{ fontFamily: fontFace.sans[600], fontSize: 13, lineHeight: 18 }}>
                  {action.label}
                </FText>
              </XStack>
            </PressableScale>
          </XStack>
        ) : null}
      </YStack>
    </XStack>
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
