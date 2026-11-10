import { ArrowDown, ArrowUp, ChevronRight } from "@tamagui/lucide-icons-2";
import { useTranslation } from "react-i18next";
import { Pressable, useWindowDimensions } from "react-native";
import { View, XStack, YStack } from "tamagui";
import { categoryStrong } from "../finance/categoryTint";
import { useCategoryHue } from "../finance/emojiHue";
import { useThemeMode } from "../theme/ThemeMode";
import { COMPACT_FONT_SCALE } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { Amount, FText, Monogram } from "../ui";
import type { CategoryRow } from "./logic";

/** "32%" o "4.5%": entero cuando lo es, con un decimal si no. */
function pct(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

/**
 * La variación de una categoría de gasto: bajar es buena noticia (`flowIn`),
 * subir no (`flowOut`). Sin periodo anterior dice "nueva"; sin cambio, "igual".
 */
export function CategoryChange({ change }: { change: number | null }) {
  const { t } = useTranslation();
  if (change === null || change === 0) {
    return (
      <FText variant="figure-caption" tone="inkFaint" style={{ fontSize: 11 }}>
        {t(change === null ? "reportsTab.new" : "reportsTab.same")}
      </FText>
    );
  }
  const tone = change < 0 ? "flowIn" : "flowOut";
  const Icon = change > 0 ? ArrowUp : ArrowDown;
  return (
    <XStack items="center" gap={2}>
      <Icon size={11} color={`$${tone}`} strokeWidth={2.6} />
      <FText variant="figure-caption" tone={tone} style={{ fontSize: 11 }}>
        {`${pct(Math.abs(change))}%`}
      </FText>
    </XStack>
  );
}

/**
 * Categorías del periodo (marca D, F-07): una barra de 12 partida por categoría, cada tramo en el color fuerte de
 * su tono (`categoryStrong`, medido del emoji) y "Otros" en `line`; debajo, una fila por categoría con su emoji en el
 * cuadro de 40, el nombre, el porcentaje con la variación y el monto. Tocar una fila abre sus movimientos ("Otros"
 * no abre nada). La barra es decorativa: las filas ya dicen cada porcentaje.
 */
export function CategoryBreakdown({
  rows,
  currency,
  onOpen,
  iconFor,
}: {
  rows: readonly CategoryRow[];
  currency: string;
  onOpen: (row: CategoryRow) => void;
  /** El emoji guardado de una categoría por su nombre (el de `useCategoryIcons`). */
  iconFor: (name: string) => string | null;
}) {
  const { t } = useTranslation();
  return (
    <YStack>
      <XStack height={12} gap={3} rounded={6} overflow="hidden" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {rows.map((r) => (
          <Segment key={r.key ?? "__other__"} row={r} emoji={r.key ? iconFor(r.key) : null} />
        ))}
      </XStack>
      <YStack mt={6}>
        {rows.map((r, i) => (
          <BreakdownRow
            key={r.key ?? "__other__"}
            row={r}
            first={i === 0}
            emoji={r.key ? iconFor(r.key) : null}
            currency={currency}
            onPress={r.key ? () => onOpen(r) : undefined}
            openLabel={r.key ? t("reportsTab.openCategory", { name: r.label }) : undefined}
          />
        ))}
      </YStack>
    </YStack>
  );
}

/** Un tramo de la barra: el color fuerte de la categoría; "Otros", `line`. */
function Segment({ row, emoji }: { row: CategoryRow; emoji: string | null }) {
  const { themeMode } = useThemeMode();
  const hue = useCategoryHue(emoji, row.key ?? row.label);
  return (
    <View
      height="100%"
      bg={row.key ? undefined : "$line"}
      style={{ flex: Math.max(row.amount, 0.0001), backgroundColor: row.key ? categoryStrong(hue, themeMode) : undefined }}
    />
  );
}

/**
 * Una fila: el cuadro de 40 con el emoji (o la inicial; "Otros" sin emoji), el nombre a 16, el porcentaje en `mono`
 * con la variación y el monto. Desde `COMPACT_FONT_SCALE` el monto baja debajo del nombre.
 */
function BreakdownRow({
  row,
  first,
  emoji,
  currency,
  onPress,
  openLabel,
}: {
  row: CategoryRow;
  first: boolean;
  emoji: string | null;
  currency: string;
  onPress?: () => void;
  openLabel?: string;
}) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= COMPACT_FONT_SCALE;
  const amount = <Amount value={row.amount} currency={currency} style={{ fontFamily: fontFace.mono[600], fontSize: 15, lineHeight: 20 }} />;
  return (
    <View borderTopWidth={first ? 0 : 1} borderColor="$line">
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={`${row.label}, ${pct(row.percentage)}%`}
        accessibilityHint={openLabel}
      >
        {({ pressed }) => (
          <XStack items={stacked ? "flex-start" : "center"} gap={12} py={10} bg={pressed ? "$surfaceSunken" : undefined}>
            <Monogram name={row.label} emoji={emoji} size={38} />
            <YStack flex={1} minW={0} gap={2}>
              <FText numberOfLines={stacked ? undefined : 1} style={{ fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21, letterSpacing: -0.15 }}>
                {row.label}
              </FText>
              <XStack items="center" gap={8}>
                <FText tone="inkFaint" style={{ fontFamily: fontFace.mono[500], fontSize: 13, lineHeight: 18 }}>
                  {`${pct(row.percentage)}%`}
                </FText>
                <CategoryChange change={row.change} />
              </XStack>
              {stacked ? <View mt={2}>{amount}</View> : null}
            </YStack>
            {stacked ? null : amount}
            {onPress ? (
              <View pt={stacked ? 10 : 0}>
                <ChevronRight size={16} color="$inkFaint" strokeWidth={2.2} />
              </View>
            ) : null}
          </XStack>
        )}
      </Pressable>
    </View>
  );
}
