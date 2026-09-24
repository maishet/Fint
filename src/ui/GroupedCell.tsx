import type { ReactNode } from "react";
import { View } from "tamagui";
import { radius } from "../theme/tokens";

/**
 * Una fila dentro de una tarjeta agrupada en una lista virtualizada: cada fila
 * dibuja su parte del borde (la primera, las esquinas de arriba; la última, las
 * de abajo) y el filete que la separa de la anterior, así el grupo se ve como
 * una sola tarjeta `surface` con filete `line`. `danger` pinta el borde en
 * `dangerHard` (lo vencido).
 */
export function GroupedCell({ first, last, tone = "default", children }: { first: boolean; last: boolean; tone?: "default" | "danger"; children: ReactNode }) {
  const corner = (on: boolean) => (on ? radius.lg : 0);
  return (
    <View
      bg="$surface"
      borderColor={tone === "danger" ? "$dangerHard" : "$line"}
      borderLeftWidth={1}
      borderRightWidth={1}
      borderTopWidth={first ? 1 : 0}
      borderBottomWidth={last ? 1 : 0}
      overflow="hidden"
      style={{
        borderTopLeftRadius: corner(first),
        borderTopRightRadius: corner(first),
        borderBottomLeftRadius: corner(last),
        borderBottomRightRadius: corner(last),
      }}
    >
      {!first ? <View height={1} bg="$line" /> : null}
      {children}
    </View>
  );
}
