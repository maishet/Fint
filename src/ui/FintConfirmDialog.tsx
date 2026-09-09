import type { ComponentProps } from "react";
import { Button, Dialog, YStack } from "tamagui";
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
      {/* Sin esto el diálogo se ancla abajo y tapa el campo que estabas usando. */}
      <Dialog.Portal items="center" justify="center">
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
              fontWeight="600"
            >
              {title}
            </Dialog.Title>
            <Dialog.Description color="$color10" fontSize="$3">
              {description}
            </Dialog.Description>
          </YStack>
          {/*
            En fila, media caja no da para etiquetas como "Seguir editando" y el
            botón las recortaba. Apiladas caben enteras en cualquier idioma y a
            cualquier tamaño de fuente del sistema.
          */}
          <YStack gap="$2">
            <Button
              width="100%"
              minH={50}
              rounded={14}
              bg={destructive ? "$destructive" : "$primary"}
              color="$primaryForeground"
              fontWeight="600"
              disabled={isPending}
              icon={isPending ? <FintSpinner color="$primaryForeground" /> : icon}
              onPress={() => {
                haptics[destructive ? "warning" : "tap"]();
                onConfirm();
              }}
            >
              {isPending ? (pendingLabel ?? confirmLabel) : confirmLabel}
            </Button>
            <Button
              width="100%"
              minH={46}
              rounded={14}
              chromeless
              color="$color11"
              disabled={isPending}
              onPress={() => {
                haptics.tap();
                onCancel();
              }}
            >
              {cancelLabel}
            </Button>
          </YStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
