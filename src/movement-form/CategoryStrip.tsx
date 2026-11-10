import { Ellipsis } from "@tamagui/lucide-icons-2";
import { ScrollView } from "react-native";
import { Text, View, XStack } from "tamagui";
import type { Category } from "../api/types";
import { categoryTint } from "../finance/categoryTint";
import { useCategoryHue } from "../finance/emojiHue";
import { useThemeMode } from "../theme/ThemeMode";
import { COMPACT_FONT_SCALE } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FText, PressableScale } from "../ui";
import { haptics } from "../ui/haptics";

/** Alto de las fichas de la tira y del botón de ver todas. */
const CHIP = 44;
/** El círculo del emoji dentro de la ficha. */
const EMOJI_DISC = 32;

export interface CategoryStripProps {
  categories: readonly { category: Category; label: string }[];
  value: string;
  onSelect: (name: string) => void;
  /** El botón de tres puntos al inicio: abre la hoja con todas las categorías. */
  onAll: () => void;
  allLabel: string;
  /** Mientras carga: círculos y fichas vacías con la misma forma. */
  loading?: boolean;
  accessibilityLabel: string;
}

/**
 * La tira de categorías del formulario (marca D): primero el botón de tres puntos que abre la hoja de categorías y
 * luego las frecuentes como fichas de 44 con su emoji sobre el fondo de su tono. La elegida va en tinta (`chipOn`).
 * Se desliza en horizontal; es un grupo de opción única para el lector.
 */
export function CategoryStrip({ categories, value, onSelect, onAll, allLabel, loading = false, accessibilityLabel }: CategoryStripProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      <PressableScale onPress={onAll} haptic="tap" accessibilityRole="button" accessibilityLabel={allLabel}>
        <View width={CHIP} height={CHIP} rounded={999} bg="$surface" items="center" justify="center">
          <Ellipsis size={20} color="$ink" strokeWidth={2.2} />
        </View>
      </PressableScale>
      {loading
        ? [96, 84, 110].map((w, i) => (
            <View key={i} width={w} height={CHIP} rounded={999} bg="$surface" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          ))
        : categories.map(({ category, label }) => (
            <CategoryChip
              key={category.id}
              category={category}
              label={label}
              selected={category.name === value}
              onPress={() => {
                haptics.select();
                onSelect(category.name);
              }}
            />
          ))}
    </ScrollView>
  );
}

function CategoryChip({ category, label, selected, onPress }: { category: Category; label: string; selected: boolean; onPress: () => void }) {
  const { themeMode } = useThemeMode();
  const emoji = category.icon?.trim() || null;
  const hue = useCategoryHue(emoji, category.name);
  return (
    <PressableScale onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={label}>
      <XStack height={CHIP} pl={6} pr={14} gap={8} items="center" rounded={999} bg={selected ? "$chipOn" : "$surface"}>
        <View
          width={EMOJI_DISC}
          height={EMOJI_DISC}
          rounded={999}
          items="center"
          justify="center"
          bg={emoji ? undefined : "$canvas"}
          style={emoji ? { backgroundColor: categoryTint(hue, themeMode) } : undefined}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {emoji ? (
            <Text allowFontScaling={false} style={{ fontSize: 18, lineHeight: 22, includeFontPadding: false }}>
              {emoji}
            </Text>
          ) : (
            <Text allowFontScaling={false} color="$ink" style={{ fontFamily: fontFace.display[700], fontSize: 14 }}>
              {label.trim().charAt(0).toUpperCase() || "·"}
            </Text>
          )}
        </View>
        <FText
          numberOfLines={1}
          maxFontSizeMultiplier={COMPACT_FONT_SCALE}
          color={selected ? "$onChipOn" : "$ink"}
          style={{ fontFamily: fontFace.sans[600], fontSize: 14, lineHeight: 19, maxWidth: 160 }}
        >
          {label}
        </FText>
      </XStack>
    </PressableScale>
  );
}
