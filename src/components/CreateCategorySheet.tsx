import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Shapes, X } from "@tamagui/lucide-icons-2";
import { useToastController } from "@tamagui/toast";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";
import { Button, Paragraph, Sheet, Spinner, XStack, YStack } from "tamagui";
import EmojiPicker, { es, en, pt, type EmojiType } from "rn-emoji-keyboard";
import { z } from "zod";
import { financeApi } from "../api/finance";
import type { CreateCategoryResult, TransactionType } from "../api/types";
import { FormTextField, MovementTypeSelector } from "./MovementFormControls";
import { suggestedCategoryIcons } from "../finance/categoryIcons";
import { getValidationMessage, useSubmitValidation } from "../forms";
import { useThemeMode } from "../theme/ThemeMode";
import { fintPalette } from "../theme/palette";
import { FintButton } from "../ui";
import { useSheetBackHandler } from "../hooks/useSheetBackHandler";

interface CreateCategorySheetProps {
  initialType: TransactionType;
  onCreated?: (category: CreateCategoryResult) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function CreateCategorySheet({
  initialType,
  onCreated,
  onOpenChange,
  open,
}: CreateCategorySheetProps) {
  const { t, i18n } = useTranslation();
  const { themeMode } = useThemeMode();
  const palette = fintPalette[themeMode];
  const toast = useToastController();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<TransactionType>(initialType);
  const [icon, setIcon] = useState("🛒");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [iconChanged, setIconChanged] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const validation = useSubmitValidation<"name">();
  const categorySchema = z.object({
    name: z
      .string()
      .trim()
      .min(2, getValidationMessage(t, i18n.resolvedLanguage, "minTwo")),
  });

  const reset = () => {
    setName("");
    setType(initialType);
    setIcon("🛒");
    setIconChanged(false);
    setErrorMessage(null);
    validation.resetErrors();
  };

  const mutation = useMutation({
    mutationFn: (categoryName: string) =>
      financeApi.createCategory({ name: categoryName, type, icon }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.show(t("categories.createdToast"), {
        message: t("categories.createdMessage"),
      });
      reset();
      onOpenChange(false);
      onCreated?.(created);
    },
    onError: (error) =>
      setErrorMessage(
        error instanceof Error ? error.message : t("states.error"),
      ),
  });

  const submit = () => {
    setErrorMessage(null);
    const payload = validation.validate(categorySchema, { name });
    if (payload) mutation.mutate(payload.name);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && mutation.isPending) return;
    if (!nextOpen) reset();
    if (nextOpen) setType(initialType);
    onOpenChange(nextOpen);
  };
  const closeSheet = useCallback(() => {
    if (!mutation.isPending) handleOpenChange(false);
  }, [mutation.isPending, onOpenChange]);
  useSheetBackHandler(open && !emojiPickerOpen, closeSheet);

