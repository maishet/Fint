import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Clock } from "@tamagui/lucide-icons-2";
import { Paragraph, XStack, YStack } from "tamagui";
import { FintCard } from "../ui";

interface ComingSoonCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  compact?: boolean;
}

export function ComingSoonCard({
  icon,
  title,
  description,
  compact = false,
}: ComingSoonCardProps) {
  const { t } = useTranslation();
  const iconSize = compact ? 38 : 44;

  return (
    <FintCard
      borderStyle="dashed"
      borderColor="rgba(7,124,134,0.35)"
      borderWidth={1.5}
      p={compact ? "$3" : "$4"}
    >
      <XStack gap="$3" items="flex-start">
        <YStack
          width={iconSize}
          height={iconSize}
          rounded={14}
          bg="$accent2"
          items="center"
          justify="center"
        >
          {icon}
        </YStack>
        <YStack flex={1} gap="$1">
          <XStack items="flex-start" justify="space-between" gap="$2">
            <Paragraph
              color="$color12"
              fontWeight="700"
              fontSize={compact ? "$3" : "$4"}
              flex={1}
            >
              {title}
            </Paragraph>
            <XStack
              items="center"
              gap="$1"
              bg="rgba(7,124,134,0.10)"
              rounded={999}
              px="$2"
              py={3}
            >
              <Clock size={11} color="$primary" />
              <Paragraph
                color="$primary"
                fontSize={10}
                fontWeight="700"
                textTransform="uppercase"
              >
                {t("comingSoon.badge")}
              </Paragraph>
            </XStack>
          </XStack>
          <Paragraph color="$color10" fontSize={compact ? "$1" : "$2"}>
            {description}
          </Paragraph>
        </YStack>
      </XStack>
    </FintCard>
  );
}
