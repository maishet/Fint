import { useRouter } from "expo-router";
import { Image, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Paragraph, useTheme, XStack, YStack } from "tamagui";
import { useAuth } from "../auth/AuthProvider";
import { resolveDisplayName } from "../auth/displayName";

interface AppHeaderProps {
  showGreeting?: boolean;
  title: string;
}

export function AppHeader({ showGreeting = false, title }: AppHeaderProps) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const metadata = session?.user.user_metadata ?? {};
  const avatarUrl =
    typeof metadata.avatar_url === "string"
      ? metadata.avatar_url
      : typeof metadata.picture === "string"
        ? metadata.picture
        : null;
  const displayName = resolveDisplayName(session);
  const firstName = displayName?.split(" ")[0] || "My Fint";
  const initial = displayName?.slice(0, 1).toUpperCase() || "F";
  const heading = showGreeting
    ? t(`header.${getGreetingKey()}`, { name: firstName })
    : title;

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ backgroundColor: theme.headerBackground.val }}
    >
      <XStack
        bg="$headerBackground"
        px="$4"
        py="$3"
        items="center"
        justify="space-between"
        gap="$3"
      >
        <XStack items="center" gap="$3" flex={1} minW={0}>
          <YStack
            width={34}
            height={34}
            rounded={17}
            overflow="hidden"
            shrink={0}
          >
            <Image
              source={require("../../assets/images/icon.png")}
              style={{ width: 34, height: 34 }}
              resizeMode="cover"
            />
          </YStack>
          <Paragraph
            flex={1}
            minW={0}
            color="$headerForeground"
            fontFamily="$heading"
            fontSize="$5"
            fontWeight="600"
            letterSpacing={-0.2}
            lineHeight="$5"
            numberOfLines={1}
          >
            {heading}
          </Paragraph>
        </XStack>

        <YStack
          width={44}
          height={44}
          rounded={22}
          overflow="hidden"
          bg="rgba(246,251,252,0.10)"
          borderColor="rgba(246,251,252,0.16)"
          borderWidth={1}
          items="center"
          justify="center"
          shrink={0}
          transition="quick"
          pressStyle={{ scale: 0.96, bg: "rgba(246,251,252,0.16)" }}
          onPress={() => router.push("/settings")}
          role="button"
          aria-label={t("header.menuTitle")}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: 44, height: 44, borderRadius: 22 }}
              resizeMode="cover"
              accessibilityLabel={displayName ?? undefined}
            />
          ) : (
            <Text
              style={{
                color: theme.headerAccent.val,
                fontFamily: "InterSemiBold",
                fontSize: 15,
                fontWeight: "600",
                includeFontPadding: false,
                lineHeight: 44,
                textAlign: "center",
                textAlignVertical: "center",
                width: 44,
              }}
            >
              {initial}
            </Text>
          )}
        </YStack>
      </XStack>
    </SafeAreaView>
  );
}

function getGreetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return "goodMorning";
  if (hour < 19) return "goodAfternoon";
  return "goodEvening";
}
