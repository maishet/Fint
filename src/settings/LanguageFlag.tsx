import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { View } from "tamagui";
import type { AppLanguage } from "../i18n";

/**
 * La bandera de cada idioma en un círculo, para la hoja de Idioma: Perú para español (la app nace en soles),
 * Estados Unidos para inglés y Brasil para portugués. Dibujadas a mano en un lienzo de 30 y recortadas por el
 * círculo del contenedor, con un filete `line` para que el blanco no se pierda sobre `canvas`. Es decorativa: la
 * fila ya dice el idioma.
 */
export function LanguageFlag({ language, size = 28 }: { language: AppLanguage; size?: number }) {
  return (
    <View
      width={size}
      height={size}
      rounded={999}
      overflow="hidden"
      borderWidth={1}
      borderColor="$line"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox="0 0 30 30">
        {language === "es" ? <Peru /> : language === "en" ? <UnitedStates /> : <Brazil />}
      </Svg>
    </View>
  );
}

function Peru() {
  return (
    <G>
      <Rect x={0} y={0} width={10} height={30} fill="#D91023" />
      <Rect x={10} y={0} width={10} height={30} fill="#FFFFFF" />
      <Rect x={20} y={0} width={10} height={30} fill="#D91023" />
    </G>
  );
}

const US_STRIPE = 30 / 13;

function UnitedStates() {
  return (
    <G>
      <Rect x={0} y={0} width={30} height={30} fill="#FFFFFF" />
      {Array.from({ length: 7 }, (_, i) => (
        <Rect key={i} x={0} y={i * 2 * US_STRIPE} width={30} height={US_STRIPE} fill="#B31942" />
      ))}
      <Rect x={0} y={0} width={15} height={US_STRIPE * 7} fill="#0A3161" />
      {[3, 7.5, 12].flatMap((x) => [3.5, 8, 12.5].map((y) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={0.9} fill="#FFFFFF" />))}
    </G>
  );
}

function Brazil() {
  return (
    <G>
      <Rect x={0} y={0} width={30} height={30} fill="#009C3B" />
      <Path d="M2 15 L15 5 L28 15 L15 25 Z" fill="#FFDF00" />
      <Circle cx={15} cy={15} r={6.2} fill="#002776" />
      <Path d="M8.9 14.2 C12.5 13.2 17.5 13.6 21.1 16.2 L20.9 17.3 C17.3 14.8 12.6 14.4 9 15.4 Z" fill="#FFFFFF" />
    </G>
  );
}
