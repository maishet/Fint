import { CircleAlert, Eye, EyeOff, MailCheck } from "@tamagui/lucide-icons-2";
import * as AppleAuthentication from "expo-apple-authentication";
import { Redirect, useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Platform, Pressable, TextInput, type TextInputProps } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Text, useTheme, useThemeName, View, XStack, YStack } from "tamagui";
import { z } from "zod";
import { useAuth } from "../src/auth/AuthProvider";
import { authErrorFor, type AuthErrorField } from "../src/auth/authErrors";
import { getValidationMessage, useSubmitValidation } from "../src/forms";
import { HeroMesh } from "../src/home/HeroMesh";
import { radius, space } from "../src/theme/tokens";
import { fontFace, textStyles } from "../src/theme/typography";
import { FintButton, FintSpinner, FText, PressableScale, SheetField, SheetTextInput } from "../src/ui";
import { BrandSymbol } from "../src/ui/BrandSymbol";

type Field = "confirmPassword" | "displayName" | "email" | "password";
type ServerError = { field: AuthErrorField; message: string };

/**
 * Entrar y crear cuenta. La losa de marca arriba (isotipo, titular y frase,
 * con la malla del Inicio) y el formulario en una hoja que sube sobre ella.
 * "Continuar con Google" va primero: es un toque y no pide recordar nada; el
 * correo queda debajo para quien lo prefiera. Los errores aparecen al tocar el
 * botón, no mientras se escribe: el campo toma borde `dangerHard` y el mensaje
 * va debajo con el icono de alerta.
 */
