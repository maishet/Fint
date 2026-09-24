import { ChevronRight, CircleCheck, Clock, Mail, TriangleAlert } from "@tamagui/lucide-icons-2";
import { useTranslation } from "react-i18next";
import Animated, { FadeOut, LinearTransition } from "react-native-reanimated";
import { View, XStack, YStack } from "tamagui";
import type { PaymentOccurrence } from "../api/types";
import { formatAmount } from "../finance/formatAmount";
import { useSensitiveAmounts } from "../privacy/SensitiveAmountsProvider";
import { getAppLocale } from "../i18n";
import { motion, radius, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FText, PressableScale } from "../ui";
import type { AttentionItem } from "./attention";

const CARD_WIDTH = 236;
const GAP = 10;
const MAX_CARDS = 5;

interface AttentionRailProps {
  items: AttentionItem[];
  upcoming: PaymentOccurrence | null;
  onOpen: (item: AttentionItem) => void;
}

/**
 * Los avisos del Inicio: lo que vence y lo que hay que revisar, como una fila
 * de tarjetas de 236px con snap por tarjeta. Sin avisos, una sola línea
 * tranquila; nunca desaparece, para que la hoja no cambie de alto.
 */
export function AttentionRail({ items, upcoming, onOpen }: AttentionRailProps) {
  const { t, i18n } = useTranslation();

  if (items.length === 0) {
    const locale = getAppLocale(i18n.resolvedLanguage);
    const date = upcoming?.dueDate
      ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(`${upcoming.dueDate.slice(0, 10)}T12:00:00`))
      : null;
    return (
      <XStack items="center" gap={space[3]} px={space[4]} py={space[3]} mx={space[4]} rounded={radius.lg} bg="$surface" borderWidth={1} borderColor="$line">
        <CircleCheck size={18} color="$flowIn" strokeWidth={2} />
        <YStack flex={1} minW={0}>
          <FText variant="label" style={{ fontFamily: fontFace.sans[600] }}>
            {t("home.attention.allClear")}
          </FText>
          <FText variant="caption" tone="inkFaint" numberOfLines={1}>
            {upcoming && date ? t("home.attention.allClearNext", { title: upcoming.title, date }) : t("home.attention.allClearNone")}
          </FText>
        </YStack>
      </XStack>
    );
  }

  return (
    // Cuando un aviso se resuelve, sale con `fade` y los demás se deslizan a llenar el hueco con `spring-ui`.
    <Animated.FlatList
      horizontal
      itemLayoutAnimation={LinearTransition.springify().damping(motion.springUi.damping).stiffness(motion.springUi.stiffness)}
      data={items.slice(0, MAX_CARDS)}
      keyExtractor={(item) => item.key}
      showsHorizontalScrollIndicator={false}
      snapToInterval={CARD_WIDTH + GAP}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: space[4], gap: GAP }}
      renderItem={({ item }) => (
        <Animated.View exiting={FadeOut.duration(motion.fade.duration)}>
          <AttentionCard item={item} onPress={() => onOpen(item)} />
        </Animated.View>
      )}
    />
  );
}

function AttentionCard({ item, onPress }: { item: AttentionItem; onPress: () => void }) {
  const { t } = useTranslation();
  const { amountsVisible, isHydrated } = useSensitiveAmounts();
  const overdue = item.kind === "overdue";
  const review = item.kind === "review";

  const title = review
    ? t("home.attention.review", { count: item.count ?? 0 })
    : item.amount != null && item.currency && isHydrated && amountsVisible
      ? `${item.title} · ${formatAmount(item.amount, item.currency)}`
      : item.title;

  const context = review
    ? t("home.attention.reviewHint")
    : overdue
      ? t("home.attention.overdue", { count: Math.abs(item.days ?? 1) })
      : item.kind === "due_today"
        ? t("home.attention.dueToday")
        : item.days === 1
          ? t("home.attention.dueTomorrow")
          : t("home.attention.dueIn", { count: item.days ?? 0 });

  const icon = review ? (
    <Mail size={17} color="$brand" strokeWidth={2} />
  ) : overdue ? (
    <TriangleAlert size={17} color="$dangerHard" strokeWidth={2} />
  ) : (
    <Clock size={17} color="$signal" strokeWidth={2} />
  );

  return (
    <PressableScale onPress={onPress} haptic="tap" accessibilityRole="button" accessibilityLabel={`${title}. ${context}`}>
      <XStack
        width={CARD_WIDTH}
        items="center"
        gap={space[3]}
        p={space[3]}
        rounded={radius.lg}
        bg="$surface"
        borderWidth={1}
        borderColor={overdue ? "$dangerHard" : "$line"}
      >
        <View width={34} height={34} rounded={radius.md} items="center" justify="center" bg={review ? "$brandWash" : "$surfaceSunken"}>
          {icon}
        </View>
        <YStack flex={1} minW={0}>
          <FText variant="label" numberOfLines={1} style={{ fontFamily: fontFace.sans[600] }}>
            {title}
          </FText>
          <FText
            variant="caption"
            tone={overdue ? "dangerHard" : "inkFaint"}
            numberOfLines={1}
            style={overdue ? { fontFamily: fontFace.sans[600] } : undefined}
          >
            {context}
          </FText>
        </YStack>
        <ChevronRight size={16} color="$inkFaint" strokeWidth={2} />
      </XStack>
    </PressableScale>
  );
}
