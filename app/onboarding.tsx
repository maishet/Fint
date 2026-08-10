import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  EyeOff,
  Landmark,
  ListChecks,
  WalletCards,
} from "@tamagui/lucide-icons-2";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, H1, Paragraph, Spinner, XStack, YStack } from "tamagui";
import { financeApi } from "../src/api/finance";
import { getCurrentAppLanguage } from "../src/i18n";
import {
  requestAndRegisterPushInstallation,
  type PushPermissionState,
} from "../src/notifications/pushNotifications";
import { FintButton, FintCard } from "../src/ui";

type SlideKey =
  "welcome" | "accounts" | "payments" | "privacy" | "notifications";

const slideKeys: SlideKey[] = [
  "welcome",
  "accounts",
  "payments",
  "privacy",
  "notifications",
];

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<SlideKey>>(null);
  const [index, setIndex] = useState(0);
  const [pushState, setPushState] = useState<
    PushPermissionState | "error" | null
  >(null);
  const [isRequestingPush, setIsRequestingPush] = useState(false);
  const isLast = index === slideKeys.length - 1;

  const completeMutation = useMutation({
    mutationFn: async () => {
      await financeApi.initializeMe(getCurrentAppLanguage());
      return financeApi.completeOnboarding();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.replace("/(tabs)/dashboard");
    },
  });

  const goNext = () => {
    if (isLast) {
      completeMutation.mutate();
      return;
    }
    listRef.current?.scrollToIndex({ animated: true, index: index + 1 });
  };

  const requestNotifications = async () => {
    setIsRequestingPush(true);
    try {
      const next = await requestAndRegisterPushInstallation();
      setPushState(next);
    } catch {
      setPushState("error");
    } finally {
      setIsRequestingPush(false);
    }
  };

  return (
    <YStack
      flex={1}
      bg="$background"
      pt={Math.max(insets.top, 20)}
      pb={Math.max(insets.bottom, 18)}
    >
      <XStack px="$5" items="center" justify="space-between">
        <Paragraph
          color="$color9"
          fontSize="$1"
          fontWeight="800"
          textTransform="uppercase"
        >
          My Fint
        </Paragraph>
        <Button
          chromeless
          onPress={() => completeMutation.mutate()}
          disabled={completeMutation.isPending}
        >
          {t("onboarding.skip")}
        </Button>
      </XStack>

      <FlatList
        ref={listRef}
        data={slideKeys}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item}
        onMomentumScrollEnd={(event) =>
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item }) => (
          <OnboardingSlide
            slideKey={item}
            width={width}
            pushState={pushState}
            isRequestingPush={isRequestingPush}
            onRequestNotifications={requestNotifications}
          />
        )}
      />

      <YStack px="$5" gap="$4">
        <XStack items="center" justify="center" gap="$2">
          {slideKeys.map((key, dotIndex) => (
            <YStack
              key={key}
              width={dotIndex === index ? 22 : 8}
              height={8}
              rounded="$10"
              bg={dotIndex === index ? "$primary" : "$color5"}
            />
          ))}
        </XStack>
        <FintButton
          disabled={completeMutation.isPending}
          icon={
            completeMutation.isPending ? (
              <Spinner color="$primaryForeground" />
            ) : undefined
          }
          onPress={goNext}
        >
          {completeMutation.isPending
            ? t("onboarding.finishing")
            : isLast
              ? t("onboarding.finish")
              : index === 0
                ? t("onboarding.start")
                : t("onboarding.next")}
        </FintButton>
        {completeMutation.error ? (
          <Paragraph color="$red10" text="center">
            {t("onboarding.completeError")}
          </Paragraph>
        ) : null}
      </YStack>
    </YStack>
  );
}

