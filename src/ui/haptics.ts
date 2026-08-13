import * as Haptics from "expo-haptics";

function run(fn: () => Promise<unknown>) {
  try {
    void fn();
  } catch {
    // Sin motor háptico: ignorar.
  }
}

export const haptics = {
  /** Toque ligero: presión de botones y controles. */
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Selección: cambio de opción/switch/tab. */
  select: () => run(() => Haptics.selectionAsync()),
  success: () =>
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () =>
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () =>
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
