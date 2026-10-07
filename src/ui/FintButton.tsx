import { useEffect, useRef } from "react";
import { Button, type ButtonProps } from "tamagui";
import { opacity } from "../theme/tokens";
import { haptics } from "./haptics";

type FintButtonVariant = "solid" | "outlined" | "soft" | "danger" | "ghost";

/**
 * - `solid`: la acción principal, relleno `brand`. Una por pantalla.
 * - `outlined`: secundaria con borde `lineStrong` (Quitar, Descartar).
 * - `soft`: secundaria en `brandWash` con texto `brand` (Confirmar en una lista, Pagar no vencido).
 * - `danger`: solo para borrar. Relleno `dangerHard`.
 * - `ghost`: solo texto, para "Ahora no" o "Cancelar" bajo otro botón.
 *
 * `disabled` es "todavía no se puede": conserva el color y baja a `opacity.disabled`. `pending` es "ya se está
 * haciendo" (guardando, con el spinner dentro): ignora los toques pero queda a opacidad completa y el lector lo
 * anuncia ocupado, no desactivado. Quien pasa su propio `opacity` manda sobre los dos.
 */
const variantStyles: Record<FintButtonVariant, { bg: string; pressBg: string; color: string; border: string }> = {
  solid: { bg: "$brand", pressBg: "$brandStrong", color: "$onBrand", border: "$brand" },
  outlined: { bg: "transparent", pressBg: "$surfaceSunken", color: "$ink", border: "$lineStrong" },
  soft: { bg: "$brandWash", pressBg: "$brandWash", color: "$brand", border: "$brandWash" },
  danger: { bg: "$dangerHard", pressBg: "$dangerHard", color: "$onDanger", border: "$dangerHard" },
  ghost: { bg: "transparent", pressBg: "$surfaceSunken", color: "$inkMuted", border: "transparent" },
};

interface FintButtonProps extends Omit<ButtonProps, "variant"> {
  variant?: FintButtonVariant;
  haptic?: "tap" | "select" | "warning" | "none";
  /** Guardando: no responde al toque, pero no se atenúa ni se anuncia desactivado. */
  pending?: boolean;
}

export function FintButton({
  disabled,
  pending = false,
  onPress,
  variant = "solid",
  haptic = "tap",
  circular,
  ...props
}: FintButtonProps) {
  // El candado vive solo en el ref: con `disabled` el lector de pantalla anunciaba "desactivado" tras cada toque.
  const isPressLockedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const unlock = () => {
    isPressLockedRef.current = false;
  };

  const handlePress: ButtonProps["onPress"] = (event) => {
    if (disabled || pending || isPressLockedRef.current || !onPress) return;
    if (haptic !== "none") haptics[haptic]();
    isPressLockedRef.current = true;
    const result: unknown = (
      onPress as unknown as (pressEvent: unknown) => unknown
    )(event);

    if (result && typeof (result as Promise<unknown>).then === "function") {
      void Promise.resolve(result).finally(unlock);
      return;
    }

    timeoutRef.current = setTimeout(unlock, 700);
  };

  const v = variantStyles[variant];

  return (
    <Button
      transition="quick"
      bg={v.bg as ButtonProps["bg"]}
      color={v.color as ButtonProps["color"]}
      borderColor={v.border as ButtonProps["borderColor"]}
      borderWidth={variant === "outlined" ? 1 : 0}
      circular={circular}
      {...(circular ? null : { minH: 52, rounded: 14 })}
      fontFamily="$body"
      fontWeight="600"
      hoverStyle={{
        bg: v.pressBg as ButtonProps["bg"],
        borderColor: v.border as ButtonProps["borderColor"],
      }}
      pressStyle={
        pending
          ? undefined
          : {
              bg: v.pressBg as ButtonProps["bg"],
              borderColor: v.border as ButtonProps["borderColor"],
              opacity: opacity.press,
              scale: 0.97,
            }
      }
      opacity={disabled ? opacity.disabled : 1}
      disabled={disabled}
      aria-busy={pending || undefined}
      onPress={handlePress}
      {...props}
    />
  );
}
