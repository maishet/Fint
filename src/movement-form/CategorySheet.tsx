import { Check, Grid2x2, Plus, Search, X } from "@tamagui/lucide-icons-2";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Text, View, XStack, YStack, useTheme } from "tamagui";
import type { Category } from "../api/types";
import { CreateCategorySheet } from "../components/CreateCategorySheet";
import { getCategoryLabel } from "../finance/categoryLabels";
import { categoryTint } from "../finance/categoryTint";
import { useCategoryHue } from "../finance/emojiHue";
import { useThemeMode } from "../theme/ThemeMode";
import { compactBlockMaxWidth, motion } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FintSheet, FText, SheetField, SheetTextInput } from "../ui";
import { MONOGRAM_RADIUS } from "../ui/Monogram";
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
 * El cuadro de una categoría, igual en la hoja y en el formulario: el emoji al 52 % sobre el fondo de su propio
 * tono (`categoryTint`), con radio del 32 % del lado; sin emoji, la inicial en `ink` sobre `surface`. Elegida, anillo
 * `ink` y la marca arriba a la derecha. `compact` es la versión del formulario (cinco en una fila: cuadro de 50px y
 * nombre a 11px).
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
  // El anillo `ink` crece desde el centro y la marca entra de 0.6 a 1, con `spring-ui`.
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.value = reduceMotion ? withTiming(selected ? 1 : 0, motion.fade) : withSpring(selected ? 1 : 0, motion.springUi);
  }, [on, reduceMotion, selected]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: on.value, transform: [{ scale: 0.7 + 0.3 * on.value }] }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: on.value, transform: [{ scale: 0.6 + 0.4 * on.value }] }));

  const initial = label.trim().charAt(0).toUpperCase() || "·";
  const DISC = compact ? COMPACT_DISC : SHEET_DISC;
  const hasEmoji = Boolean(category.icon?.trim());
  const hue = useCategoryHue(hasEmoji ? category.icon : null, category.name);
  const radius = Math.round(DISC * MONOGRAM_RADIUS);

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
          rounded={radius}
          items="center"
          justify="center"
          bg={hasEmoji ? undefined : "$surface"}
          style={hasEmoji ? { backgroundColor: categoryTint(hue, themeMode) } : undefined}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {hasEmoji ? (
            <Text
              allowFontScaling={false}
              style={{ fontSize: Math.round(DISC * 0.52), lineHeight: Math.round(DISC * 0.65), includeFontPadding: false, textAlign: "center" }}
            >
              {category.icon}
            </Text>
          ) : (
            <Text allowFontScaling={false} fontFamily={fontFace.display[700] as never} fontSize={Math.round(DISC * 0.4)} color="$ink">
              {initial}
            </Text>
          )}
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", width: DISC + 6, height: DISC + 6, borderRadius: radius + 3, borderWidth: 2, borderColor: theme.ink.val },
            ringStyle,
          ]}
        />
        <Animated.View pointerEvents="none" style={[{ position: "absolute", right: -3, top: -3 }, checkStyle]}>
          <View width={20} height={20} rounded={999} bg="$ink" borderWidth={2} borderColor={compact ? "$canvas" : "$surfaceOverlay"} items="center" justify="center">
            <Check size={11} color="$canvas" strokeWidth={3} />
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

/** "Nueva" en la hoja (cuadro `surface` con el más en tinta) o "Todas" en el formulario (`compact`, cuadro hundido con la cuadrícula). */
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
      <View width={DISC} height={DISC} rounded={Math.round(DISC * MONOGRAM_RADIUS)} items="center" justify="center" bg={compact ? "$surfaceSunken" : "$surface"}>
        {compact ? (
          <Grid2x2 size={20} color="$inkMuted" strokeWidth={2} />
        ) : (
          <Plus size={22} color="$ink" strokeWidth={2.2} />
        )}
      </View>
      <FText
        variant="caption"
        tone={compact ? "inkMuted" : "ink"}
        style={compact ? { fontSize: 11, lineHeight: 14 } : { fontFamily: fontFace.sans[600], lineHeight: 15 }}
      >
        {label}
      </FText>
    </Pressable>
  );
}
