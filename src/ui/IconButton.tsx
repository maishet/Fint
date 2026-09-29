import type { ReactNode } from "react";
import { View } from "tamagui";
import { PressableScale, type PressableScaleProps } from "./PressableScale";

type IconButtonTone = "default" | "brand" | "sunken" | "glassSlab";

export interface IconButtonProps extends Omit<PressableScaleProps, "children"> {
  icon: ReactNode;
  /** Obligatorio: un botón de solo icono necesita nombre para el lector de pantalla. */
  label: string;
  tone?: IconButtonTone;
  size?: 34 | 40 | 52;
}

const tones: Record<IconButtonTone, { bg: string; border: string }> = {
  default: { bg: "$surface", border: "$line" },
  brand: { bg: "$brand", border: "$brand" },
  sunken: { bg: "$surfaceSunken", border: "$surfaceSunken" },
  glassSlab: { bg: "$glassSlab", border: "$glassSlabLine" },
};

/** Botón circular de icono: cerrar, volver, acciones del hero. El icono hereda el color que le pases. */
export function IconButton({ icon, label, tone = "default", size = 40, hitSlop = 6, ...props }: IconButtonProps) {
  const t = tones[tone];
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} hitSlop={hitSlop} haptic="tap" {...props}>
      <View
        width={size}
        height={size}
        rounded={999}
        items="center"
        justify="center"
        bg={t.bg as any}
        borderColor={t.border as any}
        borderWidth={1}
      >
        {icon}
      </View>
    </PressableScale>
  );
}
