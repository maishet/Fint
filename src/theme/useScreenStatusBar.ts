import { useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback } from "react";
import { useThemeMode } from "./ThemeMode";

/**
 * Fija los iconos de la barra de estado cuando la pantalla toma el foco. Sin
 * `style`, van según el tema (oscuros sobre `canvas` en claro, claros en
 * oscuro); el Inicio y el login piden `"light"` por su fondo oscuro.
 *
 * No se restablece nada al perder el foco: al navegar, el foco de la pantalla
 * nueva puede correr antes que la limpieza de la anterior, y esa limpieza
 * dejaba iconos blancos sobre fondo claro (p. ej. Movimientos → Por revisar).
 * Como cada pantalla fija el suyo, el orden deja de importar.
 */
export function useScreenStatusBar(style?: "light" | "dark") {
  const { themeMode } = useThemeMode();
  const resolved = style ?? (themeMode === "dark" ? "light" : "dark");
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(resolved);
    }, [resolved]),
  );
}
