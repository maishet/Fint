import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import type { ReactNode } from "react";
import { useState } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Paragraph, Sheet, XStack, YStack } from "tamagui";
import { FintButton } from "./FintButton";

export function FintTimeField({
  doneLabel = "OK",
  hour,
  minute,
  onChange,
  renderTrigger,
  title,
}: {
  doneLabel?: string;
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  renderTrigger: (props: { onPress: () => void }) => ReactNode;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const value = new Date();
  value.setHours(hour, minute, 0, 0);

  const handleAndroidChange = (
    event: DateTimePickerEvent,
    selected?: Date,
  ) => {
    setOpen(false);
    if (event.type === "set" && selected) {
      onChange(selected.getHours(), selected.getMinutes());
    }
  };

  return (
    <>
      {renderTrigger({ onPress: () => setOpen(true) })}
      {Platform.OS === "android" && open ? (
        <DateTimePicker
          value={value}
          mode="time"
          onChange={handleAndroidChange}
        />
      ) : null}
      {Platform.OS === "ios" ? (
        <Sheet
          modal
          open={open}
          onOpenChange={setOpen}
          snapPointsMode="fit"
          dismissOnSnapToBottom
          zIndex={120_000}
        >
          <Sheet.Overlay bg="rgba(4,18,28,0.62)" />
          <Sheet.Handle bg="$color5" />
          <Sheet.Frame
            bg="$popover"
            px="$4"
            pt="$3"
            pb={Math.max(insets.bottom, 16)}
            rounded={18}
            gap="$3"
          >
            {title ? (
              <XStack justify="center">
                <Paragraph color="$color12" fontWeight="800" fontSize="$5">
                  {title}
                </Paragraph>
              </XStack>
            ) : null}
            <YStack items="center">
              <DateTimePicker
                value={value}
                mode="time"
                display="spinner"
                onChange={(_event, selected) => {
                  if (selected) onChange(selected.getHours(), selected.getMinutes());
                }}
              />
            </YStack>
            <FintButton onPress={() => setOpen(false)}>{doneLabel}</FintButton>
          </Sheet.Frame>
        </Sheet>
      ) : null}
    </>
  );
}
