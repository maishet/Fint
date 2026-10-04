import { Eye, EyeOff } from "@tamagui/lucide-icons-2";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { z } from "zod";
import { getValidationMessage, useSubmitValidation } from "../forms";
import { space } from "../theme/tokens";
import { fontFace, textStyles } from "../theme/typography";
import { ErrorLine, FintButton, FintSpinner, FText } from "../ui";
import { AuthField } from "./AuthField";
import { useAuth } from "./AuthProvider";
import { authErrorFor, type AuthErrorField } from "./authErrors";
import { CodeField, useResendCountdown, VERIFICATION_CODE_LENGTH } from "./CodeField";

type Field = "code" | "confirmPassword" | "email" | "password";

/**
 * Recuperar la contraseña, dentro de la hoja del login. Primero se pide el
 * correo; después, el código que llega por correo y la contraseña nueva en un
 * mismo paso. El código abre una sesión, pero `AuthProvider` no la publica
 * hasta que la contraseña nueva queda guardada: si se publicara antes, el login
 * se desmontaría y la persona entraría con la contraseña que no recuerda.
 */
export function ForgotPasswordStep({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const { i18n, t } = useTranslation();
  const { cancelPasswordReset, requestPasswordReset, resetPassword } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  // El correo al que ya se mandó el código: mientras exista, se muestra el paso del código y la contraseña nueva.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [focused, setFocused] = useState<Field | null>(null);
  const [serverError, setServerError] = useState<{ field: AuthErrorField; message: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const validation = useSubmitValidation<Field>();
  const { secondsLeft, restart } = useResendCountdown();
  const isMountedRef = useRef(true);
  const cancelRef = useRef(cancelPasswordReset);
  cancelRef.current = cancelPasswordReset;

  // Al salir a medias (volver al login), se suelta la sesión que abrió el código.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      void cancelRef.current();
    };
  }, []);

  const showError = (message: string) => {
    const known = authErrorFor(message);
    setServerError({ field: known.field, message: known.key ? t(known.key) : message });
  };

  const sendCode = async () => {
    const schema = z.object({ email: z.string().trim().email(getValidationMessage(t, i18n.resolvedLanguage, "email")) });
    const payload = validation.validate(schema, { email });
    if (!payload) return;
    setIsSubmitting(true);
    setServerError(null);
    const result = await requestPasswordReset(payload.email);
    if (!isMountedRef.current) return;
    if (result.error) showError(result.error.message);
    else {
      setSentTo(payload.email);
      restart();
    }
    setIsSubmitting(false);
  };

  const resend = async () => {
    if (!sentTo) return;
    setIsResending(true);
    setServerError(null);
    setNotice(null);
    const result = await requestPasswordReset(sentTo);
    if (!isMountedRef.current) return;
    if (result.error) showError(result.error.message);
    else {
      setCode("");
      setNotice(t("loginScreen.resent"));
      restart();
    }
    setIsResending(false);
  };

  const changePassword = async () => {
    if (!sentTo) return;
    const schema = z
      .object({
        code: z.string().length(VERIFICATION_CODE_LENGTH, t("loginScreen.codeRequired", { length: VERIFICATION_CODE_LENGTH })),
        password: z.string().min(8, getValidationMessage(t, i18n.resolvedLanguage, "passwordMin")),
        confirmPassword: z.string().min(1, getValidationMessage(t, i18n.resolvedLanguage, "required")),
      })
      .superRefine((values, context) => {
        if (values.password !== values.confirmPassword) {
          context.addIssue({ code: "custom", message: t("auth.passwordMismatch"), path: ["confirmPassword"] });
        }
      });
    const payload = validation.validate(schema, { code, password, confirmPassword });
    if (!payload) return;
    setIsSubmitting(true);
    setServerError(null);
    setNotice(null);
    const result = await resetPassword(sentTo, payload.code, payload.password);
    // Sin error, la sesión ya está publicada y el login redirige al Inicio.
    if (!isMountedRef.current || !result.error) return;
    showError(result.error.message);
    setIsSubmitting(false);
  };

  const errorFor = (field: Field) => validation.errors[field] ?? (serverError?.field === field ? serverError.message : undefined);
  const generalError = serverError && serverError.field === null ? serverError.message : null;
  const passwordToggle = (
    <Pressable
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={isPasswordVisible ? t("auth.hidePassword") : t("auth.showPassword")}
      onPress={() => setIsPasswordVisible((current) => !current)}
    >
      {isPasswordVisible ? <EyeOff size={18} color="$inkFaint" strokeWidth={2} /> : <Eye size={18} color="$inkFaint" strokeWidth={2} />}
    </Pressable>
  );

  return (
    <YStack grow={1}>
      <Text color="$ink" style={{ ...textStyles.title, fontSize: 22, lineHeight: 28, letterSpacing: -0.5 }} accessibilityRole="header">
        {sentTo ? t("loginScreen.resetTitle") : t("loginScreen.forgotTitle")}
      </Text>
      <FText variant="label" tone="inkMuted" style={{ marginTop: 2, fontSize: 14, lineHeight: 20 }}>
        {sentTo ? t("loginScreen.resetIntro", { email: sentTo, length: VERIFICATION_CODE_LENGTH }) : t("loginScreen.forgotIntro")}
      </FText>

      {sentTo ? (
        <>
          <YStack mt={18} gap={10}>
            <CodeField
              autoFocus
              editable={!isSubmitting}
              error={errorFor("code")}
              value={code}
              onChangeCode={(next) => {
                setCode(next);
                validation.clearError("code");
                if (serverError?.field === "code") setServerError(null);
              }}
            />
            <AuthField
              error={errorFor("password")}
              focused={focused === "password"}
              onFocus={() => setFocused("password")}
              onBlur={() => setFocused(null)}
              placeholder={t("loginScreen.newPasswordPlaceholder")}
              accessibilityLabel={t("loginScreen.newPassword")}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password-new"
              textContentType="newPassword"
              secureTextEntry={!isPasswordVisible}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                validation.clearError("password", "confirmPassword");
                if (serverError?.field === "password") setServerError(null);
              }}
              trailing={passwordToggle}
            />
            <AuthField
              error={errorFor("confirmPassword")}
              focused={focused === "confirmPassword"}
              onFocus={() => setFocused("confirmPassword")}
              onBlur={() => setFocused(null)}
              placeholder={t("auth.confirmPasswordPlaceholder")}
              accessibilityLabel={t("auth.confirmPassword")}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password-new"
              textContentType="newPassword"
              secureTextEntry={!isPasswordVisible}
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                validation.clearError("confirmPassword");
              }}
            />
            {generalError ? <ErrorLine message={generalError} mt={0} /> : null}
            {notice ? (
              <FText variant="caption" tone="inkMuted" accessibilityLiveRegion="polite" style={{ marginHorizontal: 2 }}>
                {notice}
              </FText>
            ) : null}
          </YStack>

          <YStack mt={16} gap={10}>
            <FintButton pending={isSubmitting} accessibilityLabel={t("loginScreen.changePassword")} onPress={changePassword}>
              {isSubmitting ? <FintSpinner color="$onBrand" /> : t("loginScreen.changePassword")}
            </FintButton>
            <FintButton variant="outlined" disabled={secondsLeft > 0 || isSubmitting} pending={isResending} onPress={resend}>
              {isResending ? <FintSpinner /> : secondsLeft > 0 ? t("loginScreen.resendIn", { seconds: secondsLeft }) : t("loginScreen.resend")}
            </FintButton>
          </YStack>

          <FText variant="caption" tone="inkFaint" style={{ marginTop: 12, textAlign: "center" }}>
            {t("loginScreen.spamHint")}
          </FText>
        </>
      ) : (
        <>
          <YStack mt={18} gap={10}>
            <AuthField
              error={errorFor("email")}
              focused={focused === "email"}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              placeholder={t("auth.emailPlaceholder")}
              accessibilityLabel={t("auth.email")}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                validation.clearError("email");
                setServerError(null);
              }}
              onSubmitEditing={() => void sendCode()}
            />
            {generalError ? <ErrorLine message={generalError} mt={0} /> : null}
          </YStack>
          <YStack mt={16}>
            <FintButton pending={isSubmitting} accessibilityLabel={t("loginScreen.sendCode")} onPress={sendCode}>
              {isSubmitting ? <FintSpinner color="$onBrand" /> : t("loginScreen.sendCode")}
            </FintButton>
          </YStack>
        </>
      )}

      {/* Al pie, como el enlace de entrar / crear cuenta. */}
      <XStack mt="auto" pt={space[6]} items="center" justify="center">
        <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" disabled={isSubmitting}>
          <FText tone="brand" style={{ fontSize: 14, fontFamily: fontFace.sans[600] }}>
            {t("loginScreen.backToLogin")}
          </FText>
        </Pressable>
      </XStack>
    </YStack>
  );
}
