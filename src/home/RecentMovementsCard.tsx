import { ArrowLeftRight } from "@tamagui/lucide-icons-2";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { YStack } from "tamagui";
import type { Transaction } from "../api/types";
import { getCategoryLabel } from "../finance/categoryLabels";
import { useCategoryIcons } from "../finance/useCategoryIcons";
import { getAppLocale } from "../i18n";
import { space } from "../theme/tokens";
import { Amount, FintCard, FText, ListRow, Monogram, SectionHeader } from "../ui";
import { categoryColorIndex, transactionDay } from "./spending";

const ROWS = 3;

/** Los tres últimos movimientos. Una cuarta fila no dice nada nuevo y el tab está a un toque. */
export function RecentMovementsCard({ transactions }: { transactions: Transaction[] }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const iconFor = useCategoryIcons();
  const locale = getAppLocale(i18n.resolvedLanguage);
  const rows = transactions.slice(0, ROWS);

  return (
    <YStack px={space[4]}>
      <SectionHeader title={t("home.recent.title")} actionLabel={t("actions.viewAll")} onAction={() => router.push("/(tabs)/movements")} />
      <FintCard p={0} overflow="hidden">
        {rows.length === 0 ? (
          <YStack p={space[4]}>
            <FText tone="inkMuted">{t("dashboard.emptyMovements")}</FText>
          </YStack>
        ) : (
          rows.map((tx, i) => {
            const transfer = tx.type === "transfer";
            const title = transfer ? t("forms.transfer") : getCategoryLabel(tx.category, t);
            const subtitle = [relativeDay(tx.date, locale, t), tx.note || tx.account].filter(Boolean).join(" · ");
            return (
              <ListRow
                key={tx.id}
                divider={i > 0}
                title={title}
                subtitle={subtitle}
                leading={
                  transfer ? (
                    <Monogram name={title} icon={<ArrowLeftRight size={16} color="$inkMuted" strokeWidth={2} />} />
                  ) : (
                    <Monogram name={title} emoji={iconFor(tx.category, tx.type)} color={`$chart${categoryColorIndex(tx.category)}` as never} />
                  )
                }
                trailing={<Amount value={tx.amount} currency={tx.currency} kind={tx.type === "income" ? "income" : transfer ? "transfer" : "expense"} />}
                onPress={transfer ? undefined : () => openDetail(router, tx)}
              />
            );
          })
        )}
      </FintCard>
    </YStack>
  );
}

function openDetail(router: ReturnType<typeof useRouter>, tx: Transaction) {
  router.push({
    pathname: "/transaction-detail",
    params: {
      id: tx.id,
      type: tx.type as "income" | "expense",
      amount: String(tx.amount),
      currency: tx.currency,
      category: tx.category,
      account: tx.account,
      note: tx.note ?? "",
      date: tx.date,
      ...(tx.latitude != null && tx.longitude != null
        ? { latitude: String(tx.latitude), longitude: String(tx.longitude), formattedAddress: tx.formattedAddress ?? "" }
        : {}),
    },
  });
}

/** "Hoy", "Ayer" o la fecha corta. */
function relativeDay(value: string, locale: string, t: (k: string) => string) {
  const day = transactionDay(value);
  if (!day) return "";
  const date = new Date(day.y, day.m, day.d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (diff === 0) return t("home.today");
  if (diff === 1) return t("home.yesterday");
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date);
}
