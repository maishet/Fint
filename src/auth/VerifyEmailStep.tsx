import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { space } from "../theme/tokens";
import { fontFace, textStyles } from "../theme/typography";
import { FintButton, FintSpinner, FText } from "../ui";
import { useAuth } from "./AuthProvider";
import { authErrorFor } from "./authErrors";
import { CodeField, useResendCountdown, VERIFICATION_CODE_LENGTH } from "./CodeField";

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
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const { secondsLeft, restart } = useResendCountdown();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
      restart();
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
        <CodeField
          autoFocus
          editable={!isVerifying}
          error={error}
          value={code}
          onChangeCode={(next) => {
            setCode(next);
            setError(null);
            if (next.length === VERIFICATION_CODE_LENGTH && next !== code) void verify(next);
          }}
          onSubmit={() => void verify(code)}
        />
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