  return (
    <>
      <Sheet
        modal
        open={open}
        onOpenChange={handleOpenChange}
        snapPoints={[82]}
        disableDrag
        moveOnKeyboardChange
        zIndex={120_000}
      >
        <Sheet.Overlay bg="rgba(0,0,0,0.45)" />
        <Sheet.Handle bg="$color6" />
        <Sheet.Frame bg="$popover" px="$4" pt="$3" pb="$4" rounded={18}>
          <Sheet.ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <YStack gap="$4" pb="$3">
              <XStack items="center" justify="space-between" gap="$3">
                <YStack flex={1} minW={0} gap="$1">
                  <Paragraph
                    color="$color12"
                    fontFamily="$heading"
                    fontSize="$7"
                    fontWeight="700"
                  >
                    {t("categories.newTitle")}
                  </Paragraph>
                  <Paragraph color="$color10">
                    {t("categories.newSubtitle")}
                  </Paragraph>
                </YStack>
                <Button
                  circular
                  chromeless
                  size="$3"
                  color="$primary"
                  disabled={mutation.isPending}
                  icon={<X size={20} color="$primary" />}
                  onPress={() => handleOpenChange(false)}
                  aria-label={t("actions.cancel")}
                />
              </XStack>

              <MovementTypeSelector
                value={type}
                onValueChange={(value) => {
                  setType(value);
                  if (!iconChanged)
                    setIcon(suggestedCategoryIcons(name, value)[0]);
                }}
              />

              <XStack
                bg="$muted"
                borderColor="$borderColor"
                borderWidth={1}
                rounded="$7"
                p="$3"
                gap="$3"
                items="center"
              >
                <YStack
                  width={66}
                  height={66}
                  rounded="$10"
                  bg="$secondary"
                  borderColor="$primary"
                  borderWidth={1}
                  items="center"
                  justify="center"
                  role="button"
                  onPress={() => setEmojiPickerOpen(true)}
                  aria-label={t("categoryUx.changeEmoji")}
                >
                  <Text
                    style={{
                      fontSize: 36,
                      includeFontPadding: false,
                      lineHeight: 46,
                      textAlign: "center",
                      textAlignVertical: "center",
                    }}
                  >
                    {icon}
                  </Text>
                </YStack>
                <YStack flex={1} minW={0} gap="$1">
                  <Paragraph color="$color10" fontSize="$1" fontWeight="700">
                    {t("categoryUx.identity")}
                  </Paragraph>
                  <Paragraph
                    color="$color12"
                    fontFamily="$heading"
                    fontSize="$5"
                    fontWeight="800"
                    numberOfLines={1}
                  >
                    {name.trim() || t("categories.newTitle")}
                  </Paragraph>
                  <Paragraph
                    color="$primary"
                    fontSize="$1"
                    fontWeight="700"
                    onPress={() => setEmojiPickerOpen(true)}
                  >
                    {t("categoryUx.changeEmoji")}
                  </Paragraph>
                </YStack>
              </XStack>

              {name.trim() ? (
                <YStack gap="$2">
                  <Paragraph color="$color10" fontSize="$1" fontWeight="700">
                    {t("categoryUx.selectedEmoji")}
                  </Paragraph>
                  <XStack gap="$2">
                    {suggestedCategoryIcons(name, type).map((option) => (
                      <Button
                        key={option}
                        width={48}
                        height={48}
                        p={0}
                        rounded="$10"
                        bg={icon === option ? "$secondary" : "$muted"}
                        borderColor={
                          icon === option ? "$primary" : "$borderColor"
                        }
                        borderWidth={1}
                        onPress={() => {
                          setIcon(option);
                          setIconChanged(true);
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 24,
                            includeFontPadding: false,
                            lineHeight: 30,
                            textAlign: "center",
                            textAlignVertical: "center",
                          }}
                        >
                          {option}
                        </Text>
                      </Button>
                    ))}
                  </XStack>
                </YStack>
              ) : null}

              <FormTextField
                label={t("forms.name")}
                required
                error={validation.errors.name}
                icon={<Shapes size={21} color="$primary" />}
                placeholder={t("categories.namePlaceholder")}
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  validation.clearError("name");
                  if (!iconChanged)
                    setIcon(suggestedCategoryIcons(value, type)[0] ?? icon);
                }}
              />
              {errorMessage ? (
                <Paragraph color="$red10">{errorMessage}</Paragraph>
              ) : null}

              <YStack gap="$2">
                <FintButton
                  width="100%"
                  minH={52}
                  disabled={mutation.isPending}
                  onPress={submit}
                  icon={
                    mutation.isPending ? (
                      <Spinner color="$primaryForeground" />
                    ) : (
                      <Shapes size={18} />
                    )
                  }
                >
                  {mutation.isPending
                    ? t("categories.creating")
                    : t("categories.create")}
                </FintButton>
                <FintButton
                  width="100%"
                  minH={48}
                  variant="outlined"
                  disabled={mutation.isPending}
                  onPress={() => handleOpenChange(false)}
                >
                  {t("actions.cancel")}
                </FintButton>
              </YStack>
            </YStack>
          </Sheet.ScrollView>
        </Sheet.Frame>
      </Sheet>
      <EmojiPicker
        open={emojiPickerOpen}
        onClose={() => setEmojiPickerOpen(false)}
        onEmojiSelected={(emoji: EmojiType) => {
          setIcon(emoji.emoji);
          setIconChanged(true);
          setEmojiPickerOpen(false);
        }}
        translation={
          i18n.resolvedLanguage === "en"
            ? en
            : i18n.resolvedLanguage === "pt"
              ? pt
              : es
        }
        enableSearchBar
        enableRecentlyUsed
        categoryPosition="top"
        theme={{
          backdrop: "rgba(0,0,0,0.72)",
          container: palette.surface,
          header: palette.text,
          knob: palette.primary,
          skinTonesContainer: palette.subtle,
          category: {
            icon: palette.muted,
            iconActive: palette.primary,
            container: palette.surface,
            containerActive: palette.subtle,
          },
          search: {
            background: palette.subtle,
            text: palette.text,
            placeholder: palette.muted,
            icon: palette.muted,
          },
          customButton: {
            icon: palette.primary,
            iconPressed: palette.text,
            background: palette.subtle,
            backgroundPressed: palette.elevated,
          },
          emoji: { selected: palette.elevated },
        }}
      />
    </>
  );
}
