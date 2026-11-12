import { CheckCircle2, CreditCard, Pencil, Repeat, Trash2, Zap } from "@tamagui/lucide-icons-2";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, useWindowDimensions } from "react-native";
import { View, XStack, YStack } from "tamagui";
import type { PaymentOccurrence, PaymentRule } from "../api/types";
import { parseDateString } from "../finance/dates";
import { getAppLocale } from "../i18n";
import { useSensitiveMoney } from "../privacy/useSensitiveMoney";
import { COMPACT_FONT_SCALE, radius, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { Amount, FText, Monogram, PressableScale } from "../ui";
import { SwipeActions, type SwipeAction } from "../ui/SwipeActions";
import { dueText, leadOccurrence, paidDay, partialProgress, type PendingItem } from "./logic";

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "28 set": día y mes corto, sin el punto de la abreviatura. */
function shortDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date).replace(".", "");
}

/**
 * El cuadro del pago (marca D, F-06): el emoji de su categoría sobre su fondo de color; sin emoji, repetir (o el
 * rayo si se paga solo, o la tarjeta si es un pago heredado) sobre `surface`.
 */
function PaymentIcon({ title, emoji, auto, card }: { title: string; emoji: string | null; auto: boolean; card?: boolean }) {
  const Icon = card ? CreditCard : auto ? Zap : Repeat;
  return <Monogram name={title} size={44} emoji={emoji} icon={emoji ? undefined : <Icon size={20} color="$inkMuted" strokeWidth={2} />} />;
}

/** Ficha de 26 en `surface` (un período o "Automático"); el período atrasado lleva el texto en `dangerHard`. */
function Tag({ label, danger = false, icon }: { label: string; danger?: boolean; icon?: ReactNode }) {
  return (
    <XStack height={26} px={10} gap={4} items="center" rounded={radius.pill} bg="$surface">
      {icon}
      <FText
        tone={danger ? "dangerHard" : "inkMuted"}
        maxFontSizeMultiplier={COMPACT_FONT_SCALE}
        style={{ fontFamily: fontFace.display[700], fontSize: 12, lineHeight: 16 }}
      >
        {label}
      </FText>
    </XStack>
  );
}

