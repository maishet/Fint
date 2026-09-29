import type { ReactElement } from "react";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import { View, useTheme } from "tamagui";
import { withAlpha } from "../theme/color";
import { useThemeMode } from "../theme/ThemeMode";
import { radius } from "../theme/tokens";

const SIZE = 60;

/**
 * La miniatura del campo Ubicación del formulario (60px): un plano dibujado con los colores del tema (calles, un
 * parque y agua, como en el diseño) con el pin del lugar en el centro. No es un mapa real: en una fila de 60px no
 * se lee nada de un mapa, cargar Google Maps en el formulario pesa y su versión liviana no sigue el tema oscuro. El
 * mapa real está en la hoja de ubicación. `nearby` (la ubicación sugerida): el punto con su círculo de precisión.
 */
export function MapThumb({ nearby = false }: { nearby?: boolean }) {
  const theme = useTheme();
  const { themeMode } = useThemeMode();
  const dark = themeMode === "dark";
  const land = theme.surfaceSunken.val;
  const road = dark ? theme.line.val : theme.surface.val;
  const main = dark ? theme.inkFaint.val : theme.surface.val;
  const park = withAlpha(theme.flowIn.val, 0.16);
  const water = withAlpha(theme.chart4.val, 0.2);
  const brand = theme.brand.val;
  const surface = theme.surface.val;
  const c = SIZE / 2;

  const streets: ReactElement[] = [];
  for (let x = -120; x < SIZE + 120; x += 38) streets.push(<Path key={`v${x}`} d={`M${x} -80V${SIZE + 80}`} stroke={road} strokeWidth={5} />);
  for (let y = -120; y < SIZE + 120; y += 30) streets.push(<Path key={`h${y}`} d={`M-80 ${y}H${SIZE + 80}`} stroke={road} strokeWidth={4} />);

  return (
    <View width={SIZE} height={SIZE} rounded={radius.md} overflow="hidden" pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Rect width={SIZE} height={SIZE} fill={land} />
        <G rotation={-24} origin={`${c}, ${c}`}>
          <Rect x={c + 24} y={c - 58} width={72} height={52} rx={3} fill={park} />
          <Rect x={c - 92} y={c + 34} width={34} height={56} rx={3} fill={park} />
          {streets}
          <Path d={`M${c + 8} -80V${SIZE + 80}`} stroke={main} strokeOpacity={dark ? 0.5 : 1} strokeWidth={11} />
          <Path d={`M-80 ${c + 16}H${SIZE + 80}`} stroke={main} strokeOpacity={dark ? 0.5 : 1} strokeWidth={8} />
        </G>
        <Path d={`M0 0H${SIZE * 0.16}C${SIZE * 0.12} ${SIZE * 0.3} ${SIZE * 0.2} ${SIZE * 0.55} ${SIZE * 0.1} ${SIZE}H0Z`} fill={water} />
        {nearby ? (
          <>
            <Circle cx={c} cy={c} r={20} fill={withAlpha(brand, 0.16)} stroke={withAlpha(brand, 0.4)} strokeWidth={1} />
            <Circle cx={c} cy={c} r={6} fill={brand} stroke={surface} strokeWidth={2} />
          </>
        ) : (
          <>
            <Ellipse cx={c} cy={c + 9} rx={7} ry={2.6} fill="rgba(0,0,0,0.22)" />
            <Path d={`M${c} ${c + 8}c-1.2-4-9-9.6-9-16.2a9 9 0 0 1 18 0c0 6.6-7.8 12.2-9 16.2z`} fill={brand} stroke={surface} strokeWidth={2} />
            <Circle cx={c} cy={c - 8.5} r={3.4} fill={surface} />
          </>
        )}
      </Svg>
    </View>
  );
}
