import { useState } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useToastController } from "@tamagui/toast";
import {
  HelpCircle,
  Lightbulb,
  ListChecks,
  MessageSquareText,
  Send,
  Tags,
} from "@tamagui/lucide-icons-2";
import { Paragraph, XStack, YStack } from "tamagui";
import { z } from "zod";
import { financeApi } from "../src/api/finance";
import { getSupportDiagnostics } from "../src/support/diagnostics";
import { trackAnalyticsEvent } from "../src/analytics/privacy";
import { Screen } from "../src/components/Screen";
import {
  FormTextArea,
  MovementPickerTrigger,
} from "../src/components/MovementFormControls";
import { getValidationMessage, useSubmitValidation } from "../src/forms";
import {
  FintButton,
  FintCard,
  FintConfirmDialog,
  FintFormField,
  FintSheetSelect,
} from "../src/ui";

type SupportReportPayload = {
  category: string;
  description: string;
  steps: string;
};

export default function SupportScreen() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const toast = useToastController();
  const categories = t("support.categories", {
    returnObjects: true,
  }) as string[];
  const [category, setCategory] = useState(categories[0] ?? "");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingReport, setPendingReport] = useState<SupportReportPayload | null>(null);
  const validation = useSubmitValidation<"category" | "description">();

  const submit = async () => {
    const schema = z.object({
      category: z
        .string()
        .min(1, getValidationMessage(t, i18n.resolvedLanguage, "required")),
      description: z.string().trim().min(10, t("support.descriptionRequired")),
      steps: z.string(),
    });
    const payload = validation.validate(schema, {
      category,
      description,
      steps,
    });
    if (!payload) return;
    setPendingReport(payload);
  };

  const sendReport = async (payload: SupportReportPayload) => {
    setIsSubmitting(true);
    try {
      await trackAnalyticsEvent("support_report_submitted", {
        category: payload.category,
      });
      await financeApi.submitSupportReport({
        category: payload.category,
        description: payload.description,
        steps: payload.steps,
        diagnostics: getSupportDiagnostics(),
      });
      setDescription("");
      setSteps("");
      setPendingReport(null);
      toast.show(t("support.submitSuccess"), { preset: "success" });
    } catch {
      toast.show(t("support.submitError", { defaultValue: t("states.error") }), { preset: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <FintConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("support.confirmSend")}
        description={t("support.confirmMessage")}
        icon={<Send size={16} />}
        isPending={isSubmitting}
        open={Boolean(pendingReport)}
        pendingLabel={t("support.submitting")}
        title={t("support.confirmTitle")}
        onCancel={() => setPendingReport(null)}
        onConfirm={() => {
          if (pendingReport) void sendReport(pendingReport);
        }}
      />
      <FintCard bg="$heroBackground" borderColor="$heroBorder" gap="$3">
        <XStack gap="$3" items="center">
          <YStack
            width={48}
            height={48}
            rounded="$10"
            bg="rgba(93,214,229,0.14)"
            borderColor="rgba(93,214,229,0.24)"
            borderWidth={1}
            items="center"
            justify="center"
          >
            <HelpCircle size={24} color="$heroAccent" />
          </YStack>
          <YStack flex={1}>
            <Paragraph
              color="$heroForeground"
              fontFamily="$heading"
              fontSize="$6"
              fontWeight="800"
            >
              {t("support.title")}
            </Paragraph>
            <Paragraph color="$heroMuted">{t("support.subtitle")}</Paragraph>
          </YStack>
        </XStack>
      </FintCard>
      <FintFormField
        label={t("support.category")}
        required
        error={validation.errors.category}
        showLabel={false}
      >
        <FintSheetSelect
          label={t("support.category")}
          showLabel={false}
          placeholder={t("support.category")}
          value={category}
          options={categories.map((item) => ({ value: item, label: item }))}
          onValueChange={(value) => {
            setCategory(value);
            validation.clearError("category");
            void trackAnalyticsEvent("support_report_started", {
              category: value,
            });
          }}
          renderTrigger={({ onPress, selectedLabel }) => (
            <MovementPickerTrigger
              icon={<Tags size={21} color="$primary" />}
              invalid={Boolean(validation.errors.category)}
              label={t("support.category")}
              required
              onPress={onPress}
              value={selectedLabel}
            />
          )}
        />
      </FintFormField>
      <FormTextArea
        label={t("support.description")}
        required
        error={validation.errors.description}
        icon={<MessageSquareText size={21} color="$primary" />}
        minHeight={124}
        placeholder={t("support.description")}
        value={description}
        onChangeText={(value) => {
          setDescription(value);
          validation.clearError("description");
        }}
      />
      <FormTextArea
        label={t("support.steps")}
        icon={<ListChecks size={21} color="$primary" />}
        minHeight={112}
        placeholder={t("support.steps")}
        value={steps}
        onChangeText={setSteps}
      />
      <YStack gap="$2">
        <FintButton
          width="100%"
          minH={52}
          icon={<Send size={17} />}
          disabled={isSubmitting}
          onPress={submit}
        >
          {isSubmitting ? t("support.submitting") : t("support.submit")}
        </FintButton>
        <FintButton
          width="100%"
          minH={48}
          variant="outlined"
          onPress={() => router.back()}
        >
          {t("actions.cancel")}
        </FintButton>
      </YStack>
      <FintCard gap="$2" onPress={() => router.push("/improvements") }>
        <XStack gap="$2" items="center">
          <Lightbulb size={18} color="$primary" />
          <Paragraph color="$color12" fontWeight="800">
            {t("support.improvement")}
          </Paragraph>
        </XStack>
        <Paragraph color="$color10">{t("support.improvementHint")}</Paragraph>
      </FintCard>
      <FintCard gap="$2">
        <Paragraph color="$color12" fontWeight="800">
          {t("support.faq")}
        </Paragraph>
        <Paragraph color="$color10">{t("support.login")}</Paragraph>
        <Paragraph color="$color10">{t("support.gmail")}</Paragraph>
        <Paragraph color="$color10">{t("support.duplicates")}</Paragraph>
      </FintCard>
    </Screen>
  );
}
