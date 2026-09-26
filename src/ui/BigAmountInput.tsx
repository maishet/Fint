import { useEffect, useRef, useState } from "react";
import { Keyboard, TextInput } from "react-native";
import { Text, View, XStack, useTheme } from "tamagui";
import { getCurrencySymbol } from "../finance/currencies";
import { sanitizeAmountInput } from "../forms";
import { fontFace, textStyles } from "../theme/typography";
import { FText } from "./FText";

/**
 * El monto a 44px en `mono`, centrado con su símbolo (y el signo, si se da).
 * El campo toma el ancho de lo escrito (se mide con un texto oculto) para que
 * símbolo y cifra queden juntos al centro. Bloqueado, se ve apagado y no se
 * edita. Lo usan el formulario de pago recurrente y la revisión de un pendiente.
 */
export function BigAmountInput({
  currency,
  value,
  locked = false,
  sign,
  label,
  onChange,
}: {
  currency: string;
  value: string;
  locked?: boolean;
  /** `−` (U+2212) en un egreso, `+` en un ingreso. */
  sign?: string;
  label: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  // Al cerrar el teclado (con "atrás") el campo pierde el foco, para que el próximo toque vuelva a seleccionar la
  // cifra entera. Controlar `selection` no sirve: en Android le reinicia la fuente al campo y la cifra sale sin `mono`.
  const input = useRef<TextInput>(null);
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => input.current?.blur());
    return () => sub.remove();
  }, []);
  const style = [textStyles.amount, { fontFamily: fontFace.mono[600], fontSize: 44, lineHeight: 52, letterSpacing: -1 }];
  return (
    <XStack justify="center" items="center" gap={6} mt={4} maxW="100%">
      <FText tone="inkFaint" style={{ fontFamily: fontFace.mono[500], fontSize: 22, lineHeight: 28, marginTop: 8 }}>
        {`${sign ?? ""}${getCurrencySymbol(currency)}`}
      </FText>
      <Text position="absolute" opacity={0} style={style} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} pointerEvents="none">
        {value || "0.00"}
      </Text>
      <View>
        {/* El marcador va aparte: en Android el `placeholder` de un campo no usa la fuente `mono`. */}
        {value ? null : (
          <Text position="absolute" l={0} r={0} numberOfLines={1} color="$inkFaint" style={style} pointerEvents="none">
            0.00
          </Text>
        )}
        <TextInput
          ref={input}
          value={value}
          onChangeText={(next) => onChange(sanitizeAmountInput(next))}
          editable={!locked}
          keyboardType="decimal-pad"
          // Tocar el monto lo selecciona entero: lo que se escribe lo reemplaza, en lugar de insertarse a la mitad.
          selectTextOnFocus
          selectionColor={theme.brand.val}
          accessibilityLabel={`${label} (${currency})`}
          style={[style, { color: locked ? theme.inkMuted.val : theme.ink.val, width: width ? width + 6 : undefined, minWidth: 40, padding: 0 }]}
        />
      </View>
    </XStack>
  );
}
