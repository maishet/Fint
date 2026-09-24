import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, TextInput } from "react-native";
import { XStack, YStack, useTheme } from "tamagui";
import { radius } from "../theme/tokens";
import { fontFace, textStyles } from "../theme/typography";
import { Chip, FintSheet, FText } from "../ui";

export const NOTE_MAX = 200;

export interface NoteSheetProps {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  recent: readonly string[];
}

/**
 * Hoja de nota: un campo de varias líneas con el borde `brand` activo, un
 * contador en `mono` hasta 200 caracteres y las notas recientes como chips
 * (tocar uno lo copia). "Listo" reemplaza la X porque el teclado del sistema
 * ocupa la mitad de abajo; la hoja sube pegada a él.
 */
export function NoteSheet({ open, onClose, value, onChange, recent }: NoteSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [draft, setDraft] = useState(value);
  // El campo no es controlado (`defaultValue`): con `value`, en Android se perdían letras al escribir rápido.
  // Para reemplazar el texto (una nota reciente, o al abrir) se vuelve a montar con otra clave.
  const [fieldKey, setFieldKey] = useState(0);
  const input = useRef<TextInput>(null);
  const replace = (next: string) => {
    setDraft(next.slice(0, NOTE_MAX));
    setFieldKey((k) => k + 1);
  };

  useEffect(() => {
    if (!open) return;
    replace(value);
    // Espera a que la hoja empiece a subir para que el teclado no la empuje a medio camino.
    const id = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const done = () => {
    onChange(draft.trim());
    input.current?.blur();
    onClose();
  };

  return (
    <FintSheet
      open={open}
      onClose={done}
      title={t("movementForm.note")}
      headerAction={{ label: t("movementForm.noteSheet.done"), onPress: done }}
    >
      <YStack
        mx={16}
        mt={14}
        rounded={radius.md}
        bg="$surfaceSunken"
        borderWidth={1.5}
        borderColor="$brand"
        px={14}
        pt={12}
        pb={10}
        minH={112}
      >
        <TextInput
          ref={input}
          key={fieldKey}
          defaultValue={draft}
          onChangeText={setDraft}
          maxLength={NOTE_MAX}
          multiline
          placeholder={t("movementForm.noteSheet.placeholder")}
          placeholderTextColor={theme.inkFaint.val}
          selectionColor={theme.brand.val}
          accessibilityLabel={t("movementForm.note")}
          style={[
            textStyles.body,
            { fontSize: 16, lineHeight: 23, color: theme.ink.val, minHeight: 70, padding: 0, textAlignVertical: "top" },
          ]}
        />
        <FText variant="figure-caption" tone="inkFaint" style={{ alignSelf: "flex-end", marginTop: 4 }}>
          {`${draft.length} / ${NOTE_MAX}`}
        </FText>
      </YStack>

      {recent.length > 0 ? (
        <>
          <FText
            variant="caption"
            tone="inkMuted"
            style={{ fontFamily: fontFace.sans[600], marginTop: 18, marginBottom: 8, marginHorizontal: 20 }}
          >
            {t("movementForm.noteSheet.recent")}
          </FText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <XStack gap={8} px={16}>
              {recent.map((note) => (
                <Chip
                  key={note}
                  variant="filter"
                  label={note}
                  onPress={() => {
                    replace(note);
                    setTimeout(() => input.current?.focus(), 50);
                  }}
                />
              ))}
            </XStack>
          </ScrollView>
        </>
      ) : null}
    </FintSheet>
  );
}