function OnboardingSlide({
  isRequestingPush,
  onRequestNotifications,
  pushState,
  slideKey,
  width,
}: {
  isRequestingPush: boolean;
  onRequestNotifications: () => void;
  pushState: PushPermissionState | "error" | null;
  slideKey: SlideKey;
  width: number;
}) {
  const { t } = useTranslation();
  const Icon =
    slideKey === "welcome"
      ? Landmark
      : slideKey === "accounts"
        ? WalletCards
        : slideKey === "payments"
          ? ListChecks
          : slideKey === "privacy"
            ? EyeOff
            : Bell;
  const bullets = t(`onboarding.slides.${slideKey}.bullets`, {
    returnObjects: true,
  }) as string[];

  return (
    <YStack width={width} px="$5" py="$6" gap="$5" justify="center">
      <FintCard bg="$accent1" borderColor="$accent4" p="$5" gap="$5">
        <YStack
          width={72}
          height={72}
          rounded="$10"
          bg="$accent3"
          borderColor="$accent5"
          borderWidth={1}
          items="center"
          justify="center"
        >
          <Icon size={32} color="$primary" />
        </YStack>
        <YStack gap="$2">
          <H1 color="$color12" fontFamily="$heading" size="$8">
            {t(`onboarding.slides.${slideKey}.title`)}
          </H1>
          <Paragraph color="$color10" fontSize="$3" lineHeight="$5">
            {t(`onboarding.slides.${slideKey}.subtitle`)}
          </Paragraph>
        </YStack>
        <YStack gap="$3">
          {bullets.map((bullet) => (
            <XStack key={bullet} gap="$3" items="flex-start">
              <YStack
                mt="$1.5"
                width={7}
                height={7}
                rounded="$10"
                bg="$primary"
              />
              <Paragraph color="$color11" flex={1} lineHeight="$5">
                {bullet}
              </Paragraph>
            </XStack>
          ))}
        </YStack>
        {slideKey === "privacy" ? <PrivacyPreview /> : null}
        {slideKey === "notifications" ? (
          <NotificationPermissionBlock
            state={pushState}
            isPending={isRequestingPush}
            onPress={onRequestNotifications}
          />
        ) : null}
      </FintCard>
    </YStack>
  );
}

function PrivacyPreview() {
  const { t } = useTranslation();
  return (
    <XStack
      bg="$card"
      borderColor="$borderColor"
      borderWidth={1}
      rounded="$6"
      p="$3"
      items="center"
      justify="space-between"
    >
      <YStack gap="$1">
        <Paragraph color="$color10" fontSize="$1">
          {t("dashboard.balance")}
        </Paragraph>
        <Paragraph color="$color12" fontSize="$7" fontWeight="900">
          ••••••
        </Paragraph>
      </YStack>
      <EyeOff size={22} color="$primary" />
    </XStack>
  );
}

function NotificationPermissionBlock({
  isPending,
  onPress,
  state,
}: {
  isPending: boolean;
  onPress: () => void;
  state: PushPermissionState | "error" | null;
}) {
  const { t } = useTranslation();
  const message =
    state === "granted"
      ? t("onboarding.notifications.enabled")
      : state === "denied"
        ? t("onboarding.notifications.denied")
        : state === "unsupported"
          ? t("onboarding.notifications.unsupported")
          : state === "error"
            ? t("onboarding.notifications.error")
            : t("onboarding.notifications.prompt");

  return (
    <YStack gap="$3" bg="$secondary" rounded="$6" p="$3">
      <Paragraph color="$color11" lineHeight="$5">
        {message}
      </Paragraph>
      {state === "granted" || state === "unsupported" ? null : (
        <FintButton
          variant="outlined"
          disabled={isPending}
          icon={
            isPending ? (
              <Spinner color="$primary" />
            ) : (
              <Bell size={16} color="$primary" />
            )
          }
          onPress={onPress}
        >
          {isPending
            ? t("onboarding.notifications.requesting")
            : t("onboarding.notifications.enable")}
        </FintButton>
      )}
    </YStack>
  );
}
