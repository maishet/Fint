import { Card, type CardProps } from "tamagui";
import { useThemeMode } from "../theme/ThemeMode";
import { radius, shadows } from "../theme/tokens";

interface FintCardProps extends CardProps {
  /** Sombra `raised` en lugar de `card`. Solo para lo que de verdad flota. */
  raised?: boolean;
}

/**
 * Tarjeta del sistema: `surface`, filete `line` de 1px y `radius-lg`. En claro
 * el filete es lo que la separa del fondo; la sombra es casi invisible a
 * propósito. Una tarjeta nunca va sobre otra tarjeta.
 */
export function FintCard({ raised = false, style, ...props }: FintCardProps) {
  const { themeMode } = useThemeMode();

  return (
    <Card
      transition="quick"
      bg="$surface"
      borderColor="$line"
      borderWidth={1}
      p="$4"
      rounded={radius.lg}
      style={[{ boxShadow: shadows[themeMode][raised ? "raised" : "card"] }, style as object]}
      {...props}
    />
  );
}
