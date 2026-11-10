import { Card, type CardProps } from "tamagui";
import { useThemeMode } from "../theme/ThemeMode";
import { shadows } from "../theme/tokens";

interface FintCardProps extends CardProps {
  /** Sombra `raised` en lugar de `card`. Solo para lo que de verdad flota. */
  raised?: boolean;
}

/** Radio de las tarjetas de la marca D. */
const CARD_RADIUS = 22;

/**
 * Tarjeta del sistema (marca D): `surface` con radio 22, sin borde ni sombra. Sobre `canvas` el gris piedra ya la
 * separa del fondo. `raised` le pone la sombra `raised`, solo para lo que de verdad flota. Una tarjeta nunca va
 * sobre otra tarjeta.
 */
export function FintCard({ raised = false, style, ...props }: FintCardProps) {
  const { themeMode } = useThemeMode();

  return (
    // Sin `transition`: nada en la tarjeta se anima, y como componente animado (Reanimated) dejaba pegada la
    // sombra con la que nació (la oscura, si el tema se resolvía después) y sumaba trabajo a cada commit.
    <Card
      bg="$surface"
      borderWidth={0}
      p="$4"
      rounded={CARD_RADIUS}
      style={[raised ? { boxShadow: shadows[themeMode].raised } : null, style as object]}
      {...props}
    />
  );
}
