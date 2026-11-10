import { useEffect, useRef } from "react";
import { Button, type ButtonProps } from "tamagui";
import { opacity, pressScale } from "../theme/tokens";
import { haptics } from "./haptics";

type FintButtonVariant = "solid" | "ink" | "outlined" | "soft" | "destructive" | "danger" | "ghost";
type FintButtonSize = "cta" | "row" | "mini";

const MIN_TOUCH_HEIGHT = 44;
const HEIGHTS: Record<FintButtonSize, number> = { cta: 56, row: 40, mini: 32 };
const FONT_SIZES: Record<FintButtonSize, number> = { cta: 17, row: 14, mini: 14 };

const variantStyles: Record<FintButtonVariant, { bg: string; pressBg: string; color: string; border: string }> = {
  solid: { bg: "$brand", pressBg: "$brandPress", color: "$onBrand", border: "transparent" },
  ink: { bg: "$ink", pressBg: "$ink", color: "$canvas", border: "transparent" },
  outlined: { bg: "transparent", pressBg: "$surfaceSunken", color: "$ink", border: "$line" },
  soft: { bg: "$surface", pressBg: "$surfaceSunken", color: "$ink", border: "transparent" },
  destructive: { bg: "$surface", pressBg: "$surfaceSunken", color: "$dangerHard", border: "transparent" },
  danger: { bg: "$dangerHard", pressBg: "$dangerHard", color: "$onDanger", border: "transparent" },
  ghost: { bg: "transparent", pressBg: "$surfaceSunken", color: "$inkMuted", border: "transparent" },
};

const DISABLED = { bg: "$surface", color: "$inkFaint", border: "transparent" };

interface FintButtonProps extends Omit<ButtonProps, "variant" | "size"> {
  variant?: FintButtonVariant;
  haptic?: "tap" | "select" | "warning" | "none";
  /** Guardando: no responde al toque, pero no se atenúa ni se anuncia desactivado. */
  pending?: boolean;
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
