import type { ReactElement, ReactNode } from "react";
import { Paragraph, YStack } from "tamagui";
import { FintButton, FintCard } from "../ui";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: ReactElement;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
}: EmptyStateProps) {
  return (
    <FintCard items="center" gap="$3" py="$6">
      <YStack
        width={56}
        height={56}
        rounded="$10"
        bg="$secondary"
        items="center"
        justify="center"
      >
        {icon}
      </YStack>
      <YStack items="center" gap="$1">
        <Paragraph
          color="$color12"
          fontFamily="$heading"
          fontSize="$5"
          fontWeight="700"
          text="center"
        >
          {title}
        </Paragraph>
        {description ? (
          <Paragraph color="$color10" fontSize="$2" text="center" maxW={280}>
            {description}
          </Paragraph>
        ) : null}
      </YStack>
      {actionLabel && onAction ? (
        <FintButton icon={actionIcon} onPress={onAction}>
          {actionLabel}
        </FintButton>
      ) : null}
    </FintCard>
  );
}
