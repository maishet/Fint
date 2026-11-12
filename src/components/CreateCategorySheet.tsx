import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Plus, Trash2 } from "@tamagui/lucide-icons-2";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text as RNText, type TextInput } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import EmojiPicker, { en, es, pt, type EmojiType } from "rn-emoji-keyboard";
import { useTheme, View, XStack, YStack } from "tamagui";
import { z } from "zod";
import { ApiRequestError } from "../api/client";
import { financeApi } from "../api/finance";
import type { Category, CategoryMutationResult, CreateCategoryResult, TransactionType } from "../api/types";
import { suggestedCategoryIcons } from "../finance/categoryIcons";
import { categoryTint } from "../finance/categoryTint";
import { useCategoryHue } from "../finance/emojiHue";
import { getValidationMessage, useSubmitValidation } from "../forms";
import { useThemeMode } from "../theme/ThemeMode";
import { motion, radius, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { ErrorLine, FintButton, FintSheet, FintSpinner, FText, PressableScale, SegmentedControl, SheetField, SheetTextInput, useNotify } from "../ui";
import { haptics } from "../ui/haptics";

interface CreateCategorySheetProps {
  initialType: TransactionType;
  category?: Category | null;
  onCreated?: (category: CreateCategoryResult) => void;
  onUpdated?: (result: CategoryMutationResult) => void;
  /** Al editar, "Eliminar categoría" debajo del botón. Sin esto no aparece. */
  onDelete?: (category: Category) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

const SUGGESTIONS = 5;

/**
 * Nueva o editar categoría (marca D, K-07). Sube sobre Categorías o sobre el
 * selector de categorías del formulario; ahí, al crear, la nueva queda elegida.
 * El tipo (Egreso | Ingreso en tinta; al editar, una píldora bloqueada:
 * cambiarlo movería el historial), el emoji grande de 84 sobre `categoryTint`
 * de su propio tono con el lápiz en tinta (abre el selector completo), el
 * nombre con foco al abrir, y cinco sugeridos en cuadros de 52 con su fondo,
 * que cambian mientras se escribe, más "Más". Si la persona no elige, se usa el
 * primero sugerido.
 */
export function CreateCategorySheet({ initialType, category, onCreated, onUpdated, onDelete, onOpenChange, open }: CreateCategorySheetProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { themeMode } = useThemeMode();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const isEditing = Boolean(category);
  const [name, setName] = useState("");
  const [type, setType] = useState<TransactionType>(initialType);
  const [icon, setIcon] = useState("🛒");
  const [iconChanged, setIconChanged] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const validation = useSubmitValidation<"name">();
  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMessage(null);
    validation.resetErrors();
    if (category) {
      setName(category.name);
      setType(category.type);
      setIcon(category.icon || suggestedCategoryIcons(category.name, category.type)[0]);
      setIconChanged(true);
      return;
    }
    setName("");
    setType(initialType);
    setIcon(suggestedCategoryIcons("", initialType)[0] ?? "🛒");
    setIconChanged(false);
    // Al crear, el nombre toma el foco apenas sube la hoja: la persona escribe de inmediato.
    const id = setTimeout(() => input.current?.focus(), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category]);

  const mutation = useMutation<CreateCategoryResult | CategoryMutationResult, Error, string>({
    mutationFn: (categoryName: string) =>
      isEditing
        ? financeApi.updateCategory(category!.id, { name: categoryName, icon })
        : financeApi.createCategory({ name: categoryName, type, icon }),
    onSuccess: async (result) => {
      await Promise.all(["categories", "dashboard", "reports", "transactions"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      notify.success(t(isEditing ? "categories.updatedToast" : "categories.createdToast"), {
        message: t(isEditing ? "categories.updatedMessage" : "categories.createdMessage"),
      });
      onOpenChange(false);
      if (isEditing) onUpdated?.(result as CategoryMutationResult);
      else onCreated?.(result as CreateCategoryResult);
    },
    onError: (error) =>
      setErrorMessage(
        error instanceof ApiRequestError && error.code === "category_name_exists"
          ? t(type === "income" ? "categorySheet.duplicateIncome" : "categorySheet.duplicateExpense")
          : error instanceof Error
            ? error.message
            : t("states.error"),
      ),
  });

  const submit = () => {
    setErrorMessage(null);
    const schema = z.object({
      name: z
        .string()
        .trim()
        .min(2, getValidationMessage(t, i18n.resolvedLanguage, "minTwo")),
    });
    const payload = validation.validate(schema, { name });
    if (payload) mutation.mutate(payload.name);
  };
  const close = () => {
    if (!mutation.isPending) onOpenChange(false);
  };
  const pick = (emoji: string) => {
    haptics.select();
    setIcon(emoji);
    setIconChanged(true);
  };

  // Cinco sugeridos para el nombre y el tipo. Si el emoji elegido no está entre ellos (lo eligió en "Más", o al
  // editar), va primero: así siempre se ve marcado, y la fila no se reordena al tocar uno.
  const suggested = suggestedCategoryIcons(name, type).slice(0, SUGGESTIONS);
  const suggestions = suggested.includes(icon) ? suggested : [icon, ...suggested].slice(0, SUGGESTIONS);
  const nameError = validation.errors.name ?? errorMessage;
  const hue = useCategoryHue(icon, name || icon);
  const typeLabel = type === "income" ? t("categorySheet.income") : t("categorySheet.expense");

  return (
    <>
      <FintSheet
        open={open}
        onClose={close}
        title={t(isEditing ? "categories.editTitle" : "categories.newTitle")}
        subtitle={t(isEditing ? "categorySheet.editHelp" : "categorySheet.newHelp")}
      >
        <YStack px={space[4]} pt={14} pb={space[2]}>
          {isEditing ? (
            <XStack items="center" gap={8} height={40} px={14} rounded={radius.pill} bg="$surfaceSunken">
              <Lock size={14} color="$inkMuted" strokeWidth={2} />
              <FText variant="label" tone="inkMuted" numberOfLines={1}>
                {t("categorySheet.lockedType")}{" "}
                <FText variant="label" style={{ fontFamily: fontFace.sans[600] }}>
                  {typeLabel}
                </FText>{" "}
                {t("categorySheet.lockedNote")}
              </FText>
            </XStack>
          ) : (
            <SegmentedControl
              options={[
                { value: "expense" as const, label: t("categorySheet.expense") },
                { value: "income" as const, label: t("categorySheet.income") },
              ]}
              value={type}
              onChange={(next) => {
                setType(next);
                if (!iconChanged) setIcon(suggestedCategoryIcons(name, next)[0] ?? icon);
              }}
            />
          )}

          {/* El emoji elegido, grande, sobre el fondo de su propio tono; tocarlo abre el selector completo. Al cambiar
              de emoji, el cuadro nuevo entra con `fade` (cruce del fondo y del emoji). */}
          <YStack items="center" mt={18} mb={4}>
            <Pressable onPress={() => setPickerOpen(true)} accessibilityRole="button" accessibilityLabel={t("categoryUx.changeEmoji")}>
              <View width={BIG_TILE} height={BIG_TILE}>
                <Animated.View
                  key={icon}
                  entering={FadeIn.duration(motion.fade.duration)}
                  style={{
                    width: BIG_TILE,
                    height: BIG_TILE,
                    borderRadius: Math.round(BIG_TILE * 0.32),
                    backgroundColor: categoryTint(hue, themeMode),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Emoji size={46}>{icon}</Emoji>
                </Animated.View>
                <View
                  position="absolute"
                  r={-6}
                  b={-6}
                  width={32}
                  height={32}
                  rounded={999}
                  bg="$ink"
                  borderWidth={3}
                  borderColor="$surfaceOverlay"
                  items="center"
                  justify="center"
                >
                  <Pencil size={14} color="$canvas" strokeWidth={2.4} />
                </View>
              </View>
            </Pressable>
          </YStack>

          <FText tone="inkFaint" style={{ fontFamily: fontFace.sans[600], fontSize: 13, lineHeight: 18, marginTop: 14, marginBottom: 6, marginLeft: 2 }}>
            {t("categorySheet.name")}
          </FText>
          <SheetField focused={focused} invalid={Boolean(nameError)}>
            <SheetTextInput
              ref={input}
              value={name}
              onChangeText={(value) => {
                setName(value);
                validation.clearError("name");
                setErrorMessage(null);
                if (!iconChanged) setIcon(suggestedCategoryIcons(value, type)[0] ?? icon);
              }}
              placeholder={t("categories.namePlaceholder")}
              accessibilityLabel={t("categorySheet.name")}
              autoCapitalize="sentences"
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={submit}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </SheetField>
          {nameError ? <ErrorLine message={nameError} /> : null}

          <FText
            tone="inkFaint"
            numberOfLines={1}
            style={{ fontFamily: fontFace.sans[600], fontSize: 13, lineHeight: 18, marginTop: 16, marginBottom: 8, marginHorizontal: 2 }}
          >
            {name.trim() ? t("categorySheet.suggestedFor", { name: name.trim() }) : t("categorySheet.suggested")}
          </FText>
          <XStack gap={8}>
            {suggestions.map((option) => (
              <SuggestionTile key={option} emoji={option} selected={option === icon} onPress={() => pick(option)} />
            ))}
            <PressableScale
              style={{ flex: 1 }}
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t("categoryUx.changeEmoji")}
            >
              <YStack height={SMALL_TILE} rounded={17} items="center" justify="center" gap={1} bg="$surfaceSunken">
                <Plus size={16} color="$ink" strokeWidth={2.4} />
                <FText maxFontSizeMultiplier={1.3} style={{ fontFamily: fontFace.sans[600], fontSize: 11, lineHeight: 14 }}>
                  {t("categorySheet.more")}
                </FText>
              </YStack>
            </PressableScale>
          </XStack>

          <YStack mt={18} gap={10}>
            <FintButton pending={mutation.isPending} onPress={submit}>
              {mutation.isPending ? <FintSpinner color="$onBrand" /> : t(isEditing ? "categories.update" : "categories.create")}
            </FintButton>
            {isEditing && category && onDelete ? (
              <FintButton
                variant="destructive"
                size="row"
                disabled={mutation.isPending}
                icon={<Trash2 size={16} color="$dangerHard" strokeWidth={2} />}
                onPress={() => onDelete(category)}
              >
                {t("categorySheet.delete")}
              </FintButton>
            ) : null}
          </YStack>
        </YStack>
      </FintSheet>

      <EmojiPicker
        open={pickerOpen}
        defaultHeight={500}
        onClose={() => setPickerOpen(false)}
        onEmojiSelected={(emoji: EmojiType) => {
          pick(emoji.emoji);
          setPickerOpen(false);
        }}
        emojiSize={30}
        translation={i18n.resolvedLanguage === "en" ? en : i18n.resolvedLanguage === "pt" ? pt : es}
        enableSearchBar
        enableRecentlyUsed
        categoryPosition="top"
        theme={{
          backdrop: theme.scrim.val,
          knob: theme.lineStrong.val,
          container: theme.surfaceOverlay.val,
          header: theme.inkMuted.val,
          skinTonesContainer: theme.surfaceSunken.val,
          category: {
            icon: theme.inkFaint.val,
            iconActive: theme.ink.val,
            container: theme.surfaceSunken.val,
            containerActive: theme.surface.val,
          },
          search: {
            background: theme.surfaceSunken.val,
            text: theme.ink.val,
            placeholder: theme.inkFaint.val,
            icon: theme.inkFaint.val,
          },
          customButton: {
            icon: theme.ink.val,
            iconPressed: theme.ink.val,
            background: theme.surfaceSunken.val,
            backgroundPressed: theme.surface.val,
          },
          // Marca D: lo elegido en el selector va sobre `surface`, sin el lavado amarillo.
          emoji: { selected: theme.surface.val },
        }}
      />
    </>
  );
}

/** El emoji grande de la hoja (84) y los sugeridos (52). */
const BIG_TILE = 84;
const SMALL_TILE = 52;

/** Un sugerido: el emoji sobre el fondo de su tono; el elegido con anillo tinta de 2.5. */
function SuggestionTile({ emoji, selected, onPress }: { emoji: string; selected: boolean; onPress: () => void }) {
  const { themeMode } = useThemeMode();
  const hue = useCategoryHue(emoji, emoji);
  return (
    <PressableScale style={{ flex: 1 }} onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={emoji}>
      <View
        height={SMALL_TILE}
        rounded={17}
        items="center"
        justify="center"
        borderWidth={selected ? 2.5 : 0}
        borderColor="$ink"
        style={{ backgroundColor: categoryTint(hue, themeMode) }}
      >
        <Emoji size={24}>{emoji}</Emoji>
      </View>
    </PressableScale>
  );
}

function Emoji({ size, children }: { size: number; children: string }) {
  return <RNText style={{ fontSize: size, lineHeight: Math.round(size * 1.25), includeFontPadding: false, textAlign: "center" }}>{children}</RNText>;
}
