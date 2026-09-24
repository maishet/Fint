import { Check } from "@tamagui/lucide-icons-2";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { View, XStack, YStack } from "tamagui";
import { space } from "../theme/tokens";
import { FintButton, FintCard, FText } from "../ui";

/** Primeros pasos: reemplaza la hoja del Inicio mientras no haya cuentas o movimientos. */
export function GettingStartedCard({ accountCount, currency, hasMovements }: { accountCount: number; currency: string; hasMovements: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const needsAccount = accountCount === 0;

  return (
    <YStack px={space[4]}>
      <FintCard p={space[5]} gap={space[4]}>
        <YStack gap={2}>
          <FText variant="title">{t("onboarding.title")}</FText>
          <FText variant="caption" tone="inkFaint">
            {t("onboarding.baseCurrency", { currency })}
          </FText>
        </YStack>
        <YStack gap={space[3]}>
          <Step n={1} done={!needsAccount} label={t("onboarding.firstAccount")} />
          <Step n={2} done={hasMovements} label={t("onboarding.firstMovement")} />
        </YStack>
        <FintButton onPress={() => router.push(needsAccount ? "/account-form" : "/transaction-form")}>
          {t(needsAccount ? "onboarding.createAccount" : "onboarding.createMovement")}
        </FintButton>
      </FintCard>
    </YStack>
  );
}

function Step({ n, done, label }: { n: number; done: boolean; label: string }) {
  return (
    <XStack items="center" gap={space[3]}>
      <View
        width={28}
        height={28}
        rounded={999}
        items="center"
        justify="center"
        bg={done ? "$flowIn" : "$surfaceSunken"}
        borderWidth={done ? 0 : 1}
        borderColor="$line"
      >
        {done ? <Check size={14} color="$onBrand" strokeWidth={3} /> : <FText variant="amount-sm" tone="inkMuted">{String(n)}</FText>}
      </View>
      <FText tone={done ? "inkMuted" : "ink"} style={{ flex: 1, textDecorationLine: done ? "line-through" : "none" }}>
        {label}
      </FText>
    </XStack>
  );
}
