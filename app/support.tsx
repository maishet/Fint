import { ChevronLeft, ChevronRight, CircleAlert, Mail, ShieldCheck } from "@tamagui/lucide-icons-2";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { Pressable } from "react-native";
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { trackAnalyticsEvent } from "../src/analytics/privacy";
import { financeApi } from "../src/api/finance";
import { UnsavedChangesDialog } from "../src/components/UnsavedChangesDialog";
import { useUnsavedChangesGuard } from "../src/hooks/useUnsavedChangesGuard";
import { deviceLine } from "../src/support/deviceLine";
import { getSupportDiagnostics } from "../src/support/diagnostics";
import { useThemeMode } from "../src/theme/ThemeMode";
import { motion, radius, space } from "../src/theme/tokens";
import { GroupTitle } from "../src/settings/SettingsList";
import { fontFace, textStyles } from "../src/theme/typography";
import { Chip, FintButton, FintCard, FintSheet, FintSpinner, FText, IconButton, SheetField, SheetTextInput, useNotify } from "../src/ui";

const KEYBOARD_GAP = 24;
const SHEET_UNMOUNT_MS = 600;
const MAX_DESCRIPTION = 1000;
const MIN_DESCRIPTION = 10;
type Field = "description" | "steps";
type Faq = { q: string; a: string };

/**
 * Reportar un problema v3 (Soporte): el tema en fichas (obligatorio), "¿Qué
 * ocurrió?" con contador en `mono` (diez caracteres como mínimo), los pasos
 * (opcionales), el recuadro de privacidad con el escudo en `flowIn` y "Enviar
 * reporte" fijo abajo; debajo, las preguntas frecuentes. Los errores aparecen
 * al tocar el botón. Antes de enviar, una hoja confirma con el resumen de lo que
 * va (tema, descripción y la línea de diagnóstico en `mono`); al enviarse,
 * vuelve a Ajustes con un aviso. "Solicitar una mejora" es otra fila de Ajustes
 * (decisión de Cristhofer: separadas, sin la pantalla intermedia de Ayuda).
 */
