import * as Sentry from "@sentry/react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { Dimensions, Platform } from "react-native";

const LARGE_SCREEN_MIN_DP = 600;

export function isCompactScreen(): boolean {
  const { width, height } = Dimensions.get("screen");
  return Math.min(width, height) < LARGE_SCREEN_MIN_DP;
}

let locked: boolean | null = null;

async function applyOrientationPolicy(): Promise<void> {
  const shouldLock = isCompactScreen();
  if (shouldLock === locked) return;
  const wasLocked = locked;
  locked = shouldLock;
  if (!shouldLock && wasLocked === null) return;
  try {
    if (shouldLock) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } else {
      await ScreenOrientation.unlockAsync();
    }
  } catch (error) {
    Sentry.captureException(error, { tags: { operation: "lock_phone_orientation" } });
  }
}

export function lockPhoneOrientation(): () => void {
  if (Platform.OS !== "android") return () => {};
  void applyOrientationPolicy();
  const subscription = Dimensions.addEventListener("change", () => {
    void applyOrientationPolicy();
  });
  return () => subscription.remove();
}
