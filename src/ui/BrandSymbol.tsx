import Svg, { Circle, Ellipse } from "react-native-svg";
import { useTheme } from "tamagui";

export interface BrandSymbolProps {
  size: number;
  /** Token del disco: `$slab` por defecto; sobre la losa, `$glassSlab`. */
  disc?: string;
  /** Token de las monedas. */
  coin?: string;
}

/**
 * El isotipo quieto: tres monedas sobre un disco, con los colores del tema. El
 * animado (`FintCoinStack`) es solo para pantallas de carga.
 */
export function BrandSymbol({ size, disc = "$slab", coin = "$slabInk" }: BrandSymbolProps) {
  const theme = useTheme() as unknown as Record<string, { val: string } | undefined>;
  const d = theme[disc.slice(1)]?.val;
  const c = theme[coin.slice(1)]?.val;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={60} cy={60} r={58} fill={d} />
      <Ellipse cx={60} cy={78} rx={34} ry={11} fill={c} opacity={0.55} />
      <Ellipse cx={60} cy={62} rx={28} ry={10} fill={c} opacity={0.78} />
      <Ellipse cx={60} cy={47} rx={20} ry={9} fill={c} />
    </Svg>
  );
}
