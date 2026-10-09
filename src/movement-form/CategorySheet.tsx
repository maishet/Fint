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
import { compactBlockMaxWidth, motion } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FintSheet, FText, SheetField, SheetTextInput } from "../ui";
import { DashedOutline } from "../ui/DashedOutline";
import { haptics } from "../ui/haptics";

/** Tiempo para que la persona alcance a ver su elección antes de que la hoja se cierre. */
const CLOSE_DELAY = 180;
/** Si la hoja no avisa que terminó de subir (p. ej. sin animación), la grilla se monta igual pasado este tiempo. */
const READY_FALLBACK_MS = 2500;
/** Lo que tarda la hoja de crear/editar en bajar antes de desmontarla. */
const CREATE_UNMOUNT_MS = 600;
/** Discos del esqueleto de "Todas": los que caben a la vista; el resto llega con la grilla real. */
const SKELETON_TILES = 20;
/** El disco de la hoja y el del formulario (cinco en una fila). */
const SHEET_DISC = 54;
const COMPACT_DISC = 50;

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
  // La grilla (un disco animado por categoría) se monta cuando la hoja terminó de subir; mientras, un esqueleto. Montada
  // de entrada, la hoja tardaba ~3 s en subir: primero se construía entera y recién después empezaba la animación.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!open || ready) return;
    const id = setTimeout(() => setReady(true), READY_FALLBACK_MS);
    return () => clearTimeout(id);
  }, [open, ready]);
  // La hoja de crear/editar (con el selector de emojis) se monta solo al usarla, cerrada primero para que suba con su
  // animación, y se desmonta al terminar de bajar.
  const [createMounted, setCreateMounted] = useState(false);
  const createShown = createOpen || Boolean(editing);
  const openCreate = (target: Category | null) => {
    setCreateMounted(true);
    requestAnimationFrame(() => (target ? setEditing(target) : setCreateOpen(true)));
  };
  useEffect(() => {
    if (createShown) return;
    const id = setTimeout(() => setCreateMounted(false), CREATE_UNMOUNT_MS);
    return () => clearTimeout(id);
  }, [createShown]);

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
        openCreate(c);
      }}
      longPressLabel={t("movementForm.categorySheet.editAction")}
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
        onOpened={() => setReady(true)}
      >
        <YStack width="100%" maxW={compactBlockMaxWidth} self="center">
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
              <Grid>{ready ? frequent.map(tile) : <TileSkeletons count={frequent.length} />}</Grid>
            </>
          ) : null}

          {!needle ? <SubTitle>{t("movementForm.categorySheet.all")}</SubTitle> : <View height={10} />}
          <Grid>
            {ready ? (
              <>
                {filtered.map(tile)}
                <NewTile label={t("movementForm.categorySheet.newCategory")} onPress={() => openCreate(null)} />
              </>
            ) : (
              <TileSkeletons count={Math.min(categories.length + 1, SKELETON_TILES)} />
            )}
          </Grid>
          {needle && filtered.length === 0 ? (
            <FText variant="caption" tone="inkFaint" style={{ textAlign: "center", marginTop: 4 }}>
              {t("movementForm.categorySheet.empty")}
            </FText>
          ) : null}
          <View height={16} />
        </YStack>
      </FintSheet>

      {createMounted ? (
        <CreateCategorySheet
          initialType={type}
          open={createShown}
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
      ) : null}
    </>
  );
}

/** Discos de la grilla mientras la hoja sube: el mismo tamaño que `CategoryTile`, para que nada salte al llegar. */
function TileSkeletons({ count }: { count: number }) {
  return Array.from({ length: count }, (_, i) => (
    <View
      key={i}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: "25%", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 2 }}
    >
      {/* En oscuro `surfaceSunken` casi no se distingue de la hoja: el disco lleva el filete `line`, como `SheetField`. */}
      <View width={SHEET_DISC} height={SHEET_DISC} rounded={999} bg="$surfaceSunken" borderWidth={1} borderColor="$line" />
      <View height={15} justify="center">
        <View width={44} height={8} rounded={999} bg="$line" />
      </View>
    </View>
  ));
}

function SubTitle({ children }: { children: string }) {
  return (
    <FText
      variant="caption"
      tone="inkMuted"
      accessibilityRole="header"
      style={{ fontFamily: fontFace.sans[600], marginTop: 18, marginBottom: 4, marginHorizontal: 20 }}
    >
      {children}
    </FText>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <XStack flexWrap="wrap" px={6} accessibilityRole="radiogroup">
      {children}
    </XStack>
  );
}

/**
 * El disco de una categoría, igual en la hoja y en el formulario: el emoji en el disco neutro y, elegida, fondo
 * `brandWash`, anillo `brand` y la marca arriba a la derecha. `compact` es la versión del formulario (cinco en una
 * fila: disco de 50px y nombre a 11px).
 */
export function CategoryTile({
  category,
  label,
  selected,
  onPress,
  onLongPress,
  longPressLabel,
  compact = false,
}: {
  category: Category;
  label: string;
  selected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  /** Nombre de lo que hace mantener presionado, para ofrecerlo al lector de pantalla como acción. */
  longPressLabel?: string;
  compact?: boolean;
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
  const DISC = compact ? COMPACT_DISC : SHEET_DISC;

  return (
    <Pressable
      style={{ width: compact ? "20%" : "25%", alignItems: "center", gap: 6, paddingVertical: compact ? 4 : 8, paddingHorizontal: 2 }}
      onPress={onPress}
      onLongPress={onLongPress}
      // Elegir categoría es una opción única: "radio" con "marcado", dentro de un `radiogroup` (la grilla o la fila del formulario).
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      accessibilityActions={onLongPress && longPressLabel ? [{ name: "longpress", label: longPressLabel }] : undefined}
      onAccessibilityAction={() => onLongPress?.()}
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
          <View width={20} height={20} rounded={999} bg="$brand" borderWidth={2} borderColor={compact ? "$canvas" : "$surfaceOverlay"} items="center" justify="center">
            <Check size={11} color="$onBrand" strokeWidth={3} />
          </View>
        </Animated.View>
      </View>
      <FText
        variant="caption"
        tone={selected ? "ink" : "inkMuted"}
        numberOfLines={1}
        style={[
          { maxWidth: "100%", letterSpacing: compact ? -0.2 : -0.1, lineHeight: compact ? 14 : 15 },
          compact ? { fontSize: 11 } : null,
          selected ? { fontFamily: fontFace.sans[600] } : null,
        ]}
      >
        {label}
      </FText>
    </Pressable>
  );
}

/** El disco punteado: "Nueva" en la hoja (en `brand`) u "Otra" en el formulario (`compact`, en `inkMuted`). */
export function NewTile({ label, onPress, compact = false }: { label: string; onPress: () => void; compact?: boolean }) {
  const DISC = compact ? COMPACT_DISC : SHEET_DISC;
  return (
    <Pressable
      style={{ width: compact ? "20%" : "25%", alignItems: "center", gap: 6, paddingVertical: compact ? 4 : 8, paddingHorizontal: 2 }}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View width={DISC} height={DISC} rounded={999} items="center" justify="center">
        <DashedOutline radius={DISC / 2} />
        <Plus size={compact ? 20 : 22} color={compact ? "$inkMuted" : "$brand"} strokeWidth={2.2} />
      </View>
      <FText
        variant="caption"
        tone={compact ? "inkMuted" : "brand"}
        style={compact ? { fontSize: 11, lineHeight: 14 } : { fontFamily: fontFace.sans[600], lineHeight: 15 }}
      >
        {label}
      </FText>
    </Pressable>
  );
}
