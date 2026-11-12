import { Ellipsis } from "@tamagui/lucide-icons-2";
import { Text, View, XStack, YStack } from "tamagui";
import type { Category } from "../api/types";
import { categoryTint } from "../finance/categoryTint";
import { useCategoryHue } from "../finance/emojiHue";
import { useThemeMode } from "../theme/ThemeMode";
import { COMPACT_FONT_SCALE } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FText, PressableScale } from "../ui";
import { MONOGRAM_RADIUS } from "../ui/Monogram";
import { haptics } from "../ui/haptics";

/** Columnas de la cuadrícula: con «Todas» son dos filas de cuatro. */
export const CATEGORY_GRID_COLUMNS = 4;
/** Cuántas categorías frecuentes caben junto a «Todas». */
export const CATEGORY_GRID_MAX = CATEGORY_GRID_COLUMNS * 2 - 1;
/** Lado del cuadro del emoji. */
const TILE = 48;
const TILE_RADIUS = Math.round(TILE * MONOGRAM_RADIUS);
/** Grosor del anillo de la elegida y su separación del cuadro. */
const RING = 2;
const RING_GAP = 2;
const RING_SIZE = TILE + (RING + RING_GAP) * 2;

export interface CategoryStripProps {
  categories: readonly { category: Category; label: string }[];
  value: string;
  onSelect: (name: string) => void;
  /** La primera casilla, «Todas»: abre la hoja con todas las categorías. */
  onAll: () => void;
  allLabel: string;
  /** El nombre corto bajo la casilla de «Todas». */
  allShortLabel: string;
  /** Mientras carga: cuadros vacíos con la misma forma. */
  loading?: boolean;
  accessibilityLabel: string;
}

/**
 * Las categorías del formulario (marca D) en una cuadrícula de dos filas de cuatro, sin deslizar: primero «Todas»,
 * que abre la hoja de categorías, y luego las frecuentes como cuadros de 48 con su emoji sobre el fondo de su tono y
 * el nombre debajo. La elegida lleva un anillo de tinta y el nombre en negrita. Ocupa el espacio libre que deja el
 * monto en lugar de una tira que se escondía a la derecha. Es un grupo de opción única para el lector.
 */
export function CategoryStrip({ categories, value, onSelect, onAll, allLabel, allShortLabel, loading = false, accessibilityLabel }: CategoryStripProps) {
  return (
    <XStack px={14} flexWrap="wrap" rowGap={10} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      <Cell>
        <PressableScale onPress={onAll} haptic="tap" accessibilityRole="button" accessibilityLabel={allLabel}>
          <YStack items="center" gap={4}>
            <Ring selected={false}>
              <View width={TILE} height={TILE} rounded={TILE_RADIUS} bg="$surface" items="center" justify="center">
                <Ellipsis size={22} color="$ink" strokeWidth={2.2} />
              </View>
            </Ring>
            <TileLabel label={allShortLabel} selected={false} />
          </YStack>
        </PressableScale>
      </Cell>
      {loading
        ? Array.from({ length: CATEGORY_GRID_MAX }, (_, i) => (
            <Cell key={i}>
              <YStack items="center" gap={4} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Ring selected={false}>
                  <View width={TILE} height={TILE} rounded={TILE_RADIUS} bg="$surface" />
                </Ring>
                <View width={44} height={10} mt={3} rounded={999} bg="$surface" />
              </YStack>
            </Cell>
          ))
        : categories.map(({ category, label }) => (
            <Cell key={category.id}>
              <CategoryTile
                category={category}
                label={label}
                selected={category.name === value}
                onPress={() => {
                  haptics.select();
                  onSelect(category.name);
                }}
              />
            </Cell>
          ))}
    </XStack>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <View width={`${100 / CATEGORY_GRID_COLUMNS}%`} px={4} items="center">
      {children}
    </View>
  );
}

function Ring({ selected, children }: { selected: boolean; children: React.ReactNode }) {
  return (
    <View
      width={RING_SIZE}
      height={RING_SIZE}
      rounded={TILE_RADIUS + RING + RING_GAP}
      borderWidth={RING}
      borderColor={selected ? "$ink" : "transparent"}
      items="center"
      justify="center"
    >
      {children}
    </View>
  );
}

function TileLabel({ label, selected }: { label: string; selected: boolean }) {
  return (
    <FText
      numberOfLines={1}
      maxFontSizeMultiplier={COMPACT_FONT_SCALE}
      color={selected ? "$ink" : "$inkMuted"}
      style={{ fontFamily: selected ? fontFace.display[700] : fontFace.sans[600], fontSize: 12, lineHeight: 16, textAlign: "center", maxWidth: "100%" }}
    >
      {label}
    </FText>
  );
}

function CategoryTile({ category, label, selected, onPress }: { category: Category; label: string; selected: boolean; onPress: () => void }) {
  const { themeMode } = useThemeMode();
  const emoji = category.icon?.trim() || null;
  const hue = useCategoryHue(emoji, category.name);
  return (
    <PressableScale onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={label} style={{ width: "100%" }}>
      <YStack items="center" gap={4}>
        <Ring selected={selected}>
          <View
            width={TILE}
            height={TILE}
            rounded={TILE_RADIUS}
            items="center"
            justify="center"
            bg={emoji ? undefined : "$surface"}
            style={emoji ? { backgroundColor: categoryTint(hue, themeMode) } : undefined}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {emoji ? (
              <Text allowFontScaling={false} style={{ fontSize: 24, lineHeight: 30, includeFontPadding: false }}>
                {emoji}
              </Text>
            ) : (
              <Text allowFontScaling={false} color="$ink" style={{ fontFamily: fontFace.display[700], fontSize: 20 }}>
                {label.trim().charAt(0).toUpperCase() || "·"}
              </Text>
            )}
          </View>
        </Ring>
        <TileLabel label={label} selected={selected} />
      </YStack>
    </PressableScale>
  );
}
