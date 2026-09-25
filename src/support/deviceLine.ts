import * as Device from "expo-device";
import { Platform } from "react-native";

/**
 * "Android 14 · SM-A546E": el sistema y el modelo del teléfono para el reporte
 * de soporte. Va en `diagnostics.platform` porque el backend solo guarda los
 * campos que conoce (y ese llega al correo como "Plataforma"). Aparte de
 * `diagnostics.ts` para que los tests no carguen `expo-device`.
 */
export function deviceLine(): string {
  const os = Device.osName ?? (Platform.OS === "ios" ? "iOS" : "Android");
  const version = Device.osVersion ?? String(Platform.Version);
  const model = Device.modelName;
  return [`${os} ${version}`.trim(), model].filter(Boolean).join(" · ").slice(0, 80);
}