export default function SupportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const notify = useNotify();
  const { themeMode } = useThemeMode();
  const topics = t("support.categories", { returnObjects: true }) as string[];
  const faqs = t("helpScreen.faqs", { returnObjects: true }) as Faq[];
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [focused, setFocused] = useState<Field | null>(null);
  const [errors, setErrors] = useState<{ topic?: string; description?: string }>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMounted, setConfirmMounted] = useState(false);
  const [sending, setSending] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const guard = useUnsavedChangesGuard(description.trim() !== "" || steps.trim() !== "");
  const diagnostics = { ...getSupportDiagnostics(), platform: deviceLine() };
  const diagnosticLine = `My Fint ${diagnostics.appVersion} (${diagnostics.buildNumber}) · ${diagnostics.platform}`;

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(themeMode === "dark" ? "light" : "dark");
      return () => setStatusBarStyle("light");
    }, [themeMode]),
  );
  useEffect(() => {
    if (confirmOpen) return;
    const id = setTimeout(() => setConfirmMounted(false), SHEET_UNMOUNT_MS);
    return () => clearTimeout(id);
  }, [confirmOpen]);

  const submit = () => {
    const next: typeof errors = {};
    if (!topic) next.topic = t("reportScreen.aboutRequired");
    if (description.trim().length < MIN_DESCRIPTION) next.description = t("support.descriptionRequired");
    setErrors(next);
    if (next.topic || next.description) return;
    setConfirmMounted(true);
    setConfirmOpen(true);
  };

  const send = async () => {
    if (!topic) return;
    setSending(true);
    try {
      await trackAnalyticsEvent("support_report_submitted", { category: topic });
      await financeApi.submitSupportReport({ category: topic, description: description.trim(), steps: steps.trim(), diagnostics });
      setConfirmOpen(false);
      notify.success(t("support.submitSuccess"));
      // Enviado: se vuelve a Ajustes sin pasar por la guardia de cambios sin guardar.
      guard.bypass(() => router.back());
    } catch {
      notify.error(t("support.submitError", { defaultValue: t("states.error") }));
    } finally {
      setSending(false);
    }
  };

  return (
    <YStack flex={1} bg="$canvas" pt={insets.top}>
      <XStack items="center" px={space[4]} pt={space[2]} minH={48}>
        <IconButton label={t("settingsScreen.back")} icon={<ChevronLeft size={20} color="$ink" strokeWidth={2} />} onPress={() => router.back()} />
        <FText variant="heading" accessibilityRole="header" style={{ flex: 1, textAlign: "center", marginRight: 40 }} numberOfLines={1}>
          {t("reportScreen.title")}
        </FText>
      </XStack>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: footerHeight + space[4] }}
        bottomOffset={footerHeight + KEYBOARD_GAP}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Label>{t("reportScreen.about")}</Label>
        <XStack flexWrap="wrap" gap={8}>
          {topics.map((item) => (
            <Chip
              key={item}
              label={item}
              variant="choice"
              selected={item === topic}
              onPress={() => {
                setTopic(item);
                setErrors((e) => ({ ...e, topic: undefined }));
                void trackAnalyticsEvent("support_report_started", { category: item });
              }}
            />
          ))}
        </XStack>
        {errors.topic ? <ErrorLine message={errors.topic} /> : null}

        <Label>{t("reportScreen.what")}</Label>
        <SheetField focused={focused === "description"} invalid={Boolean(errors.description)}>
          <SheetTextInput
            value={description}
            onChangeText={(value) => {
              setDescription(value);
              setErrors((e) => ({ ...e, description: undefined }));
            }}
            placeholder={t("reportScreen.whatPlaceholder")}
            accessibilityLabel={t("reportScreen.what")}
            multiline
            textAlignVertical="top"
            maxLength={MAX_DESCRIPTION}
            onFocus={() => setFocused("description")}
            onBlur={() => setFocused(null)}
            style={{ minHeight: 96, paddingTop: 12, lineHeight: 21 }}
          />
        </SheetField>
        <XStack mt={4} gap={8}>
          <View flex={1}>{errors.description ? <ErrorLine message={errors.description} tight /> : null}</View>
          <FText variant="caption" tone="inkFaint" style={{ ...textStyles["figure-caption"] }}>
            {`${description.length} / ${MAX_DESCRIPTION}`}
          </FText>
        </XStack>

        <Label>{t("reportScreen.steps")}</Label>
        <SheetField focused={focused === "steps"}>
          <SheetTextInput
            value={steps}
            onChangeText={setSteps}
            placeholder={t("reportScreen.stepsPlaceholder")}
            accessibilityLabel={t("reportScreen.steps")}
            multiline
            textAlignVertical="top"
            maxLength={2000}
            onFocus={() => setFocused("steps")}
            onBlur={() => setFocused(null)}
            style={{ minHeight: 72, paddingTop: 12, lineHeight: 21 }}
          />
        </SheetField>

        {/* Qué se adjunta y qué no: versión, sistema y modelo; nunca montos, movimientos ni correos. */}
        <XStack mt={14} px={14} py={12} gap={10} rounded={radius.md} bg="$surfaceSunken" items="flex-start">
          <ShieldCheck size={16} color="$flowIn" strokeWidth={2} style={{ marginTop: 1 }} />
          <FText variant="caption" tone="inkMuted" style={{ flex: 1, lineHeight: 17 }}>
            {t("reportScreen.privacy")}
          </FText>
        </XStack>
        {/* Las respuestas rápidas, debajo del formulario (como antes): se despliegan de a una. */}
        <View mx={-space[4]}>
          <GroupTitle>{t("helpScreen.faq")}</GroupTitle>
          <FintCard p={0} mx={space[4]} overflow="hidden">
            {faqs.map((faq, i) => (
              <FaqItem
                key={faq.q}
                faq={faq}
                first={i === 0}
                open={openFaq === i}
                onToggle={() => setOpenFaq((current) => (current === i ? null : i))}
              />
            ))}
          </FintCard>
        </View>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ opened: Math.max(insets.bottom, 16) - 2 }}>
        <View
          px={space[4]}
          pt={space[3]}
          pb={Math.max(insets.bottom, 16) + 10}
          bg="$canvas"
          onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
        >
          <FintButton disabled={sending} onPress={submit}>
            {t("reportScreen.send")}
          </FintButton>
        </View>
      </KeyboardStickyView>

      {confirmMounted ? (
        <FintSheet open={confirmOpen} onClose={() => !sending && setConfirmOpen(false)}>
          <YStack items="center" px={space[5]} pt={space[4]}>
            <View width={56} height={56} rounded={999} bg="$brandWash" items="center" justify="center">
              <Mail size={24} color="$brand" strokeWidth={2} />
            </View>
            <FText variant="title" style={{ fontSize: 22, lineHeight: 28, marginTop: 14, textAlign: "center" }}>
              {t("reportScreen.confirmTitle")}
            </FText>
            <FText tone="inkMuted" style={{ fontSize: 14, lineHeight: 21, marginTop: 6, textAlign: "center" }}>
              {t("reportScreen.confirmBody")}
            </FText>
            {/* Resumen de lo que se envía. */}
            <YStack self="stretch" mt={16} px={14} py={12} rounded={radius.md} bg="$surfaceSunken">
              <FText variant="caption" tone="inkFaint" style={{ fontSize: 11 }}>
                {topic}
              </FText>
              <FText variant="label" numberOfLines={4} style={{ lineHeight: 19 }}>
                {description.trim()}
              </FText>
              <FText variant="caption" tone="inkMuted" style={{ ...textStyles["figure-caption"], marginTop: 6 }}>
                {diagnosticLine}
              </FText>
            </YStack>
            <YStack self="stretch" gap={8} mt={18}>
              <FintButton disabled={sending} onPress={() => void send()}>
                {sending ? <FintSpinner color="$onBrand" /> : t("reportScreen.confirmSend")}
              </FintButton>
              <FintButton variant="ghost" disabled={sending} onPress={() => setConfirmOpen(false)}>
                {t("reportScreen.keepEditing")}
              </FintButton>
            </YStack>
          </YStack>
        </FintSheet>
      ) : null}
      <UnsavedChangesDialog open={guard.open} onCancel={guard.onCancel} onConfirm={guard.onConfirm} />
    </YStack>
  );
}

