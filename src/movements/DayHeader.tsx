import { useTranslation } from "react-i18next";
import { XStack } from "tamagui";
import { transactionDay } from "../home/spending";
import { space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { Amount, FText } from "../ui";

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * El encabezado de un día en una lista de movimientos (marca D): "Hoy martes 10" o "21 set lunes", el primero en
 * 16/800 y el segundo en `inkFaint`, y el neto del día con su signo en `inkMuted`.
 */
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
    <XStack px={space[5]} pt={20} pb={2} minH={44} items="center" justify="space-between" gap={space[3]} bg="$canvas">
      <XStack items="baseline" gap={6} shrink={1} flexWrap="wrap">
        <FText accessibilityRole="header" maxFontSizeMultiplier={1.5} style={{ fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21 }}>
          {capitalize(primary)}
        </FText>
        <FText tone="inkFaint" maxFontSizeMultiplier={1.5} style={{ fontFamily: fontFace.sans[600], fontSize: 16, lineHeight: 21 }}>
          {secondary}
        </FText>
      </XStack>
      {net ? (
        <Amount
          value={net.value}
          currency={net.currency}
          kind={net.value > 0 ? "income" : net.value < 0 ? "expense" : "neutral"}
          tone="inkMuted"
          variant="amount-sm"
          style={{ fontFamily: fontFace.mono[600], fontSize: 14, lineHeight: 19 }}
        />
      ) : null}
    </XStack>
  );
}