export default function LoginScreen() {
  const { i18n, t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session, signIn, signInWithApple, signInWithGoogle, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [serverError, setServerError] = useState<ServerError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [focused, setFocused] = useState<Field | null>(null);
  const [heroSize, setHeroSize] = useState({ width: 0, height: 0 });
  const validation = useSubmitValidation<Field>();
  const isMountedRef = useRef(true);
  const theme = useTheme();
  const isLogin = authMode === "login";
  const scrollY = useSharedValue(0);
  const statusStrip = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 24], [0, 1], Extrapolation.CLAMP) }));

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  // Al cerrar el teclado (atrás del sistema) el campo suelta el foco: si no, su borde `brand` sigue sin estar escribiendo.
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      TextInput.State.currentlyFocusedInput()?.blur();
      setFocused(null);
    });
    return () => sub.remove();
  }, []);

  // La losa va arriba en los dos temas: la barra de estado siempre clara.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
    }, []),
  );

  if (session) return <Redirect href="/" />;

  const runAuthAction = async (action: "signin" | "signup" | "google" | "apple") => {
    let submittedEmail = email.trim();
    let submittedDisplayName = displayName.trim();
    let submittedPassword = password;
    if (action !== "google" && action !== "apple") {
      const authSchema = z
        .object({
          displayName: action === "signup" ? z.string().trim().min(2, t("profile.invalid")).max(80, t("profile.invalid")) : z.string(),
          email: z
            .string()
            .trim()
            .email(getValidationMessage(t, i18n.resolvedLanguage, "email")),
          // Al crear cuenta, 8 caracteres como mínimo; al entrar solo se pide que no esté vacía, para no dejar afuera a
          // quien ya tiene una contraseña más corta.
          password:
            action === "signup"
              ? z.string().min(8, getValidationMessage(t, i18n.resolvedLanguage, "passwordMin"))
              : z.string().min(1, getValidationMessage(t, i18n.resolvedLanguage, "required")),
          confirmPassword: action === "signup" ? z.string().min(1, getValidationMessage(t, i18n.resolvedLanguage, "required")) : z.string(),
        })
        .superRefine((values, context) => {
          if (action === "signup" && values.password !== values.confirmPassword) {
            context.addIssue({ code: "custom", message: t("auth.passwordMismatch"), path: ["confirmPassword"] });
          }
        });
      const payload = validation.validate(authSchema, { displayName, email, password, confirmPassword });
      if (!payload) return;
      submittedEmail = payload.email;
      submittedDisplayName = payload.displayName;
      submittedPassword = payload.password;
    }

    setIsSubmitting(true);
    setServerError(null);
    setSuccessMessage(null);
    const result =
      action === "signin"
        ? await signIn(submittedEmail, submittedPassword)
        : action === "signup"
          ? await signUp(submittedEmail, submittedPassword, submittedDisplayName)
          : action === "apple"
            ? await signInWithApple()
            : await signInWithGoogle();

    if (!isMountedRef.current) return;
    if (result.error) {
      const known = authErrorFor(result.error.message);
      setServerError({ field: known.field, message: known.key ? t(known.key) : result.error.message });
    } else if (action === "signup") {
      setSuccessMessage(t("auth.signUpSuccess"));
    }
    setIsSubmitting(false);
  };

  const switchMode = () => {
    setAuthMode((current) => (current === "login" ? "register" : "login"));
    setServerError(null);
    setSuccessMessage(null);
    validation.resetErrors();
  };

  // El error de un campo: primero el de la validación; si no, el del servidor que le corresponde.
  const errorFor = (field: Field) => validation.errors[field] ?? (serverError?.field === field ? serverError.message : undefined);
  const generalError = serverError && serverError.field === null ? serverError.message : null;

  return (
    <View flex={1} bg="$slab">
      <KeyboardAwareScrollView
        bottomOffset={24}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        onScroll={(e) => {
          scrollY.value = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {/* Losa: isotipo y logotipo, titular a 30px y la frase en `slabMuted`. */}
        <YStack
          pt={insets.top + 18}
          px={space[5]}
          pb={28 + 30}
          overflow="hidden"
          onLayout={(e) => setHeroSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        >
          <HeroMesh width={heroSize.width} height={heroSize.height} />
          <XStack items="center" gap={10}>
            <BrandSymbol size={34} disc="$glassSlab" />
            <Text style={{ fontFamily: fontFace.display[600], fontSize: 22, letterSpacing: -0.8 }}>
              <Text color="$slabMuted">My </Text>
              <Text color="$slabInk">Fint</Text>
            </Text>
          </XStack>
          <Text color="$slabInk" mt={26} style={{ ...textStyles["display-lg"], letterSpacing: -1 }} accessibilityRole="header">
            {isLogin ? t("loginScreen.headline") : t("loginScreen.registerHeadline")}
          </Text>
          <FText tone="slabMuted" style={{ fontSize: 14, lineHeight: 20, marginTop: 8, maxWidth: 320 }}>
            {isLogin ? t("auth.intro") : t("loginScreen.registerIntro")}
          </FText>
        </YStack>

        {/* Hoja: en `background`, sube 28px sobre la losa y llega hasta abajo. */}
        <YStack
          grow={1}
          mt={-28}
          bg="$background"
          pt={space[6]}
          px={space[5]}
          pb={Math.max(insets.bottom, space[4]) + 18}
          style={{ borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }}
        >
          <YStack width="100%" maxW={420} self="center" grow={1}>
            <Text color="$ink" style={{ ...textStyles.title, fontSize: 22, lineHeight: 28, letterSpacing: -0.5 }}>
              {isLogin ? t("auth.welcome") : t("auth.registerTitle")}
            </Text>
            {isLogin ? (
              <FText variant="label" tone="inkMuted" style={{ marginTop: 2 }}>
                {t("auth.loginHint")}
              </FText>
            ) : null}

            <YStack mt={18} gap={10}>
              <GoogleButton disabled={isSubmitting} onPress={() => void runAuthAction("google")} />
              <AppleSignInButton authMode={authMode} disabled={isSubmitting} onPress={() => void runAuthAction("apple")} />
            </YStack>

            <XStack items="center" gap={10} mt={16} mb={12}>
              <View flex={1} height={1} bg="$line" />
              <FText variant="caption" tone="inkFaint">
                {t("loginScreen.orEmail")}
              </FText>
              <View flex={1} height={1} bg="$line" />
            </XStack>

            <YStack gap={10}>
              {isLogin ? null : (
                <AuthField
                  error={errorFor("displayName")}
                  focused={focused === "displayName"}
                  onFocus={() => setFocused("displayName")}
                  onBlur={() => setFocused(null)}
                  placeholder={t("auth.namePlaceholder")}
                  accessibilityLabel={t("auth.name")}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  value={displayName}
                  onChangeText={(value) => {
                    setDisplayName(value);
                    validation.clearError("displayName");
                  }}
                />
              )}
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
                  if (serverError?.field === "email") setServerError(null);
                }}
              />
              <AuthField
                error={errorFor("password")}
                focused={focused === "password"}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                placeholder={t("auth.passwordPlaceholder")}
                accessibilityLabel={t("auth.password")}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={isLogin ? "password" : "password-new"}
                textContentType={isLogin ? "password" : "newPassword"}
                secureTextEntry={!isPasswordVisible}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  validation.clearError("password", "confirmPassword");
                  if (serverError?.field === "password") setServerError(null);
                }}
                trailing={
                  <Pressable
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={isPasswordVisible ? t("auth.hidePassword") : t("auth.showPassword")}
                    onPress={() => setIsPasswordVisible((current) => !current)}
                  >
                    {isPasswordVisible ? <EyeOff size={18} color="$inkFaint" strokeWidth={2} /> : <Eye size={18} color="$inkFaint" strokeWidth={2} />}
                  </Pressable>
                }
              />
              {isLogin ? null : (
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
              )}
              {generalError ? <ErrorLine message={generalError} /> : null}
            </YStack>

            {successMessage ? (
              <XStack mt={16} p={14} gap={10} rounded={radius.md} bg="$brandWash" items="flex-start">
                <MailCheck size={18} color="$brand" strokeWidth={2} style={{ marginTop: 1 }} />
                <FText variant="label" style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
                  {successMessage}
                </FText>
              </XStack>
            ) : null}

            <View mt={16}>
              <FintButton
                disabled={isSubmitting}
                accessibilityLabel={isLogin ? t("auth.signIn") : t("auth.signUp")}
                onPress={() => runAuthAction(isLogin ? "signin" : "signup")}
              >
                {isSubmitting ? <FintSpinner color="$onBrand" /> : isLogin ? t("auth.signIn") : t("auth.signUp")}
              </FintButton>
            </View>

            {/* Al pie: cambiar entre entrar y crear cuenta. */}
            <XStack mt="auto" pt={space[6]} items="center" justify="center" gap={5}>
              <FText tone="inkMuted" style={{ fontSize: 14 }}>
                {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}
              </FText>
              <Pressable onPress={switchMode} hitSlop={10} accessibilityRole="button" disabled={isSubmitting}>
                <FText tone="brand" style={{ fontSize: 14, fontFamily: fontFace.sans[600] }}>
                  {isLogin ? t("auth.registerLink") : t("auth.loginLink")}
                </FText>
              </Pressable>
            </XStack>
          </YStack>
        </YStack>
      </KeyboardAwareScrollView>
      {/* Franja del color de la losa detrás de la barra de estado: aparece al desplazar (con el teclado abierto),
          para que el titular no pase por debajo de la hora y los iconos. Quieta, no se ve: no corta el resplandor. */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: theme.slab.val }, statusStrip]}
      />
    </View>
  );
}

