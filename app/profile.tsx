import { ChevronLeft, CircleAlert, Eye, EyeOff, KeyRound, Lock } from "@tamagui/lucide-icons-2";
import { useRouter } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, type TextInputProps } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XStack, YStack } from "tamagui";
import { z } from "zod";
import { useAuth } from "../src/auth/AuthProvider";
import { getValidationMessage, useSubmitValidation } from "../src/forms";
import { Avatar, Group, GroupTitle, Item } from "../src/settings/SettingsList";
import { radius, space } from "../src/theme/tokens";
import { fontFace, textStyles } from "../src/theme/typography";
import { useScreenStatusBar } from "../src/theme/useScreenStatusBar";
import { FintButton, FintSheet, FintSpinner, FText, IconButton, SheetField, SheetTextInput, useNotify } from "../src/ui";
import { GoogleMark } from "../src/ui/GoogleMark";

type PasswordField = "currentPassword" | "newPassword" | "confirmPassword";
const SHEET_UNMOUNT_MS = 600;

/**
 * Mi perfil v3: el avatar grande, el nombre y desde cuándo usa la app; el
 * nombre se edita y el correo se muestra bloqueado ("No editable"). En
 * Seguridad, "Cambiar contraseña" abre una hoja con los tres campos. Si la
 * cuenta también tiene Google, una nota lo dice; si solo entra con Google, no
 * hay fila de contraseña y la nota explica que se gestiona en Google.
 */
export default function ProfileScreen() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const notify = useNotify();
  const { session, updateDisplayName } = useAuth();
  const appMetadata = session?.user.app_metadata ?? {};
  const providers = Array.isArray(appMetadata.providers)
    ? (appMetadata.providers as string[])
    : typeof appMetadata.provider === "string"
      ? [appMetadata.provider]
      : [];
  const hasPassword = providers.includes("email");
  const hasGoogle = providers.includes("google");
  const metadata = session?.user.user_metadata ?? {};
  const currentName =
    typeof metadata.display_name === "string"
      ? metadata.display_name
      : typeof metadata.full_name === "string"
        ? metadata.full_name
        : typeof metadata.name === "string"
          ? metadata.name
          : "";
  const photoUrl = typeof metadata.avatar_url === "string" ? metadata.avatar_url : typeof metadata.picture === "string" ? metadata.picture : null;
  const [displayName, setDisplayName] = useState(currentName);
  const [savedName, setSavedName] = useState(currentName);
  const [nameFocused, setNameFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordMounted, setPasswordMounted] = useState(false);
  const validation = useSubmitValidation<"displayName">();
  const changed = displayName.trim() !== savedName.trim();
  const shownName = displayName.trim() || savedName || t("profile.title");

  useScreenStatusBar();
  useEffect(() => {
    if (passwordOpen) return;
    const id = setTimeout(() => setPasswordMounted(false), SHEET_UNMOUNT_MS);
    return () => clearTimeout(id);
  }, [passwordOpen]);

  // "Desde marzo de 2026": el mes en que se creó la cuenta.
  const since = session?.user.created_at
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage === "en" ? "en-US" : i18n.resolvedLanguage === "pt" ? "pt-BR" : "es-PE", {
        month: "long",
        year: "numeric",
      }).format(new Date(session.user.created_at))
    : null;

  const save = async () => {
    const schema = z.object({
      displayName: z
        .string()
        .trim()
        .min(2, t("validation.profileName", { defaultValue: t("profile.invalid") }))
        .max(80, t("validation.profileName", { defaultValue: t("profile.invalid") })),
    });
    const payload = validation.validate(schema, { displayName });
    if (!payload || !changed) return;
    setIsSaving(true);
    const { error } = await updateDisplayName(payload.displayName);
    setIsSaving(false);
    if (error) {
      notify.error(t("profile.error"));
      return;
    }
    setSavedName(payload.displayName);
    notify.success(t("profile.success"));
  };

  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <XStack items="center" px={space[4]} pt={space[2]} minH={48}>
        <IconButton label={t("settingsScreen.back")} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
        <FText variant="heading" accessibilityRole="header" style={{ flex: 1, textAlign: "center", marginRight: 40 }} numberOfLines={1}>
          {t("profile.title")}
        </FText>
      </XStack>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, space[4]) + 18 }}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <YStack items="center" mt={14}>
          <Avatar name={shownName} photoUrl={photoUrl} size={84} />
          <FText variant="title" numberOfLines={1} style={{ marginTop: 12, letterSpacing: -0.5, paddingHorizontal: space[5] }}>
            {shownName}
          </FText>
          {since ? (
            <FText variant="label" tone="inkFaint">
              {t("profileScreen.since", { date: since })}
            </FText>
          ) : null}
        </YStack>

        <YStack px={space[4]} mt={space[2]}>
          <FieldLabel>{t("profile.name")}</FieldLabel>
          <SheetField focused={nameFocused} invalid={Boolean(validation.errors.displayName)}>
            <SheetTextInput
              value={displayName}
              onChangeText={(value) => {
                setDisplayName(value);
                validation.clearError("displayName");
              }}
              placeholder={t("profile.namePlaceholder")}
              autoCapitalize="words"
              autoComplete="name"
              maxLength={80}
              accessibilityLabel={t("profile.name")}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
            />
          </SheetField>
          {validation.errors.displayName ? <ErrorLine message={validation.errors.displayName} /> : null}

          <FieldLabel>{t("profile.email")}</FieldLabel>
          <SheetField>
            <FText tone="inkMuted" numberOfLines={1} style={{ flex: 1, paddingVertical: 12, paddingLeft: 4 }}>
              {session?.user.email ?? "—"}
            </FText>
            <XStack items="center" gap={4}>
              <Lock size={13} color="$inkFaint" strokeWidth={2} />
              <FText variant="caption" tone="inkFaint">
                {t("profile.notEditable")}
              </FText>
            </XStack>
          </SheetField>
        </YStack>

        {hasPassword ? (
          <>
            <GroupTitle>{t("profileScreen.security")}</GroupTitle>
            <Group>
              <Item
                icon={KeyRound}
                label={t("profile.changePassword")}
                detail={t("profile.changePasswordHint")}
                onPress={() => {
                  setPasswordMounted(true);
                  setPasswordOpen(true);
                }}
              />
            </Group>
          </>
        ) : null}

        {hasGoogle ? (
          <XStack mx={space[4]} mt={hasPassword ? 10 : space[5]} px={14} py={12} gap={10} rounded={radius.md} bg="$surfaceSunken" items="flex-start">
            <YStack mt={1}>
              <GoogleMark size={16} />
            </YStack>
            <FText variant="caption" tone="inkMuted" style={{ flex: 1, lineHeight: 17 }}>
              {hasPassword ? t("profileScreen.googleNote") : t("profileScreen.googleOnlyNote")}
            </FText>
          </XStack>
        ) : null}

        <YStack mt="auto" pt={space[6]} px={space[4]}>
          <FintButton disabled={!changed || isSaving} opacity={changed ? 1 : 0.42} onPress={() => void save()}>
            {isSaving ? <FintSpinner color="$onBrand" /> : t("profile.save")}
          </FintButton>
        </YStack>
      </KeyboardAwareScrollView>

      {passwordMounted ? <ChangePasswordSheet open={passwordOpen} onClose={() => setPasswordOpen(false)} /> : null}
    </YStack>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <FText variant="caption" tone="inkMuted" style={{ marginTop: 16, marginBottom: 6, marginLeft: 2 }}>
      {children}
    </FText>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <XStack items="center" gap={5} mx={2} mt={6} accessibilityRole="alert">
      <CircleAlert size={13} color="$dangerHard" strokeWidth={2.2} />
      <FText variant="caption" tone="dangerHard" style={{ flex: 1, fontFamily: fontFace.sans[600] }}>
        {message}
      </FText>
    </XStack>
  );
}