export interface PaymentRowProps {
  item: PendingItem;
  rule: PaymentRule | undefined;
  emoji: string | null;
  first: boolean;
  last: boolean;
  /** La fila está en el grupo Vencido: el estado va en `dangerHard` y "Pagar" en amarillo. */
  late: boolean;
  today: Date;
  onPay: (occurrence: PaymentOccurrence) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * Fila de un pago pendiente (marca D, F-06), a todo el ancho y separada por un filete: el emoji de la categoría en
 * su cuadro de 44, el nombre y el monto en la misma línea, cuándo vence (en `dangerHard` si venció, en tinta si
 * vence hoy) con el detalle (frecuencia, cuenta de cargo o lo que falta de un pago parcial), y abajo las fichas de
 * los períodos atrasados (cada uno pagable por separado) y "Pagar": amarillo en lo vencido, tinta en lo demás. Si
 * se paga solo, la ficha "Automático" en lugar del botón. Deslizar muestra Editar y Eliminar; tocar la fila la edita.
 */
export function PaymentRow({ item, rule, emoji, first, late, today, onPay, onEdit, onDelete }: PaymentRowProps) {
  const { t, i18n } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= COMPACT_FONT_SCALE;
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
  const whenTone = due.kind === "overdue" || late ? "dangerHard" : due.kind === "today" ? "ink" : "inkMuted";

  const actions: SwipeAction[] = [];
  if (onEdit) actions.push({ key: "edit", label: t("paymentsTab.edit"), icon: <Pencil size={18} color="$canvas" />, tone: "ink", run: onEdit });
  if (onDelete) actions.push({ key: "delete", label: t("paymentsTab.delete"), icon: <Trash2 size={18} color="$onDanger" />, tone: "danger", run: onDelete });

  let action: ReactNode = null;
  if (!auto && !legacy) {
    action = (
      <PressableScale
        onPress={() => onPay(lead)}
        haptic="tap"
        hitSlop={5}
        accessibilityRole="button"
        accessibilityLabel={t("paymentsTab.payA11y", { title: lead.title })}
      >
        <View height={34} px={14} rounded={radius.pill} bg={late ? "$brand" : "$ink"} items="center" justify="center">
          <FText
            color={late ? "$onBrand" : "$canvas"}
            maxFontSizeMultiplier={COMPACT_FONT_SCALE}
            style={{ fontFamily: fontFace.display[700], fontSize: late ? 14 : 13, lineHeight: 18 }}
          >
            {t("paymentsTab.pay")}
          </FText>
        </View>
      </PressableScale>
    );
  }

  const tags: ReactNode[] = [];
  if (periods) {
    periods.forEach((period, i) => {
      const date = parseDateString(period.dueDate);
      const label = date ? capitalize(new Intl.DateTimeFormat(locale, { month: "short" }).format(date).replace(".", "")) : "—";
      tags.push(
        <PressableScale
          key={period.id}
          onPress={() => onPay(period)}
          haptic="tap"
          hitSlop={9}
          accessibilityRole="button"
          accessibilityLabel={t("paymentsTab.payPeriodA11y", { period: label })}
        >
          <Tag label={label} danger={i === 0 && late} />
        </PressableScale>,
      );
    });
  }
  if (auto && !legacy) tags.push(<Tag key="auto" label={t("paymentsTab.auto")} icon={<Zap size={11} color="$inkMuted" strokeWidth={2.4} />} />);

  const content = (
    <Pressable
      onPress={onEdit}
      disabled={!onEdit}
      accessibilityRole={onEdit ? "button" : undefined}
      // La ficha "Automático" queda dentro de la fila (que ya es un solo elemento): su significado va en la etiqueta de la fila.
      accessibilityLabel={[lead.title, meta, formatSensitiveAmount(amount, lead.currency), auto && !legacy ? t("paymentsTab.autoA11y") : null]
        .filter(Boolean)
        .join(", ")}
      accessibilityActions={actions.map((a) => ({ name: a.key, label: a.label }))}
      onAccessibilityAction={(e) => actions.find((a) => a.key === e.nativeEvent.actionName)?.run()}
    >
      {({ pressed }) => (
        <XStack items="flex-start" gap={space[3]} py={14} bg={pressed ? "$surfaceSunken" : "$canvas"}>
          <PaymentIcon title={lead.title} emoji={emoji} auto={auto} card={legacy} />
          <YStack flex={1} minW={0} gap={3}>
            <XStack justify="space-between" items="baseline" gap={8} flexWrap={stacked ? "wrap" : "nowrap"}>
              <FText numberOfLines={stacked ? undefined : 1} style={{ flexShrink: 1, fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21 }}>
                {lead.title}
              </FText>
              <Amount value={amount} currency={lead.currency} style={{ fontFamily: fontFace.mono[600], fontSize: 16, lineHeight: 21 }} />
            </XStack>
            <FText tone={whenTone} numberOfLines={stacked ? undefined : 1} style={{ fontFamily: fontFace.display[700], fontSize: 13, lineHeight: 18 }}>
              {meta}
            </FText>
            {progress !== null ? (
              <View width={120} height={4} mt={4} rounded={radius.pill} bg="$chartTrack" overflow="hidden">
                <View width={`${Math.round(progress * 100)}%`} height="100%" rounded={radius.pill} bg="$flowIn" />
              </View>
            ) : null}
            {tags.length || action ? (
              <XStack mt={6} justify="space-between" items="center" gap={8} flexWrap="wrap">
                <XStack gap={6} flexWrap="wrap" shrink={1}>
                  {tags}
                </XStack>
                {action}
              </XStack>
            ) : null}
          </YStack>
        </XStack>
      )}
    </Pressable>
  );

  return (
    <View borderTopWidth={first ? 0 : 1} borderColor="$line">
      <SwipeActions actions={actions}>{content}</SwipeActions>
    </View>
  );
}

/**
 * Fila del historial (marca D): el pago, cuándo se pagó y con qué cuenta, y el monto, a todo el ancho y separada
 * por un filete. Los pagos de tarjeta heredados se muestran igual, de solo lectura.
 */
export function HistoryRow({ occurrence, emoji, first }: { occurrence: PaymentOccurrence; emoji: string | null; first: boolean; last: boolean }) {
  const { t, i18n } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const paidAt = paidDay(occurrence);
  // "Ya lo pagué": se pagó fuera de Fint, sin cuenta ni movimiento.
  const settled = Boolean(occurrence.settledAt) && !occurrence.paidAt;
  const meta = [
    settled && paidAt
      ? t("paymentsTab.settledOn", { date: shortDate(paidAt, locale) })
      : paidAt
        ? t("paymentsTab.paidOn", { date: shortDate(paidAt, locale) })
        : t("payments.statusPaid"),
    occurrence.kind === "credit_card" ? t("paymentsTab.legacy") : settled ? null : occurrence.paidAccount,
  ]
    .filter(Boolean)
    .join(" · ");
  const amount = occurrence.totalAmount ?? occurrence.paidAmount;
  return (
    <XStack
      items="center"
      gap={space[3]}
      py={14}
      borderTopWidth={first ? 0 : 1}
      borderColor="$line"
      accessible
      accessibilityLabel={`${occurrence.title}, ${meta}`}
    >
      {emoji || occurrence.kind === "credit_card" ? (
        <PaymentIcon title={occurrence.title} emoji={emoji} auto={false} card={occurrence.kind === "credit_card"} />
      ) : (
        <Monogram name={occurrence.title} size={44} icon={<CheckCircle2 size={20} color="$flowIn" strokeWidth={2} />} />
      )}
      <YStack flex={1} minW={0} gap={2}>
        <FText numberOfLines={1} style={{ fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21 }}>
          {occurrence.title}
        </FText>
        <FText tone="inkFaint" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>
          {meta}
        </FText>
      </YStack>
      <Amount value={amount} currency={occurrence.currency} style={{ fontFamily: fontFace.mono[600], fontSize: 15, lineHeight: 20 }} />
    </XStack>
  );
}
