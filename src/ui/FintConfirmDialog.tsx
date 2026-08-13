import type { ComponentProps } from "react";
import { Button, Dialog, XStack, YStack } from "tamagui";
import { FintSpinner } from "./FintSpinner";
import { haptics } from "./haptics";

export function FintConfirmDialog({
  cancelLabel,
  confirmLabel,
  description,
  destructive = false,
  icon,
  isPending,
  open,
  pendingLabel,
  onCancel,
  onConfirm,
  title,
}: {
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  destructive?: boolean;
  icon?: ComponentProps<typeof Button>["icon"];
  isPending: boolean;
  open: boolean;
  pendingLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <Dialog
      modal
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && !isPending && onCancel()}
    >
      <Dialog.Portal>
        <Dialog.Overlay bg="rgba(4,18,28,0.68)" />
        <Dialog.Content
          bordered
          elevate
          bg="$popover"
          borderColor="$borderColor"
          rounded="$7"
          width="88%"
          maxW={420}
          p="$5"
          gap="$4"
        >
          <YStack gap="$2">
            <Dialog.Title
              color="$color12"
              fontFamily="$heading"
              fontSize="$6"
              fontWeight="700"
            >
              {title}
            </Dialog.Title>
            <Dialog.Description color="$color10" fontSize="$3">
              {description}
            </Dialog.Description>
          </YStack>
          <XStack gap="$3">
            <Button
              flex={1}
              chromeless
              disabled={isPending}
              onPress={() => {
                haptics.tap();
                onCancel();
              }}
            >
              {cancelLabel}
            </Button>
            <Button
              flex={1}
              bg={destructive ? "$destructive" : "$primary"}
              color="$primaryForeground"
              fontWeight="700"
              disabled={isPending}
              icon={isPending ? <FintSpinner color="$primaryForeground" /> : icon}
              onPress={() => {
                haptics[destructive ? "warning" : "tap"]();
                onConfirm();
              }}
            >
              {isPending ? (pendingLabel ?? confirmLabel) : confirmLabel}
            </Button>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
