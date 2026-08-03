import { useState } from "react";
import { Image } from "react-native";
import {
  Lock,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
} from "@tamagui/lucide-icons-2";
import { useToastController } from "@tamagui/toast";
import { useTranslation } from "react-i18next";
import { Input, Paragraph, Spinner, XStack, YStack } from "tamagui";
import { z } from "zod";
import { useAuth } from "../src/auth/AuthProvider";
import { Screen } from "../src/components/Screen";
import { useSubmitValidation } from "../src/forms";
import { FintButton, FintCard } from "../src/ui";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { session, signOut, updateDisplayName } = useAuth();
  const toast = useToastController();
  const metadata = session?.user.user_metadata ?? {};
  const currentName =
    typeof metadata.display_name === "string"
      ? metadata.display_name
      : typeof metadata.full_name === "string"
        ? metadata.full_name
        : typeof metadata.name === "string"
          ? metadata.name
          : "";
  const avatarUrl =
    typeof metadata.avatar_url === "string"
      ? metadata.avatar_url
      : typeof metadata.picture === "string"
        ? metadata.picture
        : null;
  const [displayName, setDisplayName] = useState(currentName);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const validation = useSubmitValidation<"displayName">();
  const shownName = displayName.trim() || currentName || t("profile.title");

  const save = async () => {
    setServerError(null);
    const schema = z.object({
      displayName: z
        .string()
        .trim()
        .min(
          2,
          t("validation.profileName", { defaultValue: t("profile.invalid") }),
        )
        .max(
          80,
          t("validation.profileName", { defaultValue: t("profile.invalid") }),
        ),
    });
    const payload = validation.validate(schema, { displayName });
    if (!payload || payload.displayName === currentName.trim()) return;
    setIsSaving(true);
    const { error } = await updateDisplayName(payload.displayName);
    setIsSaving(false);
    if (error) {
      setServerError(t("profile.error"));
      toast.show(t("profile.error"), { preset: "error" });
    } else toast.show(t("profile.success"), { preset: "success" });
  };

  const endSession = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch {
      toast.show(t("profile.signOutError"), { preset: "error" });
      setIsSigningOut(false);
    }
  };

  return (
    <Screen>
      <FintCard
        bg="$heroBackground"
        borderColor="$heroBorder"
        gap="$4"
        items="center"
        p="$5"
        overflow="hidden"
      >
        <YStack
          position="absolute"
          t={-44}
          l={-36}
          width={180}
          height={180}
          rounded={90}
          borderColor="rgba(93,214,229,0.08)"
          borderWidth={1}
        />
        <YStack
          position="absolute"
          t={24}
          r={28}
          width={44}
          height={44}
          opacity={0.45}
        >
          <XStack flexWrap="wrap" gap={6}>
            {Array.from({ length: 16 }, (_, index) => (
              <YStack
                key={index}
                width={3}
                height={3}
                rounded="$10"
                bg="rgba(93,214,229,0.36)"
              />
            ))}
          </XStack>
        </YStack>
        <YStack
          width={104}
          height={104}
          rounded={52}
          bg="rgba(93,214,229,0.14)"
          borderColor="rgba(93,214,229,0.28)"
          borderWidth={1}
          items="center"
          justify="center"
          overflow="hidden"
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: 100, height: 100, borderRadius: 50 }}
            />
          ) : (
            <UserRound size={42} color="$heroAccent" />
          )}
        </YStack>
        <YStack items="center" gap="$1">
          <Paragraph
            color="$heroForeground"
            fontFamily="$heading"
            fontSize="$7"
            fontWeight="900"
            text="center"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {shownName}
          </Paragraph>
          <Paragraph color="$heroMuted" fontSize="$2" text="center">
            {t("profile.subtitle")}
          </Paragraph>
        </YStack>
      </FintCard>

      <FintCard gap="$3">
        <XStack items="center" gap="$3">
          <YStack
            width={42}
            height={42}
            rounded="$10"
            bg="$accent2"
            items="center"
            justify="center"
          >
            <UserRound size={20} color="$primary" />
          </YStack>
          <Paragraph
            color="$primary"
            fontFamily="$heading"
            fontSize="$5"
            fontWeight="800"
          >
            {t("profile.section")}
          </Paragraph>
        </XStack>

        <ProfileInputRow
          error={validation.errors.displayName}
          icon={<UserRound size={22} color="$primary" />}
          label={t("profile.name")}
          onChangeText={(value) => {
            setDisplayName(value);
            validation.clearError("displayName");
          }}
          placeholder={t("profile.namePlaceholder")}
          value={displayName}
        />
        <ReadOnlyRow
          badge={t("profile.notEditable")}
          icon={<Mail size={22} color="$primary" />}
          label={t("profile.email")}
          value={session?.user.email ?? "-"}
        />
        {serverError ? (
          <Paragraph color="$red10" fontSize="$2">
            {serverError}
          </Paragraph>
        ) : null}
      </FintCard>

      <FintCard gap="$3" bg="$accent1" borderColor="$accent4">
        <XStack gap="$3" items="center">
          <YStack
            width={46}
            height={46}
            rounded="$10"
            bg="$accent2"
            items="center"
            justify="center"
          >
            <ShieldCheck size={24} color="$primary" />
          </YStack>
          <Paragraph color="$color10" flex={1} fontSize="$3">
            {t("profile.auth")}
          </Paragraph>
        </XStack>
      </FintCard>

      <YStack gap="$3">
        <FintButton
          width="100%"
          minH={56}
          disabled={isSaving || isSigningOut}
          icon={
            isSaving ? (
              <Spinner size="small" color="$primaryForeground" />
            ) : (
              <Save size={19} color="$primaryForeground" />
            )
          }
          onPress={() => {
            void save();
          }}
        >
          {isSaving ? t("profile.saving") : t("profile.save")}
        </FintButton>
        <FintButton
          width="100%"
          minH={54}
          variant="outlined"
          disabled={isSaving || isSigningOut}
          color="$primary"
          borderColor="$primary"
          icon={
            isSigningOut ? (
              <Spinner size="small" color="$primary" />
            ) : (
              <LogOut size={20} color="$primary" />
            )
          }
          onPress={() => {
            void endSession();
          }}
        >
          {t("profile.signOut")}
        </FintButton>
      </YStack>
    </Screen>
  );
}

