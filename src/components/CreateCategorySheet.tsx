import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Lock, Pencil, Trash2 } from "@tamagui/lucide-icons-2";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text as RNText, type TextInput } from "react-native";
import EmojiPicker, { en, es, pt, type EmojiType } from "rn-emoji-keyboard";
import { useTheme, View, XStack, YStack } from "tamagui";
import { z } from "zod";
import { ApiRequestError } from "../api/client";
import { financeApi } from "../api/finance";
import type { Category, CategoryMutationResult, CreateCategoryResult, TransactionType } from "../api/types";
import { suggestedCategoryIcons } from "../finance/categoryIcons";
import { getValidationMessage, useSubmitValidation } from "../forms";
import { useThemeMode } from "../theme/ThemeMode";
import { radius, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FintButton, FintSheet, FintSpinner, FText, PressableScale, SegmentedControl, SheetField, SheetTextInput, useNotify } from "../ui";
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
 * Nueva o editar categoría (HojaCategoria). Sube sobre Categorías o sobre el
 * selector de categorías del formulario; ahí, al crear, la nueva queda elegida.
 * El tipo (Egreso | Ingreso; al editar, una píldora bloqueada: cambiarlo
 * movería el historial), el emoji grande en un disco de 76px con el lápiz
 * `brand` (abre el selector completo), el nombre con foco al abrir, y cinco
 * sugeridos que cambian mientras se escribe, más "Más". Si la persona no elige,
 * se usa el primero sugerido.
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
  const sunkenLine = themeMode === "dark" ? "$line" : "$surfaceSunken";
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

          {/* El emoji elegido, grande; tocarlo abre el selector completo. */}
          <YStack items="center" mt={18} mb={4}>
            <Pressable onPress={() => setPickerOpen(true)} accessibilityRole="button" accessibilityLabel={t("categoryUx.changeEmoji")}>
              <View width={76} height={76} rounded={999} bg="$surfaceSunken" items="center" justify="center">
                <Emoji size={36}>{icon}</Emoji>
                <View
                  position="absolute"
                  r={-2}
                  b={-2}
                  width={28}
                  height={28}
                  rounded={999}
                  bg="$brand"
                  borderWidth={3}
                  borderColor="$surfaceOverlay"
                  items="center"
                  justify="center"
                >
                  <Pencil size={13} color="$onBrand" strokeWidth={2.4} />
                </View>
              </View>
            </Pressable>
          </YStack>

          <FText variant="caption" tone="inkMuted" style={{ marginTop: 12, marginBottom: 6, marginLeft: 2 }}>
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
          {nameError ? (
            <XStack items="center" gap={5} mt={6} mx={2} accessibilityRole="alert">
              <CircleAlert size={13} color="$dangerHard" strokeWidth={2.2} />
              <FText variant="caption" tone="dangerHard" style={{ flex: 1, fontFamily: fontFace.sans[600] }}>
                {nameError}
              </FText>
            </XStack>
          ) : null}

          <FText
            variant="caption"
            tone="inkMuted"
            numberOfLines={1}
            style={{ fontFamily: fontFace.sans[600], marginTop: 16, marginBottom: 8, marginHorizontal: 2 }}
          >
            {name.trim() ? t("categorySheet.suggestedFor", { name: name.trim() }) : t("categorySheet.suggested")}
          </FText>
          <XStack gap={8}>
            {suggestions.map((option) => {
              const selected = option === icon;
              return (
                <PressableScale
                  key={option}
                  style={{ flex: 1 }}
                  onPress={() => pick(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option}
                >
                  <View
                    height={46}
                    rounded={radius.md}
                    items="center"
                    justify="center"
                    bg={selected ? "$brandWash" : "$surfaceSunken"}
                    borderWidth={selected ? 2 : 1}
                    borderColor={selected ? "$brand" : sunkenLine}
                  >
                    <Emoji size={22}>{option}</Emoji>
                  </View>
                </PressableScale>
              );
            })}
            <PressableScale
              style={{ flex: 1 }}
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t("categoryUx.changeEmoji")}
            >
              <View height={46} rounded={radius.md} items="center" justify="center" bg="$surfaceSunken" borderWidth={1} borderColor={sunkenLine}>
                <FText variant="label" tone="inkMuted" style={{ fontFamily: fontFace.sans[600] }}>
                  {t("categorySheet.more")}
                </FText>
              </View>
            </PressableScale>
          </XStack>

          <YStack mt={18} gap={10}>
            <FintButton disabled={mutation.isPending} onPress={submit}>
              {mutation.isPending ? <FintSpinner color="$onBrand" /> : t(isEditing ? "categories.update" : "categories.create")}
            </FintButton>
            {isEditing && category && onDelete ? (
              <PressableScale onPress={() => onDelete(category)} disabled={mutation.isPending} accessibilityRole="button">
                <XStack height={40} items="center" justify="center" gap={8}>
                  <Trash2 size={16} color="$dangerHard" strokeWidth={2} />
                  <FText variant="body-strong" tone="dangerHard" style={{ fontSize: 14 }}>
                    {t("categorySheet.delete")}
                  </FText>
                </XStack>
              </PressableScale>
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
            iconActive: theme.brand.val,
            container: theme.surfaceSunken.val,
            containerActive: theme.brandWash.val,
          },
          search: {
            background: theme.surfaceSunken.val,
            text: theme.ink.val,
            placeholder: theme.inkFaint.val,
            icon: theme.inkFaint.val,
          },
          customButton: {
            icon: theme.brand.val,
            iconPressed: theme.ink.val,
            background: theme.surfaceSunken.val,
            backgroundPressed: theme.brandWash.val,
          },
          emoji: { selected: theme.brandWash.val },
        }}
      />
    </>
  );
}

function Emoji({ size, children }: { size: number; children: string }) {
  return <RNText style={{ fontSize: size, lineHeight: Math.round(size * 1.25), includeFontPadding: false, textAlign: "center" }}>{children}</RNText>;
}
