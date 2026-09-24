import { CheckCircle2, CreditCard, Pencil, Repeat, Trash2, Zap } from "@tamagui/lucide-icons-2";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { Text, View, XStack, YStack } from "tamagui";
import type { PaymentOccurrence, PaymentRule } from "../api/types";
import { parseDateString } from "../finance/dates";
import { getAppLocale } from "../i18n";
import { useSensitiveMoney } from "../privacy/useSensitiveMoney";
import { radius, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { Amount, FText, PressableScale } from "../ui";
import { GroupedCell } from "../ui/GroupedCell";
import { SwipeActions, type SwipeAction } from "../ui/SwipeActions";
import { dueText, leadOccurrence, partialProgress, type PendingItem } from "./logic";

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "28 set": día y mes corto, sin el punto de la abreviatura. */
function shortDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date).replace(".", "");
}

/** Icono del pago en `surface-sunken`: el emoji de su categoría o, sin él, repetir (o el rayo si se paga solo). */
function PaymentIcon({ emoji, auto, late, card }: { emoji: string | null; auto: boolean; late: boolean; card?: boolean }) {
  const color = late ? "$dangerHard" : "$inkMuted";
  return (
    <View width={38} height={38} rounded={radius.md} bg="$surfaceSunken" items="center" justify="center" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {emoji ? (
        <Text style={{ fontSize: 18, lineHeight: 22 }}>{emoji}</Text>
      ) : card ? (
        <CreditCard size={18} color={color} strokeWidth={1.9} />
      ) : auto ? (
        <Zap size={18} color={color} strokeWidth={1.9} />
      ) : (
        <Repeat size={18} color={color} strokeWidth={1.9} />
      )}
    </View>
  );
}

