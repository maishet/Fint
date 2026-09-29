import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useTheme } from "tamagui";

/**
 * Contorno punteado para "Más" y "Nueva". En Android, `borderStyle: "dashed"`
 * con esquinas redondeadas se dibuja continuo, así que el punteado va en SVG,
 * encima del contenedor (que no lleva borde propio).
 */
export function DashedOutline({ radius, strokeWidth = 1.5, color }: { radius: number; strokeWidth?: number; color?: string }) {
  const theme = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const inset = strokeWidth / 2;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h}>
          <Rect
            x={inset}
            y={inset}
            width={size.w - strokeWidth}
            height={size.h - strokeWidth}
            rx={Math.min(radius, (size.h - strokeWidth) / 2)}
            fill="none"
            stroke={color ?? theme.lineStrong.val}
            strokeWidth={strokeWidth}
            strokeDasharray="4 3"
          />
        </Svg>
      ) : null}
    </View>
  );
}
