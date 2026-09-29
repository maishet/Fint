import { useTranslation } from "react-i18next";
import { XStack } from "tamagui";
import { transactionDay } from "../home/spending";
import { space } from "../theme/tokens";
import { Amount, FText } from "../ui";

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** El encabezado de un día en una lista de movimientos: "Hoy · jueves 24" o "21 set · lunes", y el neto del día. */
export function DayHeader({ day, net, locale }: { day: string; net: { currency: string; value: number } | null; locale: string }) {
  const { t } = useTranslation();
  const d = transactionDay(day);
  const date = d ? new Date(d.y, d.m, d.d) : new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
  const primary =
    diff === 0
      ? t("movementsTab.today")
      : diff === 1
        ? t("movementsTab.yesterday")
        : new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date).replace(".", "");
  const secondary = diff <= 1 ? `${weekday} ${date.getDate()}` : weekday;
  return (
    <XStack px={space[4]} pt={18} pb={8} items="center" justify="space-between" bg="$canvas">
      <XStack items="baseline" gap={6} shrink={1}>
        <FText variant="body-strong" style={{ fontSize: 14 }}>
          {capitalize(primary)}
        </FText>
        <FText variant="caption" tone="inkFaint" style={{ fontSize: 13 }}>
          {`· ${secondary}`}
        </FText>
      </XStack>
      {net ? <Amount value={net.value} currency={net.currency} kind={net.value > 0 ? "income" : net.value < 0 ? "expense" : "neutral"} tone="inkMuted" variant="amount-sm" /> : null}
    </XStack>
  );
}
