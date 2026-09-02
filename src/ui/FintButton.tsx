import { useEffect, useRef, useState } from "react";
import { Button, type ButtonProps } from "tamagui";
import { haptics } from "./haptics";

interface FintButtonProps extends Omit<ButtonProps, "variant"> {
  variant?: "solid" | "outlined";
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

  return (
    <Button
      transition="quick"
      bg={variant === "outlined" ? "transparent" : "$primary"}
      color={variant === "outlined" ? "$primary" : "$primaryForeground"}
      borderColor="$primary"
      borderWidth={variant === "outlined" ? 1 : 0}
      circular={circular}
      {...(circular ? null : { minH: 50, rounded: 14 })}
      fontFamily="$body"
      fontWeight="600"
      hoverStyle={{
        bg: variant === "outlined" ? "$card" : "$primaryStrong",
        borderColor: "$primary",
      }}
      pressStyle={{
        bg: variant === "outlined" ? "$card" : "$primaryStrong",
        borderColor: "$primary",
        opacity: variant === "outlined" ? 1 : 0.94,
        scale: 0.97,
      }}
      disabled={disabled || isPressLocked}
      onPress={handlePress}
      {...props}
    />
  );
}