/** Cambiar contraseña: actual, nueva (8 caracteres como mínimo) y su confirmación, con un solo ojo para las tres. */
function ChangePasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { i18n, t } = useTranslation();
  const notify = useNotify();
  const { changePassword } = useAuth();
  const [values, setValues] = useState<Record<PasswordField, string>>({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState<PasswordField | null>(null);
  const [pending, setPending] = useState(false);
  const validation = useSubmitValidation<PasswordField>();

  const submit = async () => {
    const schema = z
      .object({
        currentPassword: z.string().min(1, getValidationMessage(t, i18n.resolvedLanguage, "required")),
        newPassword: z.string().min(8, getValidationMessage(t, i18n.resolvedLanguage, "passwordMin")),
        confirmPassword: z.string().min(1, getValidationMessage(t, i18n.resolvedLanguage, "required")),
      })
      .superRefine((v, context) => {
        if (v.newPassword !== v.confirmPassword) context.addIssue({ code: "custom", message: t("auth.passwordMismatch"), path: ["confirmPassword"] });
      });
    const payload = validation.validate(schema, values);
    if (!payload) return;
    setPending(true);
    const { error } = await changePassword(payload.currentPassword, payload.newPassword);
    setPending(false);
    if (error) {
      const normalized = error.message.toLowerCase();
      if (normalized.includes("invalid login")) return validation.setError("currentPassword", t("profile.currentPasswordWrong"));
      if (normalized.includes("different from the old")) return validation.setError("newPassword", t("profile.newPasswordSame"));
      notify.error(t("profile.passwordUpdateError"));
      return;
    }
    notify.success(t("profile.passwordUpdated"));
    onClose();
  };

  const field = (name: PasswordField, label: string, autoComplete: TextInputProps["autoComplete"], trailing?: ReactNode) => (
    <YStack gap={6}>
      <SheetField focused={focused === name} invalid={Boolean(validation.errors[name])}>
        <SheetTextInput
          value={values[name]}
          onChangeText={(value) => {
            setValues((current) => ({ ...current, [name]: value }));
            validation.clearError(name);
          }}
          placeholder={label}
          accessibilityLabel={label}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={name === "currentPassword" ? "password" : "newPassword"}
          onFocus={() => setFocused(name)}
          onBlur={() => setFocused(null)}
        />
        {trailing}
      </SheetField>
      {validation.errors[name] ? <ErrorLine message={validation.errors[name] as string} /> : null}
    </YStack>
  );

  return (
    <FintSheet open={open} onClose={() => !pending && onClose()} title={t("profileScreen.passwordSheetTitle")}>
      <YStack px={space[5]} pb={space[2]} gap={10}>
        {field(
          "currentPassword",
          t("profile.currentPassword"),
          "current-password",
          <Pressable
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={visible ? t("auth.hidePassword") : t("auth.showPassword")}
            onPress={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff size={18} color="$inkFaint" strokeWidth={2} /> : <Eye size={18} color="$inkFaint" strokeWidth={2} />}
          </Pressable>,
        )}
        {field("newPassword", t("profile.newPassword"), "password-new")}
        {field("confirmPassword", t("profile.confirmNewPassword"), "password-new")}
        <YStack mt={8}>
          <FintButton disabled={pending} onPress={() => void submit()}>
            {pending ? <FintSpinner color="$onBrand" /> : t("profile.updatePassword")}
          </FintButton>
        </YStack>
      </YStack>
    </FintSheet>
  );
}
