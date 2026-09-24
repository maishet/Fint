import { Check, Plus, Search, X } from "@tamagui/lucide-icons-2";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Text, View, XStack, YStack, useTheme, type ColorTokens } from "tamagui";
import type { Category } from "../api/types";
import { CreateCategorySheet } from "../components/CreateCategorySheet";
import { getCategoryLabel } from "../finance/categoryLabels";
import { categoryColorIndex } from "../home/spending";
import { useThemeMode } from "../theme/ThemeMode";
import { motion } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FintSheet, FText, SheetField, SheetTextInput } from "../ui";
import { DashedOutline } from "../ui/DashedOutline";
import { haptics } from "../ui/haptics";

/** Tiempo para que la persona alcance a ver su elección antes de que la hoja se cierre. */
const CLOSE_DELAY = 180;
const DISC = 54;

export interface CategorySheetProps {
  open: boolean;
  onClose: () => void;
  type: "expense" | "income";
  categories: readonly Category[];
  frequent: readonly Category[];
  value: string;
  onSelect: (name: string) => void;
}

/**
 * Hoja de categoría: buscador, Frecuentes (las cuatro más usadas) y Todas en
 * cuatro columnas, con "Nueva" al final. Tocar elige y cierra; mantener
 * presionado ofrece editarla. Cada categoría lleva el emoji que la persona le
 * puso, chico en el disco neutro (sin emoji, la inicial en su color).
 */
export function CategorySheet({ open, onClose, type, categories, frequent, value, onSelect }: CategorySheetProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(value);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setPicked(value);
      setQuery("");
    }
  }, [open, value]);
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (needle ? categories.filter((c) => getCategoryLabel(c.name, t).toLowerCase().includes(needle)) : categories),
    [categories, needle, t],
  );

  const choose = (name: string) => {
    setPicked(name);
    haptics.select();
    onSelect(name);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(onClose, CLOSE_DELAY);
  };

  const tile = (c: Category) => (
    <CategoryTile
      key={c.id}
      category={c}
      label={getCategoryLabel(c.name, t)}
      selected={c.name === picked}
      onPress={() => choose(c.name)}
      onLongPress={() => {
        haptics.tap();
        setEditing(c);
      }}
    />
  );

  return (
    <>
      <FintSheet
        open={open && !createOpen && !editing}
        onClose={onClose}
        title={t("movementForm.category")}
        subtitle={t(type === "income" ? "movementForm.categorySheet.subtitleIncome" : "movementForm.categorySheet.subtitleExpense")}
        scrollable
        snapPoints={[86]}
      >
        <YStack px={16} pt={14}>
          <SheetField>
            <Search size={18} color="$inkFaint" />
            <SheetTextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("movementForm.categorySheet.search")}
              returnKeyType="search"
              accessibilityLabel={t("movementForm.categorySheet.search")}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("movementForm.clearSearch")}>
                <X size={16} color="$inkFaint" />
              </Pressable>
            ) : null}
          </SheetField>
        </YStack>

        {!needle && frequent.length > 0 ? (
          <>
            <SubTitle>{t("movementForm.categorySheet.frequent")}</SubTitle>
            <Grid>{frequent.map(tile)}</Grid>
          </>
        ) : null}

        {!needle ? <SubTitle>{t("movementForm.categorySheet.all")}</SubTitle> : <View height={10} />}
        <Grid>
          {filtered.map(tile)}
          <NewTile label={t("movementForm.categorySheet.newCategory")} onPress={() => setCreateOpen(true)} />
        </Grid>
        {needle && filtered.length === 0 ? (
          <FText variant="caption" tone="inkFaint" style={{ textAlign: "center", marginTop: 4 }}>
            {t("movementForm.categorySheet.empty")}
          </FText>
        ) : null}
        <View height={16} />
      </FintSheet>

      <CreateCategorySheet
        initialType={type}
        open={createOpen || Boolean(editing)}
        category={editing}
        onOpenChange={(next) => {
          if (next) return;
          setCreateOpen(false);
          setEditing(null);
        }}
        onCreated={(created) => {
          setCreateOpen(false);
          // Al crearse, la nueva queda elegida y se vuelve al formulario.
          onSelect(created.name);
          onClose();
        }}
        onUpdated={() => setEditing(null)}
      />
    </>
  );
}

function SubTitle({ children }: { children: string }) {
  return (
    <FText variant="caption" tone="inkMuted" style={{ fontFamily: fontFace.sans[600], marginTop: 18, marginBottom: 4, marginHorizontal: 20 }}>
      {children}
    </FText>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <XStack flexWrap="wrap" px={6}>
      {children}
    </XStack>
  );
}

function CategoryTile({
  category,
  label,
  selected,
  onPress,
  onLongPress,
}: {
  category: Category;
  label: string;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const theme = useTheme();
  const { themeMode } = useThemeMode();
  const reduceMotion = useReducedMotion();
  // El anillo `brand` crece desde el centro y la marca entra de 0.6 a 1, con `spring-ui`.
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.value = reduceMotion ? withTiming(selected ? 1 : 0, motion.fade) : withSpring(selected ? 1 : 0, motion.springUi);
  }, [on, reduceMotion, selected]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: on.value, transform: [{ scale: 0.7 + 0.3 * on.value }] }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: on.value, transform: [{ scale: 0.6 + 0.4 * on.value }] }));

  const initial = label.trim().charAt(0).toUpperCase() || "·";

  return (
    <Pressable
      style={{ width: "25%", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 2 }}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <View width={DISC} height={DISC} items="center" justify="center">
        <View
          width={DISC}
          height={DISC}
          rounded={999}
          items="center"
          justify="center"
          bg={selected ? "$brandWash" : "$surfaceSunken"}
          borderWidth={themeMode === "dark" && !selected ? 1 : 0}
          borderColor="$line"
        >
          {category.icon ? (
            <Text style={{ fontSize: 24, lineHeight: 30, includeFontPadding: false, textAlign: "center" }}>{category.icon}</Text>
          ) : (
            <Text fontFamily={fontFace.display[600] as never} fontSize={20} color={`$chart${categoryColorIndex(category.name)}` as ColorTokens}>
              {initial}
            </Text>
          )}
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", width: DISC + 4, height: DISC + 4, borderRadius: 999, borderWidth: 2, borderColor: theme.brand.val },
            ringStyle,
          ]}
        />
        <Animated.View pointerEvents="none" style={[{ position: "absolute", right: -3, top: -3 }, checkStyle]}>
          <View width={20} height={20} rounded={999} bg="$brand" borderWidth={2} borderColor="$surfaceOverlay" items="center" justify="center">
            <Check size={11} color="$onBrand" strokeWidth={3} />
          </View>
        </Animated.View>
      </View>
      <FText
        variant="caption"
        tone={selected ? "ink" : "inkMuted"}
        numberOfLines={1}
        style={[{ maxWidth: "100%", letterSpacing: -0.1, lineHeight: 15 }, selected ? { fontFamily: fontFace.sans[600] } : null]}
      >
        {label}
      </FText>
    </Pressable>
  );
}

function NewTile({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      style={{ width: "25%", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 2 }}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View width={DISC} height={DISC} rounded={999} items="center" justify="center">
        <DashedOutline radius={DISC / 2} />
        <Plus size={22} color="$brand" strokeWidth={2.2} />
      </View>
      <FText variant="caption" tone="brand" style={{ fontFamily: fontFace.sans[600], lineHeight: 15 }}>
        {label}
      </FText>
    </Pressable>
  );
}
