import type { ReactNode } from "react";
import type { TextInputProps } from "react-native";
import { YStack } from "tamagui";
import { ErrorLine, SheetField, SheetTextInput } from "../ui";

/** Campo del login y sus pasos: hundido, con borde `brand` al enfocarse y el error debajo. */
export function AuthField({ error, focused, trailing, ...input }: TextInputProps & { error?: string; focused: boolean; trailing?: ReactNode }) {
  return (
    <YStack gap={6}>
      <SheetField focused={focused} invalid={Boolean(error)}>
        <SheetTextInput {...input} />
        {trailing}
      </SheetField>
      {error ? <ErrorLine message={error} mt={0} /> : null}
    </YStack>
  );
}
