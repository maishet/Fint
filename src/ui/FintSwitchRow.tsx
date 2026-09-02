import type { ReactNode } from "react";
import { Paragraph, Switch, XStack, YStack } from "tamagui";
import { haptics } from "./haptics";

export function FintSwitchRow({
  checked,
  detail,
  disabled = false,
  icon,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  detail?: string;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  const toggle = () => {
    if (disabled) return;
    haptics.select();
    onCheckedChange(!checked);
  };
  return (
    <XStack
      minH={58}
      px="$4"
      py="$3"
      items="center"
      gap="$3"
      opacity={disabled ? 0.5 : 1}
      bg="transparent"
      transition="quick"
      pressStyle={disabled ? undefined : { bg: "$secondary" }}
      role="switch"
      aria-label={label}
      aria-checked={checked}
      aria-disabled={disabled}
      onPress={toggle}
    >
      {icon}
      <YStack flex={1} minW={0} gap={detail ? "$1" : 0}>
        <Paragraph
          color="$color12"
          fontSize="$3"
          fontWeight="600"
          numberOfLines={1}
        >
          {label}
        </Paragraph>
        {detail ? (
          <Paragraph color="$color9" fontSize="$1" numberOfLines={2}>
            {detail}
          </Paragraph>
        ) : null}
      </YStack>
      <Switch
        checked={checked}
        disabled={disabled}
        pointerEvents="none"
        size="$3"
        bg="$color6"
        borderWidth={1}
        borderColor={checked ? "$primary" : "$color8"}
        activeStyle={{ backgroundColor: "$primary", borderColor: "$primary" }}
      >
        <Switch.Thumb
          bg={checked ? "white" : "$color11"}
          borderWidth={checked ? 1.5 : 0}
          borderColor="$primaryStrong"
          scale={0.82}
          elevation="$1"
          transition="quicker"
        />
      </Switch>
    </XStack>
  );
}
