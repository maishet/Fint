import * as Device from "expo-device";
import { Platform } from "react-native";
import { financeApi } from "../api/finance";
import { getInstallationId } from "../notifications/pushNotifications";

/** "Galaxy A54": el nombre del teléfono en Android (el del sistema, o el modelo); en iOS, el modelo ("iPhone 15"). */
function deviceName(): string | null {
  const name = Platform.OS === "android" ? (Device.deviceName ?? Device.modelName) : Device.modelName;
  return name ? name.trim().slice(0, 80) || null : null;
}

/**
 * Le cuenta al backend que este dispositivo usa la cuenta (`POST /api/me/devices`). Con `signIn`, además, que se acaba
 * de iniciar sesión: si el dispositivo es nuevo y la persona usa Fint en otro, queda el aviso "Nuevo inicio de sesión".
 * Con el backend anterior (404) no pasa nada.
 */
export async function reportDevice(signIn: boolean) {
  if (!Device.isDevice) return;
  const installationId = await getInstallationId();
  await financeApi.reportDevice({ installationId, platform: Platform.OS === "ios" ? "ios" : "android", deviceName: deviceName(), signIn });
}
