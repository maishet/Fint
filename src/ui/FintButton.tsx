import { useEffect, useRef } from "react";
import { Button, type ButtonProps } from "tamagui";
import { opacity, pressScale } from "../theme/tokens";
import { haptics } from "./haptics";

type FintButtonVariant = "solid" | "ink" | "outlined" | "soft" | "destructive" | "danger" | "ghost";
type FintButtonSize = "cta" | "row" | "mini";

const MIN_TOUCH_HEIGHT = 44;
/** Alturas de la hoja de componentes: CTA 56, en fila 40, mini 32. Las de menos de 44 completan el toque con `hitSlop`. */
const HEIGHTS: Record<FintButtonSize, number> = { cta: 56, row: 40, mini: 32 };
const FONT_SIZES: Record<FintButtonSize, number> = { cta: 17, row: 14, mini: 14 };

/**
 * - `solid`: la acción principal, amarillo `brand` con texto `onBrand`; presionado en `brandPress`. Una por pantalla.
 * - `ink`: acción fuerte que no es la principal (Sincronizar, Reconectar), `ink` con texto `canvas`.
 * - `outlined`: secundaria con contorno `line` de 1.5px (Quitar, Descartar, Agregar más); presionada en `surfaceSunken`.
 * - `soft`: secundaria en `surface` con texto `ink` (Confirmar en una lista, Pagar no vencido).
 * - `destructive`: borrar desde una fila o un detalle, `surface` con texto `dangerHard`.
 * - `danger`: solo en el diálogo que confirma el borrado. Relleno `dangerHard`.
 * - `ghost`: solo texto, para "Ahora no" o "Cancelar" bajo otro botón.
 *
 * `disabled` es "todavía no se puede": todas las variantes pasan a `surface` con texto `inkFaint`. `pending` es "ya
 * se está haciendo" (guardando, con el spinner dentro): ignora los toques pero conserva su color y el lector lo
 * anuncia ocupado, no desactivado. Quien pasa su propio `opacity` o `bg` manda sobre los dos.
 */
const variantStyles: Record<FintButtonVariant, { bg: string; pressBg: string; color: string; border: string }> = {
  solid: { bg: "$brand", pressBg: "$brandPress", color: "$onBrand", border: "transparent" },
  ink: { bg: "$ink", pressBg: "$ink", color: "$canvas", border: "transparent" },
  outlined: { bg: "transparent", pressBg: "$surfaceSunken", color: "$ink", border: "$line" },
  soft: { bg: "$surface", pressBg: "$surfaceSunken", color: "$ink", border: "transparent" },
  destructive: { bg: "$surface", pressBg: "$surfaceSunken", color: "$dangerHard", border: "transparent" },
  danger: { bg: "$dangerHard", pressBg: "$dangerHard", color: "$onDanger", border: "transparent" },
  ghost: { bg: "transparent", pressBg: "$surfaceSunken", color: "$inkMuted", border: "transparent" },
};

/** Deshabilitado, igual en todas las variantes. */
const DISABLED = { bg: "$surface", color: "$inkFaint", border: "transparent" };

interface FintButtonProps extends Omit<ButtonProps, "variant" | "size"> {
  variant?: FintButtonVariant;
  haptic?: "tap" | "select" | "warning" | "none";
  /** Guardando: no responde al toque, pero no se atenúa ni se anuncia desactivado. */
  pending?: boolean;
  /** `cta` 56 (por defecto), `row` 40, `mini` 32. Un `minH` explícito manda sobre el tamaño. */
  size?: FintButtonSize;
}

export function FintButton({
  disabled,
  pending = false,
  onPress,
  variant = "solid",
  haptic = "tap",
  circular,
  minH,
  size = "cta",
  ...props
}: FintButtonProps) {
  const height = typeof minH === "number" ? Math.max(minH, MIN_TOUCH_HEIGHT) : HEIGHTS[size];
  const slop = Math.max(0, Math.ceil((MIN_TOUCH_HEIGHT - height) / 2));
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

  const v = disabled ? { ...variantStyles[variant], ...DISABLED, pressBg: DISABLED.bg } : variantStyles[variant];
  const outlined = variant === "outlined" && !disabled;

  return (
    <Button
      transition="quick"
      bg={v.bg as ButtonProps["bg"]}
      color={v.color as ButtonProps["color"]}
      borderColor={v.border as ButtonProps["borderColor"]}
      borderWidth={outlined ? 1.5 : 0}
      circular={circular}
      {...(circular ? null : { minH: height, height, rounded: 999, px: size === "cta" ? 24 : 20 })}
      hitSlop={slop ? { top: slop, bottom: slop } : undefined}
      fontFamily="$body"
      fontWeight="700"
      fontSize={FONT_SIZES[size]}
      hoverStyle={{
        bg: v.pressBg as ButtonProps["bg"],
        borderColor: v.border as ButtonProps["borderColor"],
      }}
      pressStyle={
        pending || disabled
          ? undefined
          : {
              bg: v.pressBg as ButtonProps["bg"],
              borderColor: v.border as ButtonProps["borderColor"],
              opacity: variant === "ink" ? opacity.press : 1,
              scale: pressScale,
            }
      }
      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: "solid", outlineColor: "$ink", outlineOffset: 2 }}
      disabled={disabled}
      aria-busy={pending || undefined}
      onPress={handlePress}
      {...props}
    />
  );
}
