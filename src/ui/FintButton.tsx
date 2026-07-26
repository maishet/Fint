import { useEffect, useRef, useState } from "react";
import { Button, type ButtonProps } from "tamagui";

interface FintButtonProps extends Omit<ButtonProps, "variant"> {
  variant?: "solid" | "outlined";
}

export function FintButton({ disabled, onPress, variant = "solid", ...props }: FintButtonProps) {
  const [isPressLocked, setIsPressLocked] = useState(false);
  const isMountedRef = useRef(true);
  const isPressLockedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    isMountedRef.current = false;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const unlock = () => {
    isPressLockedRef.current = false;
    if (isMountedRef.current) setIsPressLocked(false);
  };

  const handlePress: ButtonProps["onPress"] = (event) => {
    if (disabled || isPressLockedRef.current || !onPress) return;
    isPressLockedRef.current = true;
    setIsPressLocked(true);
    const result: unknown = (onPress as unknown as (pressEvent: unknown) => unknown)(event);

    if (result && typeof (result as Promise<unknown>).then === "function") {
      void Promise.resolve(result).finally(unlock);
      return;
    }

    timeoutRef.current = setTimeout(unlock, 700);
  };

  return (
    <Button
      bg={variant === "outlined" ? "transparent" : "$primary"}
      color={variant === "outlined" ? "$primary" : "$primaryForeground"}
      borderColor="$ring"
      borderWidth={variant === "outlined" ? 1 : 0}
      rounded={14}
      fontFamily="$body"
      fontWeight="700"
      hoverStyle={{ bg: variant === "outlined" ? "$secondary" : "$accent10" }}
      pressStyle={{
        bg: variant === "outlined" ? "$secondary" : "$accent10",
        opacity: variant === "outlined" ? 1 : 0.9,
      }}
      disabled={disabled || isPressLocked}
      onPress={handlePress}
      {...props}
    />
  );
}
