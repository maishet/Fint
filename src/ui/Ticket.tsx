import { useState, type ReactNode } from "react";
import type { LayoutChangeEvent } from "react-native";
import { View, YStack, type ColorTokens } from "tamagui";
import { ticket } from "../theme/tokens";

export interface TicketProps {
  /** Lo de arriba del filete: el título, la cifra grande y su nota. */
  top: ReactNode;
  /** Lo de abajo del filete (dos cifras, acciones). Sin esto la boleta no lleva filete ni muescas. */
  bottom?: ReactNode;
  /** El fondo sobre el que va la boleta: las muescas se pintan de ese color. */
  notchColor?: ColorTokens;
  /** Lo que el lector dice de la boleta entera; sin esto lee cada parte por separado. */
  accessibilityLabel?: string;
}

/**
 * La boleta amarilla de la marca D, igual en los dos temas: radio 26 y, si hay parte de abajo, un filete tinta al
 * 16 % con dos muescas del color del fondo que lo cortan a los lados. La altura de la parte de arriba se mide para
 * poner el filete justo debajo, aunque el texto crezca con la letra del sistema. El texto de adentro va en `slabInk`
 * y el secundario en `slabMuted`.
 */
export function Ticket({ top, bottom, notchColor = "$canvas", accessibilityLabel }: TicketProps) {
  const [topHeight, setTopHeight] = useState(0);
  const group = accessibilityLabel ? { accessible: true, accessibilityLabel } : null;

  return (
    <View bg="$slab" style={{ borderRadius: ticket.radius }} {...group}>
      <YStack px={18} pt={16} pb={bottom ? 16 : 18} onLayout={(e: LayoutChangeEvent) => setTopHeight(e.nativeEvent.layout.height)}>
        {top}
      </YStack>
      {bottom ? (
        <>
          {topHeight ? (
            <>
              <View position="absolute" l={22} r={22} t={topHeight} height={0} borderTopWidth={1.5} style={{ borderColor: ticket.rule }} />
              <View position="absolute" l={-ticket.notch / 2} t={topHeight - ticket.notch / 2} width={ticket.notch} height={ticket.notch} rounded={999} bg={notchColor} />
              <View position="absolute" r={-ticket.notch / 2} t={topHeight - ticket.notch / 2} width={ticket.notch} height={ticket.notch} rounded={999} bg={notchColor} />
            </>
          ) : null}
          <YStack px={18} pt={18} pb={18}>
            {bottom}
          </YStack>
        </>
      ) : null}
    </View>
  );
}

/** Barra de carga sobre la boleta: tinta al 12 %. */
export function TicketBar({ width, height, rounded = 8, mt = 0 }: { width: number | `${number}%`; height: number; rounded?: number; mt?: number }) {
  return <View width={width} height={height} rounded={rounded} mt={mt} style={{ backgroundColor: ticket.skeleton }} />;
}
