import Svg, { Ellipse, G, Path, Rect } from "react-native-svg";
import { useTheme } from "tamagui";

/**
 * Las monedas del logo D en un lienzo de 120, de la más grande (abajo) a la más chica: centro de la cara (`cy`),
 * radios de la cara y el alto del canto. Son las medidas de `assets/images/splash-logo.png` (1056 px = 120), para que
 * la pantalla de carga continúe a la pantalla nativa sin salto.
 */
export const BRAND_COINS = [
  { cy: 72.2, rx: 36, ry: 11.6 },
  { cy: 55.3, rx: 29.7, ry: 10.3 },
  { cy: 39.4, rx: 21.2, ry: 9.4 },
] as const;
export const BRAND_COIN_DEPTH = 6.4;
/** Canto de las monedas sobre el amarillo: es el mismo en los dos temas. */
export const BRAND_COIN_EDGE = "#6B5A1E";
/**
 * Donde el fondo no es amarillo, el logo va en un cuadrado amarillo de radio 26 % y las monedas se achican a
 * `BRAND_TILE_SCALE` alrededor del centro (las medidas de `splash-logo-dark.png`).
 */
export const BRAND_TILE = { inset: 9.55, radius: 26.2 } as const;
export const BRAND_TILE_SCALE = 0.83;

/** El canto de una moneda: los lados y la mitad de abajo de la elipse, `depth` más abajo que la cara. */
export function coinEdgePath(cy: number, rx: number, ry: number, depth = BRAND_COIN_DEPTH) {
  "worklet";
  const l = 60 - rx;
  const r = 60 + rx;
  return `M ${l} ${cy} L ${l} ${cy + depth} A ${rx} ${ry} 0 0 0 ${r} ${cy + depth} L ${r} ${cy} Z`;
}

export interface BrandSymbolProps {
  size: number;
  /** Con `true`, el logo va dentro del cuadrado amarillo (para fondos que no son amarillos). */
  tile?: boolean;
}

/**
 * El logo D quieto: tres monedas tinta con su canto, siempre sobre amarillo. Sobre la losa va solo; en cualquier
 * otro fondo, con `tile`. El animado (`FintLogoLoader`) es solo para pantallas de carga y usa las mismas medidas.
 */
export function BrandSymbol({ size, tile = false }: BrandSymbolProps) {
  const theme = useTheme();
  const coin = theme.slabInk.val;
  const yellow = theme.slab.val;
  const scale = tile ? BRAND_TILE_SCALE : 1;
  const side = 120 - 2 * BRAND_TILE.inset;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {tile ? <Rect x={BRAND_TILE.inset} y={BRAND_TILE.inset} width={side} height={side} rx={BRAND_TILE.radius} fill={yellow} /> : null}
      <G transform={`translate(60 60) scale(${scale}) translate(-60 -60)`}>
        {BRAND_COINS.map((c, k) => (
          <G key={k}>
            <Path d={coinEdgePath(c.cy, c.rx, c.ry)} fill={BRAND_COIN_EDGE} />
            <Ellipse cx={60} cy={c.cy} rx={c.rx} ry={c.ry} fill={coin} />
          </G>
        ))}
      </G>
    </Svg>
  );
}
