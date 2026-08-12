import { useMemo } from "react";
import { Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { toast } from "sonner-native";

/**
 * Capa desacoplada sobre `sonner-native`.
 *
 * El objetivo es que los call sites NO dependan directamente de la librería:
 * si en el futuro se cambia de motor de notificaciones, solo se toca este
 * archivo. Por eso se conserva la firma `show(title, opts)` que ya usaba el
 * sistema anterior (`@tamagui/toast`), de modo que la migración sea mecánica.
 */

export type NotifyPreset = "success" | "error" | "info";

export type NotifyAction = {
  label: string;
  onPress: () => void;
};

export type NotifyOptions = {
  message?: string;
  preset?: NotifyPreset;
  duration?: number;
  /** Botón de acción del toast (p. ej. "Deshacer"). */
  action?: NotifyAction;
  /**
   * Texto largo opcional (p. ej. el stack/mensaje crudo de un error). Cuando se
   * define, el toast muestra un botón que lo abre completo en un diálogo, en
   * vez de recortarlo con "...". `detailLabel` es la etiqueta del botón (i18n).
   */
  detail?: string;
  detailLabel?: string;
};

function triggerHaptic(preset?: NotifyPreset) {
  if (Platform.OS === "web") return;
  try {
    if (preset === "success") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (preset === "error") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  } catch {
    // Dispositivo sin motor háptico: ignorar.
  }
}

function toSonnerAction(action?: NotifyAction) {
  if (!action) return undefined;
  return { label: action.label, onClick: action.onPress };
}

/**
 * Resuelve la acción del toast. Prioriza una acción explícita; si no hay pero
 * se pasó `detail`, genera un botón "Ver detalle" que abre el texto completo.
 */
function resolveAction(opts: NotifyOptions) {
  if (opts.action) return toSonnerAction(opts.action);
  if (opts.detail && opts.detailLabel) {
    const title = opts.detailLabel;
    const body = opts.detail;
    return { label: opts.detailLabel, onClick: () => Alert.alert(title, body) };
  }
  return undefined;
}

function notifyWithPreset(
  preset: NotifyPreset,
  title: string,
  opts: NotifyOptions = {},
) {
  triggerHaptic(preset);
  const data = {
    description: opts.message,
    duration: opts.duration,
    action: resolveAction(opts),
  };
  if (preset === "success") return toast.success(title, data);
  if (preset === "error") return toast.error(title, data);
  return toast.info(title, data);
}

export type PromiseMessages<T> = {
  loading: string;
  success: string | ((result: T) => string);
  error: string | ((error: unknown) => string);
};

export const notify = {
  /**
   * Compatible con la firma del toast anterior:
   * `show(title, { message, preset, duration, action })`.
   */
  show(title: string, opts: NotifyOptions = {}) {
    return notifyWithPreset(opts.preset ?? "info", title, opts);
  },
  success(title: string, opts: NotifyOptions = {}) {
    return notifyWithPreset("success", title, opts);
  },
  error(title: string, opts: NotifyOptions = {}) {
    return notifyWithPreset("error", title, opts);
  },
  info(title: string, opts: NotifyOptions = {}) {
    return notifyWithPreset("info", title, opts);
  },
  /**
   * Toast de proceso: muestra `loading` mientras la promesa está pendiente y
   * muta a éxito/error según el resultado. Ideal para guardar/enviar/sincronizar.
   */
  promise<T>(promise: Promise<T>, messages: PromiseMessages<T>) {
    return toast.promise(promise, {
      loading: messages.loading,
      success: (result: T) =>
        typeof messages.success === "function"
          ? messages.success(result)
          : messages.success,
      error: (err: unknown) =>
        typeof messages.error === "function" ? messages.error(err) : messages.error,
    });
  },
  dismiss(id?: string | number) {
    return toast.dismiss(id);
  },
};

export type NotifyController = typeof notify;

/**
 * Hook de conveniencia para minimizar el diff en la migración: los call sites
 * pasan de `const toast = useToastController()` a `const toast = useNotify()`
 * sin tocar las llamadas `toast.show(...)`.
 */
export function useNotify(): NotifyController {
  return useMemo(() => notify, []);
}
