import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { FlatList, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Text, View, XStack, YStack } from "tamagui";
import { radius, space } from "../theme/tokens";
import { textStyles } from "../theme/typography";
import { FintButton } from "./FintButton";
import { FintSheet } from "./FintSheet";
import { FText } from "./FText";
import { haptics } from "./haptics";

const ITEM = 44;
const VISIBLE = 5;
const SHEET_UNMOUNT_MS = 600;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/**
 * Elegir una hora (el recordatorio diario). Antes abría el reloj nativo de
 * Android, que toma los colores del tema del sistema y no los de la app; ahora
 * es una `FintSheet` con dos ruedas en `mono` (horas 00–23 y minutos 00–59)
 * sobre una banda `surfaceSunken`, igual en Android e iOS. La hora se aplica
 * con "Listo"; cerrar la hoja la descarta.
 */
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
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState({ hour, minute });

  useEffect(() => {
    if (open) return;
    const id = setTimeout(() => setMounted(false), SHEET_UNMOUNT_MS);
    return () => clearTimeout(id);
  }, [open]);

  return (
    <>
      {renderTrigger({
        onPress: () => {
          setDraft({ hour, minute });
          setMounted(true);
          setOpen(true);
        },
      })}
      {mounted ? (
        // Sin arrastre: girar las ruedas movía la hoja y a veces la cerraba. Se cierra con la X, el velo o "atrás".
        <FintSheet open={open} onClose={() => setOpen(false)} title={title} titleSize="compact" disableDrag>
          <YStack px={space[5]} pb={space[2]} gap={space[5]}>
            <XStack justify="center" items="center" gap={space[2]}>
              {/* Banda de la selección, detrás de las dos ruedas. */}
              <View position="absolute" l={0} r={0} t={ITEM * 2} height={ITEM} rounded={radius.md} bg="$surfaceSunken" />
              <Wheel values={HOURS} value={draft.hour} onChange={(h) => setDraft((d) => ({ ...d, hour: h }))} />
              <Text color="$ink" style={{ ...textStyles["amount-lg"], fontSize: 26 }}>
                :
              </Text>
              <Wheel values={MINUTES} value={draft.minute} onChange={(m) => setDraft((d) => ({ ...d, minute: m }))} />
            </XStack>
            <FintButton
              onPress={() => {
                onChange(draft.hour, draft.minute);
                setOpen(false);
              }}
            >
              {doneLabel}
            </FintButton>
          </YStack>
        </FintSheet>
      ) : null}
    </>
  );
}

/** Una rueda: se desplaza con el dedo y encaja en cada valor; el del centro va en `ink` y los demás en `inkFaint`. */
function Wheel({ values, value, onChange }: { values: number[]; value: number; onChange: (value: number) => void }) {
  const [center, setCenter] = useState(values.indexOf(value));
  const last = useRef(center);
  const indexAt = (y: number) => Math.min(values.length - 1, Math.max(0, Math.round(y / ITEM)));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = indexAt(e.nativeEvent.contentOffset.y);
    if (i !== last.current) {
      last.current = i;
      setCenter(i);
      haptics.select();
    }
  };
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => onChange(values[indexAt(e.nativeEvent.contentOffset.y)]);

  return (
    <View width={72} height={ITEM * VISIBLE}>
      <FlatList
        data={values}
        keyExtractor={(v) => String(v)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        nestedScrollEnabled
        initialScrollIndex={Math.max(0, values.indexOf(value))}
        getItemLayout={(_, i) => ({ length: ITEM, offset: ITEM * i, index: i })}
        contentContainerStyle={{ paddingVertical: ITEM * 2 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={(e) => {
          // Sin inercia (un arrastre corto y suelto) no hay `onMomentumScrollEnd`.
          if (!e.nativeEvent.velocity || Math.abs(e.nativeEvent.velocity.y) < 0.05) settle(e);
        }}
        renderItem={({ item, index }) => (
          <View height={ITEM} items="center" justify="center">
            <FText
              variant="amount-lg"
              tone={index === center ? "ink" : "inkFaint"}
              style={{ fontSize: index === center ? 26 : 20, opacity: Math.abs(index - center) > 1 ? 0.5 : 1 }}
            >
              {String(item).padStart(2, "0")}
            </FText>
          </View>
        )}
      />
    </View>
  );
}
