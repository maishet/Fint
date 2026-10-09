import * as Sentry from "@sentry/react-native";
import * as Device from "expo-device";
import * as ScreenOrientation from "expo-screen-orientation";
import { Platform } from "react-native";

export async function lockPhoneOrientation(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (Device.deviceType !== Device.DeviceType.PHONE) return;
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  } catch (error) {
    Sentry.captureException(error, { tags: { operation: "lock_phone_orientation" } });
  }
}
