import type { TextStyle } from "react-native";

export const fontFiles = {
  "SchibstedGrotesk-SemiBold": require("../../assets/fonts/SchibstedGrotesk-SemiBold.ttf"),
  "SchibstedGrotesk-Bold": require("../../assets/fonts/SchibstedGrotesk-Bold.ttf"),
  "Geist-Regular": require("../../assets/fonts/Geist-Regular.ttf"),
  "Geist-Medium": require("../../assets/fonts/Geist-Medium.ttf"),
  "Geist-SemiBold": require("../../assets/fonts/Geist-SemiBold.ttf"),
  "GeistMono-Regular": require("../../assets/fonts/GeistMono-Regular.ttf"),
  "GeistMono-Medium": require("../../assets/fonts/GeistMono-Medium.ttf"),
  "GeistMono-SemiBold": require("../../assets/fonts/GeistMono-SemiBold.ttf"),
} as const;

/** Nombre de la fuente cargada por familia y peso. En Android cada peso es su propia familia. */
export const fontFace = {
  display: { 600: "SchibstedGrotesk-SemiBold", 700: "SchibstedGrotesk-Bold" },
  sans: { 400: "Geist-Regular", 500: "Geist-Medium", 600: "Geist-SemiBold" },
  mono: { 400: "GeistMono-Regular", 500: "GeistMono-Medium", 600: "GeistMono-SemiBold" },
} as const;

export const typography = {
  families: {
    heading: "SchibstedGrotesk",
    body: "Geist",
    numeric: "GeistMono",
  },
  usage: {
    heading: "Marca, títulos de pantalla y títulos de sección.",
    body: "Lectura general, formularios, listas y navegación.",
    numeric: "Todo número: montos, saldos, porcentajes, fechas y ejes.",
  },
} as const;

/** Cifras tabulares: un dígito ocupa siempre el mismo ancho, así un monto que cambia no hace saltar la fila. */
const tabular: TextStyle["fontVariant"] = ["tabular-nums", "lining-nums"];

/** Los estilos de texto del sistema, con los mismos nombres que en el design system. */
export const textStyles = {
  // display
  "display-xl": { fontFamily: fontFace.display[600], fontSize: 40, lineHeight: 42, letterSpacing: -1.2 },
  "display-lg": { fontFamily: fontFace.display[600], fontSize: 30, lineHeight: 34, letterSpacing: -0.8 },
  title: { fontFamily: fontFace.display[600], fontSize: 22, lineHeight: 27, letterSpacing: -0.4 },
  "section-title": { fontFamily: fontFace.display[600], fontSize: 20, lineHeight: 25, letterSpacing: -0.4 },
  // sans
  heading: { fontFamily: fontFace.sans[600], fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fontFace.sans[400], fontSize: 15, lineHeight: 22 },
  "body-strong": { fontFamily: fontFace.sans[600], fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fontFace.sans[500], fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFace.sans[400], fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: fontFace.sans[600], fontSize: 11, lineHeight: 14, letterSpacing: 1.4, textTransform: "uppercase" },
  // mono
  "amount-input": { fontFamily: fontFace.mono[500], fontSize: 64, lineHeight: 68, letterSpacing: -3, fontVariant: tabular },
  "amount-hero": { fontFamily: fontFace.mono[500], fontSize: 48, lineHeight: 52, letterSpacing: -2, fontVariant: tabular },
  "amount-hero-cents": { fontFamily: fontFace.mono[500], fontSize: 26, lineHeight: 30, letterSpacing: -0.8, fontVariant: tabular },
  "amount-lg": { fontFamily: fontFace.mono[500], fontSize: 22, lineHeight: 26, letterSpacing: -0.6, fontVariant: tabular },
  amount: { fontFamily: fontFace.mono[500], fontSize: 15, lineHeight: 20, letterSpacing: -0.1, fontVariant: tabular },
  "amount-sm": { fontFamily: fontFace.mono[500], fontSize: 13, lineHeight: 18, fontVariant: tabular },
  "figure-caption": { fontFamily: fontFace.mono[400], fontSize: 11, lineHeight: 14, fontVariant: tabular },
} satisfies Record<string, TextStyle>;

export type TextStyleName = keyof typeof textStyles;
