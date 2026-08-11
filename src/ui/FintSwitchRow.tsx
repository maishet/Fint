import type { ReactNode } from "react";
import { Paragraph, Switch, XStack, YStack } from "tamagui";

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
    if (!disabled) onCheckedChange(!checked);
  };
  return (
    <XStack
      minH={58}
      px="$4"
      py="$3"
      items="center"
      gap="$3"
      opacity={disabled ? 0.5 : 1}
      pressStyle={disabled ? undefined : { bg: "$color3" }}
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
          fontWeight="700"
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
        bg={checked ? "$primary" : "$color6"}
        borderWidth={1}
        borderColor={checked ? "$primary" : "$color8"}
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