function Label({ children }: { children: string }) {
  return (
    <FText variant="caption" tone="inkMuted" style={{ marginTop: 16, marginBottom: 6, marginLeft: 2 }}>
      {children}
    </FText>
  );
}

function ErrorLine({ message, tight = false }: { message: string; tight?: boolean }) {
  return (
    <XStack items="center" gap={5} mx={2} mt={tight ? 0 : 6} accessibilityRole="alert">
      <CircleAlert size={13} color="$dangerHard" strokeWidth={2.2} />
      <FText variant="caption" tone="dangerHard" style={{ flex: 1, fontFamily: fontFace.sans[600] }}>
        {message}
      </FText>
    </XStack>
  );
}

/** Una pregunta: tocarla la despliega con `spring-ui` y el chevron gira hacia abajo. Solo una abierta a la vez. */
function FaqItem({ faq, first, open, onToggle }: { faq: Faq; first: boolean; open: boolean; onToggle: () => void }) {
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(open ? 90 : 0);
  useEffect(() => {
    rotation.value = reduceMotion ? (open ? 90 : 0) : withSpring(open ? 90 : 0, motion.springUi);
  }, [open, reduceMotion, rotation]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const layout = reduceMotion ? undefined : LinearTransition.springify().damping(motion.springUi.damping).stiffness(motion.springUi.stiffness);

  return (
    <Animated.View layout={layout} style={{ overflow: "hidden" }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <YStack px={16} py={14} borderTopWidth={first ? 0 : 1} borderColor="$line">
          <XStack items="center" gap={10}>
            <FText variant="body-strong" style={{ flex: 1 }}>
              {faq.q}
            </FText>
            <Animated.View style={chevron}>
              <ChevronRight size={16} color="$inkFaint" strokeWidth={2} />
            </Animated.View>
          </XStack>
          {open ? (
            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.fade.duration)}>
              <FText variant="label" tone="inkMuted" style={{ marginTop: 8, lineHeight: 19 }}>
                {faq.a}
              </FText>
            </Animated.View>
          ) : null}
        </YStack>
      </Pressable>
    </Animated.View>
  );
}
