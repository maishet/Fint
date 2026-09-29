import { useEffect, useRef, useState } from "react";
import { Button, type ButtonProps } from "tamagui";
import { haptics } from "./haptics";

type FintButtonVariant = "solid" | "outlined" | "soft" | "danger" | "ghost";

/**
 * - `solid`: la acción principal, relleno `brand`. Una por pantalla.
 * - `outlined`: secundaria con borde `lineStrong` (Quitar, Descartar).
 * - `soft`: secundaria en `brandWash` con texto `brand` (Confirmar en una lista, Pagar no vencido).
 * - `danger`: solo para borrar. Relleno `dangerHard`.
 * - `ghost`: solo texto, para "Ahora no" o "Cancelar" bajo otro botón.
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
}

export function FintButton({
  disabled,
  onPress,
  variant = "solid",
  haptic = "tap",
  circular,
  ...props
}: FintButtonProps) {
  const [isPressLocked, setIsPressLocked] = useState(false);
  const isMountedRef = useRef(true);
  const isPressLockedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      isMountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const unlock = () => {
    isPressLockedRef.current = false;
    if (isMountedRef.current) setIsPressLocked(false);
  };

  const handlePress: ButtonProps["onPress"] = (event) => {
    if (disabled || isPressLockedRef.current || !onPress) return;
    if (haptic !== "none") haptics[haptic]();
    isPressLockedRef.current = true;
    setIsPressLocked(true);
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
      pressStyle={{
        bg: v.pressBg as ButtonProps["bg"],
        borderColor: v.border as ButtonProps["borderColor"],
        opacity: 0.88,
        scale: 0.97,
      }}
      disabled={disabled || isPressLocked}
      onPress={handlePress}
      {...props}
    />
  );
}