function AuthField({ error, focused, trailing, ...input }: TextInputProps & { error?: string; focused: boolean; trailing?: ReactNode }) {
  return (
    <YStack gap={6}>
      <SheetField focused={focused} invalid={Boolean(error)}>
        <SheetTextInput {...input} />
        {trailing}
      </SheetField>
      {error ? <ErrorLine message={error} /> : null}
    </YStack>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <XStack items="center" gap={5} mx={2} accessibilityRole="alert">
      <CircleAlert size={13} color="$dangerHard" strokeWidth={2.2} />
      <FText variant="caption" tone="dangerHard" style={{ flex: 1, fontFamily: fontFace.sans[600] }}>
        {message}
      </FText>
    </XStack>
  );
}

/** "Continuar con Google" con el logo oficial, como pide la guía de marca de Google. */
function GoogleButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <PressableScale onPress={onPress} disabled={disabled} haptic="tap" accessibilityRole="button" accessibilityLabel={t("auth.google")}>
      <XStack
        height={50}
        rounded={radius.md}
        bg="$surface"
        borderWidth={1}
        borderColor="$lineStrong"
        items="center"
        justify="center"
        gap={10}
        opacity={disabled ? 0.42 : 1}
      >
        <GoogleMark />
        <FText variant="body-strong" style={{ fontSize: 15 }}>
          {t("auth.google")}
        </FText>
      </XStack>
    </PressableScale>
  );
}

function AppleSignInButton({ authMode, disabled, onPress }: { authMode: "login" | "register"; disabled: boolean; onPress: () => void }) {
  const themeName = useThemeName();
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let isMounted = true;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (isMounted) setIsAvailable(available);
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, []);

  if (Platform.OS !== "ios" || !isAvailable) return null;

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={
        authMode === "login" ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN : AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
      }
      buttonStyle={
        themeName === "dark" ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={radius.md}
      style={{ height: 50, width: "100%", opacity: disabled ? 0.42 : 1 }}
      onPress={() => {
        if (!disabled) onPress();
      }}
    />
  );
}

function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <Path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </Svg>
  );
}
