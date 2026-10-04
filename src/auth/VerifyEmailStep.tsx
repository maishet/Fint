import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { space } from "../theme/tokens";
import { fontFace, textStyles } from "../theme/typography";
import { ErrorLine, FintButton, FintSpinner, FText, SheetField, SheetTextInput } from "../ui";
import { useAuth } from "./AuthProvider";
import { authErrorFor } from "./authErrors";

/** Largo del código del correo: el mismo que "Email OTP Length" en Supabase (Auth → Providers → Email). */
export const VERIFICATION_CODE_LENGTH = 6;
/** Supabase no deja pedir otro correo antes de 60 s. */
const RESEND_WAIT_SECONDS = 60;

/**
 * Paso de confirmar el correo, dentro de la hoja del login: la persona escribe
 * el código que le llegó. Un código en lugar de un enlace porque el enlace es
 * de un solo uso y los filtros de correo lo abren antes que la persona, y
 * porque no depende de abrir el correo en este mismo teléfono. Al completar el
 * código se verifica solo; con la sesión creada, el login redirige al Inicio.
 */
export function VerifyEmailStep({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const { t } = useTranslation();
  const { resendVerification, verifyEmail } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_WAIT_SECONDS);
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const verify = async (value: string) => {
    if (isVerifying) return;
    if (value.length !== VERIFICATION_CODE_LENGTH) {
      setError(t("loginScreen.codeRequired", { length: VERIFICATION_CODE_LENGTH }));
      return;
    }
    setIsVerifying(true);
    setError(null);
    setNotice(null);
    const result = await verifyEmail(email, value);
    if (!isMountedRef.current || !result.error) return;
    const known = authErrorFor(result.error.message);
    setError(known.key ? t(known.key) : result.error.message);
    setIsVerifying(false);
  };

  const resend = async () => {
    setIsResending(true);
    setError(null);
    setNotice(null);
    const result = await resendVerification(email);
    if (!isMountedRef.current) return;
    if (result.error) {
      const known = authErrorFor(result.error.message);
      setError(known.key ? t(known.key) : result.error.message);
    } else {
      setCode("");
      setNotice(t("loginScreen.resent"));
      setSecondsLeft(RESEND_WAIT_SECONDS);
    }
    setIsResending(false);
  };

  return (
    <YStack grow={1}>
      <Text color="$ink" style={{ ...textStyles.title, fontSize: 22, lineHeight: 28, letterSpacing: -0.5 }} accessibilityRole="header">
        {t("loginScreen.verifyTitle")}
      </Text>
      <FText variant="label" tone="inkMuted" style={{ marginTop: 2, fontSize: 14, lineHeight: 20 }}>
        {t("loginScreen.verifyIntro", { email, length: VERIFICATION_CODE_LENGTH })}
      </FText>

      <YStack mt={18} gap={6}>
        <SheetField focused={focused} invalid={Boolean(error)}>
          <SheetTextInput
            autoFocus
            accessibilityLabel={t("loginScreen.codeLabel")}
            placeholder={"0".repeat(VERIFICATION_CODE_LENGTH)}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={VERIFICATION_CODE_LENGTH}
            editable={!isVerifying}
            value={code}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChangeText={(value) => {
              const next = value.replace(/\D/g, "").slice(0, VERIFICATION_CODE_LENGTH);
              setCode(next);
              setError(null);
              if (next.length === VERIFICATION_CODE_LENGTH && next !== code) void verify(next);
            }}
            onSubmitEditing={() => void verify(code)}
            style={{ fontFamily: fontFace.mono[500], fontSize: 22, lineHeight: 28, letterSpacing: 6, textAlign: "center" }}
          />
        </SheetField>
        {error ? <ErrorLine message={error} mt={0} /> : null}
        {notice ? (
          <FText variant="caption" tone="inkMuted" accessibilityLiveRegion="polite" style={{ marginHorizontal: 2 }}>
            {notice}
          </FText>
        ) : null}
      </YStack>

      <YStack mt={16} gap={10}>
        <FintButton pending={isVerifying} accessibilityLabel={t("loginScreen.verify")} onPress={() => verify(code)}>
          {isVerifying ? <FintSpinner color="$onBrand" /> : t("loginScreen.verify")}
        </FintButton>
        <FintButton variant="outlined" disabled={secondsLeft > 0 || isVerifying} pending={isResending} onPress={resend}>
          {isResending ? <FintSpinner /> : secondsLeft > 0 ? t("loginScreen.resendIn", { seconds: secondsLeft }) : t("loginScreen.resend")}
        </FintButton>
      </YStack>

      <FText variant="caption" tone="inkFaint" style={{ marginTop: 12, textAlign: "center" }}>
        {t("loginScreen.spamHint")}
      </FText>

      {/* Al pie, como el enlace de entrar / crear cuenta: volver al formulario para corregir el correo. */}
      <XStack mt="auto" pt={space[6]} items="center" justify="center">
        <Pressable onPress={onChangeEmail} hitSlop={10} accessibilityRole="button" disabled={isVerifying}>
          <FText tone="brand" style={{ fontSize: 14, fontFamily: fontFace.sans[600] }}>
            {t("loginScreen.changeEmail")}
          </FText>
        </Pressable>
      </XStack>
    </YStack>
  );
}