function ProfileInputRow({
  error,
  icon,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  error?: string;
  icon: React.ReactNode;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <YStack gap="$1">
      <XStack
        minH={78}
        items="center"
        gap="$3"
        bg="$card"
        borderColor={error ? "$red8" : "$borderColor"}
        borderWidth={1}
        rounded="$6"
        px="$3"
      >
        <YStack
          width={46}
          height={46}
          rounded="$10"
          bg="$accent2"
          items="center"
          justify="center"
        >
          {icon}
        </YStack>
        <YStack flex={1} minW={0} gap={2}>
          <Paragraph color="$color10" fontSize="$2">
            {label}
          </Paragraph>
          <Input
            unstyled
            height={28}
            p={0}
            m={0}
            color="$color12"
            fontSize="$4"
            fontWeight="800"
            placeholder={placeholder}
            placeholderTextColor="$color8"
            value={value}
            onChangeText={onChangeText}
            autoCapitalize="words"
            maxLength={80}
            aria-label={label}
          />
        </YStack>
      </XStack>
      {error ? (
        <Paragraph color="$red10" fontSize="$1" px="$2">
          {error}
        </Paragraph>
      ) : null}
    </YStack>
  );
}

function ReadOnlyRow({
  badge,
  icon,
  label,
  value,
}: {
  badge: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <XStack
      minH={78}
      gap="$3"
      items="center"
      bg="$card"
      borderColor="$borderColor"
      borderWidth={1}
      rounded="$6"
      px="$3"
    >
      <YStack
        width={46}
        height={46}
        rounded="$10"
        bg="$accent2"
        items="center"
        justify="center"
      >
        {icon}
      </YStack>
      <YStack flex={1} minW={0} gap={2}>
        <Paragraph color="$color10" fontSize="$2">
          {label}
        </Paragraph>
        <Paragraph
          color="$color12"
          fontSize="$3"
          fontWeight="800"
          numberOfLines={1}
        >
          {value}
        </Paragraph>
      </YStack>
      {/* <YStack bg="$accent2" rounded="$10" px="$3" py="$1"><Paragraph color="$primary" fontSize="$1" fontWeight="800">{badge}</Paragraph></YStack> */}
      <Lock size={20} color="$primary" />
    </XStack>
  );
}
