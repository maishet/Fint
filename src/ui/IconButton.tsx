import type { ReactNode } from "react";
import { View } from "tamagui";
import { PressableScale, type PressableScaleProps } from "./PressableScale";

type IconButtonTone = "default" | "brand" | "ink" | "sunken" | "glassSlab";

export interface IconButtonProps extends Omit<PressableScaleProps, "children"> {
  icon: ReactNode;
  /** Obligatorio: un botón de solo icono necesita nombre para el lector de pantalla. */
  label: string;
  tone?: IconButtonTone;
  size?: 34 | 40 | 44 | 52;
}

/** Área táctil mínima: los botones de 34 y 40 la completan con `hitSlop`. */
const MIN_TOUCH = 44;

const tones: Record<IconButtonTone, string> = {
  default: "$surface",
  brand: "$brand",
  ink: "$ink",
  sunken: "$surfaceSunken",
  glassSlab: "$glassSlab",
};

/**
 * Botón circular de icono: cerrar, volver, acciones de cabecera. 44 por defecto sobre `surface`, sin borde;
 * `brand` (amarillo) para la acción principal de una cabecera e `ink` para el estado activo. El icono hereda el
 * color que le pases.
 */
export function IconButton({ icon, label, tone = "default", size = 44, hitSlop, ...props }: IconButtonProps) {
  const slop = hitSlop ?? Math.max(0, Math.ceil((MIN_TOUCH - size) / 2));
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} hitSlop={slop} haptic="tap" {...props}>
      <View width={size} height={size} rounded={999} items="center" justify="center" bg={tones[tone] as never}>
        {icon}
      </View>
    </PressableScale>
  );
}
