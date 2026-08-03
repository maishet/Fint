import { AlertCircle, CheckCircle2, Info, X } from "@tamagui/lucide-icons-2";
import { Toast, useToastState } from "@tamagui/toast";
import { useTranslation } from "react-i18next";
import { Button, isWeb, XStack, YStack } from "tamagui";

export function CurrentToast() {
  const { t } = useTranslation();
  const currentToast = useToastState();

  if (!currentToast || currentToast.isHandledNatively) return null;

  const preset = currentToast.preset as "success" | "error" | undefined;
  const isSuccess = preset === "success";
  const isError = preset === "error";
  const toneColor = isSuccess ? "$green11" : isError ? "$red11" : "$primary";
  const toneBackground = isSuccess ? "$green2" : isError ? "$red2" : "$accent2";
  const toneBorder = isSuccess ? "$green6" : isError ? "$red6" : "$accent6";
  const Icon = isSuccess ? CheckCircle2 : isError ? AlertCircle : Info;

  return (
    <Toast
      key={currentToast.id}
      duration={currentToast.duration}
      viewportName={currentToast.viewportName}
      transition="quick"
      enterStyle={{ opacity: 0, scale: 0.96, y: -16 }}
      exitStyle={{ opacity: 0, scale: 0.98, y: -10 }}
      y={isWeb ? "$12" : 0}
      width="90%"
      minW={280}
      maxW={380}
      self="center"
      bg="$card"
      borderColor={toneBorder}
      borderWidth={1}
      rounded={14}
    >
      <XStack width="100%" items="center" gap="$3" p="$3">
        <YStack
          width={36}
          height={36}
          rounded="$8"
          bg={toneBackground}
          items="center"
          justify="center"
          shrink={0}
        >
          <Icon size={19} color={toneColor} />
        </YStack>
        <YStack flex={1} minW={0} gap="$1">
          <Toast.Title
            color="$color12"
            fontFamily="$heading"
            fontSize="$3"
            fontWeight="700"
            numberOfLines={1}
          >
            {currentToast.title}
          </Toast.Title>
          {currentToast.message ? (
            <Toast.Description color="$color10" fontSize="$1" numberOfLines={2}>
              {currentToast.message}
            </Toast.Description>
          ) : null}
        </YStack>
        <Toast.Close asChild>
          <Button chromeless circular size="$2" aria-label={t("actions.close")}>
            <X size={16} color="$color10" />
          </Button>
        </Toast.Close>
      </XStack>
    </Toast>
  );
}
