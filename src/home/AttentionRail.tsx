import { CircleCheck, Clock, Mail, TriangleAlert } from "@tamagui/lucide-icons-2";
import { useTranslation } from "react-i18next";
import { useWindowDimensions } from "react-native";
import Animated, { FadeOut, LinearTransition } from "react-native-reanimated";
import { View, XStack, YStack } from "tamagui";
import type { PaymentOccurrence } from "../api/types";
import { formatAmount } from "../finance/formatAmount";
import { useSensitiveAmounts } from "../privacy/SensitiveAmountsProvider";
import { getAppLocale } from "../i18n";
import { COMPACT_FONT_SCALE, motion, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { Amount, FText, PressableScale, SectionHeader } from "../ui";
import type { AttentionItem } from "./attention";

const CARD_WIDTH = 268;
const GAP = 10;
const MAX_CARDS = 5;

interface AttentionRailProps {
  items: AttentionItem[];
  upcoming: PaymentOccurrence | null;
  onOpen: (item: AttentionItem) => void;
}

/**
 * Los avisos del Inicio: lo que vence y lo que hay que revisar, como una fila
 * de tarjetas `surface` de 268px con snap por tarjeta. Desde `COMPACT_FONT_SCALE`
 * dejan de ser carrusel y se apilan a todo el ancho. Sin avisos, una sola línea
 * tranquila; nunca desaparece, para que el Inicio no cambie de alto.
 */
export function AttentionRail({ items, upcoming, onOpen }: AttentionRailProps) {
  const { t, i18n } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= COMPACT_FONT_SCALE;

  if (items.length === 0) {
    const locale = getAppLocale(i18n.resolvedLanguage);
    const date = upcoming?.dueDate
      ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(`${upcoming.dueDate.slice(0, 10)}T12:00:00`))
      : null;
    return (
      <XStack items="center" gap={space[3]} px={space[4]} py={14} mx={space[5]} rounded={24} bg="$surface">
        <CircleCheck size={20} color="$flowIn" strokeWidth={2.2} />
        <YStack flex={1} minW={0}>
          <FText style={{ fontFamily: fontFace.sans[600], fontSize: 15, lineHeight: 20 }}>{t("home.attention.allClear")}</FText>
          <FText variant="caption" tone="inkFaint" numberOfLines={stacked ? undefined : 1}>
            {upcoming && date ? t("home.attention.allClearNext", { title: upcoming.title, date }) : t("home.attention.allClearNone")}
          </FText>
        </YStack>
      </XStack>
    );
  }

  const shown = items.slice(0, MAX_CARDS);

  return (
    <YStack>
      <YStack px={space[5]}>
        <SectionHeader title={t("home.attention.title")} />
      </YStack>
      {stacked ? (
        <YStack px={space[5]} gap={GAP}>
          {shown.map((item) => (
            <AttentionCard key={item.key} item={item} stacked onPress={() => onOpen(item)} />
          ))}
        </YStack>
      ) : (
        // Cuando un aviso se resuelve, sale con `fade` y los demás se deslizan a llenar el hueco con `spring-ui`.
        <Animated.FlatList
          horizontal
          itemLayoutAnimation={LinearTransition.springify().damping(motion.springUi.damping).stiffness(motion.springUi.stiffness)}
          data={shown}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + GAP}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: space[5], gap: GAP }}
          renderItem={({ item }) => (
            <Animated.View exiting={FadeOut.duration(motion.fade.duration)}>
              <AttentionCard item={item} onPress={() => onOpen(item)} />
            </Animated.View>
          )}
        />
      )}
    </YStack>
  );
}

/**
 * Un aviso: ícono en un cuadro de 44, título 15/800 y el contexto (en `dangerHard` si ya venció); abajo, el monto y
 * el botón de la acción (Pagar en amarillo; Revisar y Reconectar en tinta). Toda la tarjeta es el botón: el de
 * adentro es su forma visible, y se lee una sola vez.
 */
function AttentionCard({ item, onPress, stacked = false }: { item: AttentionItem; onPress: () => void; stacked?: boolean }) {
  const { t } = useTranslation();
  const { amountsVisible, isHydrated } = useSensitiveAmounts();
  const overdue = item.kind === "overdue";
  const review = item.kind === "review";
  const gmail = item.kind === "gmail";
  const payment = !review && !gmail;

  const title = review ? t("home.attention.review", { count: item.count ?? 0 }) : gmail ? t("home.attention.gmail") : item.title;
  const spokenTitle =
    payment && item.amount != null && item.currency && isHydrated && amountsVisible ? `${item.title} · ${formatAmount(item.amount, item.currency)}` : title;

  const context = review
    ? t("home.attention.reviewHint")
    : gmail
      ? t("home.attention.gmailHint")
      : overdue
        ? t("home.attention.overdue", { count: Math.abs(item.days ?? 1) })
        : item.kind === "due_today"
          ? t("home.attention.dueToday")
          : item.days === 1
            ? t("home.attention.dueTomorrow")
            : t("home.attention.dueIn", { count: item.days ?? 0 });

  const icon = review ? (
    <Mail size={20} color="$inkMuted" strokeWidth={2} />
  ) : gmail ? (
    <Mail size={20} color="$dangerHard" strokeWidth={2} />
  ) : overdue ? (
    <TriangleAlert size={20} color="$dangerHard" strokeWidth={2} />
  ) : (
    <Clock size={20} color="$inkMuted" strokeWidth={2} />
  );

  const actionLabel = payment ? t("home.actions.pay") : review ? t("home.more.reviewAction") : t("home.more.gmailReconnect");

  return (
    <PressableScale onPress={onPress} haptic="tap" accessibilityRole="button" accessibilityLabel={`${spokenTitle}. ${context}. ${actionLabel}`}>
      <YStack width={stacked ? "100%" : CARD_WIDTH} gap={12} p={14} rounded={24} bg="$surface">
        <XStack gap={12} items="center">
          <View width={44} height={44} rounded={14} items="center" justify="center" bg="$canvas">
            {icon}
          </View>
          <YStack flex={1} minW={0} gap={2}>
            <FText numberOfLines={stacked ? undefined : 1} style={{ fontFamily: fontFace.display[700], fontSize: 15, lineHeight: 20 }}>
              {title}
            </FText>
            <FText
              tone={overdue || gmail ? "dangerHard" : "inkFaint"}
              numberOfLines={stacked ? undefined : 1}
              style={{ fontFamily: fontFace.sans[600], fontSize: 13, lineHeight: 18 }}
            >
              {context}
            </FText>
          </YStack>
        </XStack>
        <XStack items="center" justify={payment && item.amount != null ? "space-between" : "flex-end"} gap={10} flexWrap="wrap">
          {payment && item.amount != null && item.currency ? (
            <Amount value={item.amount} currency={item.currency} variant="amount-lg" style={{ fontFamily: fontFace.mono[600], fontSize: 20, lineHeight: 25 }} />
          ) : null}
          <XStack
            minH={payment ? 36 : 34}
            px={14}
            items="center"
            rounded={999}
            bg={payment ? "$brand" : "$ink"}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <FText
              maxFontSizeMultiplier={COMPACT_FONT_SCALE}
              color={payment ? "$onBrand" : "$canvas"}
              style={{ fontFamily: fontFace.sans[600], fontSize: payment ? 14 : 13, lineHeight: 18 }}
            >
              {actionLabel}
            </FText>
          </XStack>
        </XStack>
      </YStack>
    </PressableScale>
  );
}
