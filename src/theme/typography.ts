import type { TextStyle } from "react-native";

export const fontFiles = {
  "Figtree-Regular": require("../../assets/fonts/Figtree-Regular.ttf"),
  "Figtree-Medium": require("../../assets/fonts/Figtree-Medium.ttf"),
  "Figtree-SemiBold": require("../../assets/fonts/Figtree-SemiBold.ttf"),
  "Figtree-Bold": require("../../assets/fonts/Figtree-Bold.ttf"),
  "IBMPlexSans-Regular": require("../../assets/fonts/IBMPlexSans-Regular.ttf"),
  "IBMPlexSans-Medium": require("../../assets/fonts/IBMPlexSans-Medium.ttf"),
  "IBMPlexSans-SemiBold": require("../../assets/fonts/IBMPlexSans-SemiBold.ttf"),
} as const;

/**
 * Nombre de la fuente cargada por familia y peso. En Android cada peso es su propia familia.
 * Figtree para títulos y textos; IBM Plex Sans para las cifras (`mono` conserva su nombre: es la familia de
 * los números, y los dígitos de Plex son tabulares de fábrica, todos de 0.6em).
 */
export const fontFace = {
  display: { 600: "Figtree-SemiBold", 700: "Figtree-Bold" },
  sans: { 400: "Figtree-Regular", 500: "Figtree-Medium", 600: "Figtree-SemiBold" },
  mono: { 400: "IBMPlexSans-Regular", 500: "IBMPlexSans-Medium", 600: "IBMPlexSans-SemiBold" },
} as const;

export const typography = {
  families: {
    heading: "Figtree",
    body: "Figtree",
    numeric: "IBMPlexSans",
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
  "display-xl": { fontFamily: fontFace.display[700], fontSize: 40, lineHeight: 42, letterSpacing: -1.2 },
  "display-lg": { fontFamily: fontFace.display[700], fontSize: 30, lineHeight: 34, letterSpacing: -0.8 },
  title: { fontFamily: fontFace.display[600], fontSize: 22, lineHeight: 27, letterSpacing: -0.4 },
  "section-title": { fontFamily: fontFace.display[600], fontSize: 20, lineHeight: 25, letterSpacing: -0.4 },
  // sans
  heading: { fontFamily: fontFace.sans[600], fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fontFace.sans[400], fontSize: 15, lineHeight: 22 },
  "body-strong": { fontFamily: fontFace.sans[600], fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fontFace.sans[500], fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFace.sans[400], fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: fontFace.sans[600], fontSize: 11, lineHeight: 14, letterSpacing: 1.4, textTransform: "uppercase" },
  // cifras (IBM Plex Sans)
  "amount-input": { fontFamily: fontFace.mono[600], fontSize: 64, lineHeight: 68, letterSpacing: -1.6, fontVariant: tabular },
  "amount-hero": { fontFamily: fontFace.mono[600], fontSize: 48, lineHeight: 52, letterSpacing: -1.2, fontVariant: tabular },
  "amount-hero-cents": { fontFamily: fontFace.mono[600], fontSize: 26, lineHeight: 30, letterSpacing: -0.4, fontVariant: tabular },
  "amount-lg": { fontFamily: fontFace.mono[500], fontSize: 22, lineHeight: 26, letterSpacing: -0.4, fontVariant: tabular },
  amount: { fontFamily: fontFace.mono[500], fontSize: 15, lineHeight: 20, fontVariant: tabular },
  "amount-sm": { fontFamily: fontFace.mono[500], fontSize: 13, lineHeight: 18, fontVariant: tabular },
  "figure-caption": { fontFamily: fontFace.mono[400], fontSize: 11, lineHeight: 14, fontVariant: tabular },
} satisfies Record<string, TextStyle>;

export type TextStyleName = keyof typeof textStyles;
