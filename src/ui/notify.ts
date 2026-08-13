import { useMemo } from "react";
import { Alert } from "react-native";
import { toast } from "sonner-native";
import { haptics } from "./haptics";

export type NotifyPreset = "success" | "error" | "info";

export type NotifyAction = {
  label: string;
  onPress: () => void;
};

export type NotifyOptions = {
  message?: string;
  preset?: NotifyPreset;
  duration?: number;
  action?: NotifyAction;
  detail?: string;
  detailLabel?: string;
};

function triggerHaptic(preset?: NotifyPreset) {
  if (preset === "success") haptics.success();
  else if (preset === "error") haptics.error();
}

function toSonnerAction(action?: NotifyAction) {
  if (!action) return undefined;
  return { label: action.label, onClick: action.onPress };
}

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

export function useNotify(): NotifyController {
  return useMemo(() => notify, []);
}
