import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { YStack } from "tamagui";
import { fontFace } from "../theme/typography";
import { ErrorLine, SheetField, SheetTextInput } from "../ui";

/** Largo del código del correo: el mismo que "Email OTP Length" en Supabase (Auth → Providers → Email). */
export const VERIFICATION_CODE_LENGTH = 6;
/** Supabase no deja pedir otro correo antes de 60 s. */
const RESEND_WAIT_SECONDS = 60;

/** El campo del código que llega por correo: solo dígitos, en mono y centrado, con su error debajo. */
export function CodeField({
  autoFocus = false,
  editable = true,
  error,
  onChangeCode,
  onSubmit,
  value,
}: {
  autoFocus?: boolean;
  editable?: boolean;
  error?: string | null;
  onChangeCode: (code: string) => void;
  onSubmit?: () => void;
  value: string;
}) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  return (
    <YStack gap={6}>
      <SheetField focused={focused} invalid={Boolean(error)}>
        <SheetTextInput
          autoFocus={autoFocus}
          accessibilityLabel={t("loginScreen.codeLabel")}
          placeholder={"0".repeat(VERIFICATION_CODE_LENGTH)}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={VERIFICATION_CODE_LENGTH}
          editable={editable}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChangeText={(text) => onChangeCode(text.replace(/\D/g, "").slice(0, VERIFICATION_CODE_LENGTH))}
          onSubmitEditing={onSubmit}
          style={{ fontFamily: fontFace.mono[500], fontSize: 22, lineHeight: 28, letterSpacing: 6, textAlign: "center" }}
        />
      </SheetField>
      {error ? <ErrorLine message={error} mt={0} /> : null}
    </YStack>
  );
}

/** La espera para "Reenviar código": cuenta desde que se monta y vuelve a empezar con `restart`. */
export function useResendCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_WAIT_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  return { secondsLeft, restart: () => setSecondsLeft(RESEND_WAIT_SECONDS) };
}