export interface PaymentRowProps {
  item: PendingItem;
  rule: PaymentRule | undefined;
  emoji: string | null;
  first: boolean;
  last: boolean;
  /** La fila está en el grupo Vencido: filete, detalle y botón cambian. */
  late: boolean;
  today: Date;
  onPay: (occurrence: PaymentOccurrence) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * Fila de un pago pendiente: icono, título, cuándo vence y un detalle
 * (frecuencia, cuenta de cargo o lo que falta de un pago parcial), y a la
 * derecha el monto con la acción. "Pagar" va relleno en `brand` solo en lo
 * vencido; en lo demás, `brand-wash`. Si se paga solo, la etiqueta
 * "Automático" en lugar del botón. Los períodos atrasados de una misma regla
 * van en una fila, cada uno pagable por separado; "Pagar" sugiere el más
 * antiguo. Deslizar muestra Editar y Eliminar; tocar la fila la edita.
 */
export function PaymentRow({ item, rule, emoji, first, last, late, today, onPay, onEdit, onDelete }: PaymentRowProps) {
  const { t, i18n } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const { formatSensitiveAmount } = useSensitiveMoney();
  const lead = leadOccurrence(item);
  const periods = item.kind === "group" ? item.periods : null;
  // Los pagos de tarjeta del flujo anterior son de solo lectura: la app ya no los paga.
  const legacy = lead.kind === "credit_card";
  const auto = lead.autoPayEnabled;
  const progress = partialProgress(lead);

  const due = dueText(lead.dueDate, today);
  const when =
    due.kind === "overdue"
      ? t("paymentsTab.due.overdue", { count: due.days })
      : due.kind === "today"
        ? t("paymentsTab.due.today")
        : due.kind === "tomorrow"
          ? t("paymentsTab.due.tomorrow")
          : due.kind === "weekday"
            ? capitalize(new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric" }).format(due.date))
            : due.kind === "date"
              ? shortDate(due.date, locale)
              : t("paymentsTab.due.none");
  const detail = periods
    ? t("payments.periodsPending", { count: periods.length })
    : progress !== null
      ? t("paymentsTab.missing", { amount: formatSensitiveAmount(lead.remainingAmount ?? 0, lead.currency) })
      : legacy
        ? t("paymentsTab.legacy")
        : due.kind === "overdue"
          ? null
          : auto && rule?.autoPayAccount
            ? rule.autoPayAccount
            : rule
              ? t(`payments.${rule.frequency}`)
              : null;
  const meta = [when, detail].filter(Boolean).join(" · ");
  const amount = lead.totalAmount ?? lead.remainingAmount ?? 0;

  const actions: SwipeAction[] = [];
  if (onEdit) actions.push({ key: "edit", label: t("paymentsTab.edit"), icon: <Pencil size={18} color="$ink" />, tone: "neutral", run: onEdit });
  if (onDelete) actions.push({ key: "delete", label: t("paymentsTab.delete"), icon: <Trash2 size={18} color="$onDanger" />, tone: "danger", run: onDelete });

  let action: ReactNode = null;
  if (auto && !legacy) {
    action = (
      <XStack height={24} px={8} gap={4} items="center" rounded={radius.pill} bg="$surfaceSunken" accessibilityLabel={t("paymentsTab.autoA11y")}>
        <Zap size={11} color="$inkMuted" strokeWidth={2.4} />
        <FText variant="caption" tone="inkMuted" style={{ fontSize: 11, lineHeight: 14, fontFamily: fontFace.sans[600] }}>
          {t("paymentsTab.auto")}
        </FText>
      </XStack>
    );
  } else if (!legacy) {
    action = (
      <PressableScale
        onPress={() => onPay(lead)}
        haptic="tap"
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t("paymentsTab.payA11y", { title: lead.title })}
      >
        <View height={28} px={12} rounded={radius.pill} bg={late ? "$brand" : "$brandWash"} items="center" justify="center">
          <FText variant="caption" tone={late ? "onBrand" : "brand"} style={{ fontFamily: fontFace.sans[600] }}>
            {t("paymentsTab.pay")}
          </FText>
        </View>
      </PressableScale>
    );
  }

  const content = (
    <Pressable
      onPress={onEdit}
      disabled={!onEdit}
      accessibilityRole={onEdit ? "button" : undefined}
      accessibilityLabel={`${lead.title}, ${meta}, ${formatSensitiveAmount(amount, lead.currency)}`}
      accessibilityActions={actions.map((a) => ({ name: a.key, label: a.label }))}
      onAccessibilityAction={(e) => actions.find((a) => a.key === e.nativeEvent.actionName)?.run()}
    >
      {({ pressed }) => (
        <XStack items="center" gap={space[3]} px={space[4]} py={space[3]} bg={pressed ? "$surfaceSunken" : "$surface"}>
          <PaymentIcon emoji={emoji} auto={auto} late={late} card={legacy} />
          <YStack flex={1} minW={0}>
            <FText variant="body-strong" numberOfLines={1} style={{ letterSpacing: -0.15 }}>
              {lead.title}
            </FText>
            <FText
              variant="caption"
              tone={late ? "dangerHard" : "inkFaint"}
              numberOfLines={1}
              style={{ marginTop: 1, fontFamily: late ? fontFace.sans[600] : undefined }}
            >
              {meta}
            </FText>
            {progress !== null ? (
              <View width={120} height={4} mt={6} rounded={radius.pill} bg="$chartTrack" overflow="hidden">
                <View width={`${Math.round(progress * 100)}%`} height="100%" rounded={radius.pill} bg="$flowIn" />
              </View>
            ) : null}
            {periods ? (
              <XStack mt={8} gap={6} flexWrap="wrap">
                {periods.map((period, i) => {
                  const date = parseDateString(period.dueDate);
                  const label = date ? capitalize(new Intl.DateTimeFormat(locale, { month: "short" }).format(date).replace(".", "")) : "—";
                  return (
                    <PressableScale
                      key={period.id}
                      onPress={() => onPay(period)}
                      haptic="tap"
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel={t("paymentsTab.payPeriodA11y", { period: label })}
                    >
                      <View height={24} px={9} rounded={radius.pill} borderWidth={1} borderColor={i === 0 ? "$dangerHard" : "$lineStrong"} items="center" justify="center">
                        <FText variant="caption" tone={i === 0 ? "dangerHard" : "inkMuted"} style={{ fontSize: 11, lineHeight: 14, fontFamily: fontFace.sans[600] }}>
                          {label}
                        </FText>
                      </View>
                    </PressableScale>
                  );
                })}
              </XStack>
            ) : null}
          </YStack>
          <YStack items="flex-end" gap={6} shrink={0}>
            <Amount value={amount} currency={lead.currency} />
            {action}
          </YStack>
        </XStack>
      )}
    </Pressable>
  );

  return (
    <GroupedCell first={first} last={last} tone={late ? "danger" : "default"}>
      <SwipeActions actions={actions}>{content}</SwipeActions>
    </GroupedCell>
  );
}

/**
 * Fila del historial: el pago, cuándo se pagó y con qué cuenta, y el monto.
 * Los pagos de tarjeta heredados se muestran igual, de solo lectura.
 */
export function HistoryRow({ occurrence, emoji, first, last }: { occurrence: PaymentOccurrence; emoji: string | null; first: boolean; last: boolean }) {
  const { t, i18n } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const paidAt = parseDateString(occurrence.paidAt);
  const meta = [
    paidAt ? t("paymentsTab.paidOn", { date: shortDate(paidAt, locale) }) : t("payments.statusPaid"),
    occurrence.kind === "credit_card" ? t("paymentsTab.legacy") : occurrence.paidAccount,
  ]
    .filter(Boolean)
    .join(" · ");
  const amount = occurrence.totalAmount ?? occurrence.paidAmount;
  return (
    <GroupedCell first={first} last={last}>
      <XStack items="center" gap={space[3]} px={space[4]} py={space[3]} accessible accessibilityLabel={`${occurrence.title}, ${meta}`}>
        {emoji || occurrence.kind === "credit_card" ? (
          <PaymentIcon emoji={emoji} auto={false} late={false} card={occurrence.kind === "credit_card"} />
        ) : (
          <View width={38} height={38} rounded={radius.md} bg="$surfaceSunken" items="center" justify="center">
            <CheckCircle2 size={18} color="$flowIn" strokeWidth={1.9} />
          </View>
        )}
        <YStack flex={1} minW={0}>
          <FText variant="body-strong" numberOfLines={1} style={{ letterSpacing: -0.15 }}>
            {occurrence.title}
          </FText>
          <FText variant="caption" tone="inkFaint" numberOfLines={1} style={{ marginTop: 1 }}>
            {meta}
          </FText>
        </YStack>
        <Amount value={amount} currency={occurrence.currency} />
      </XStack>
    </GroupedCell>
  );
}
