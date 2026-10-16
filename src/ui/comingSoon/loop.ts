import { useEffect } from "react";
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

export const LOOP_MS = 5200;
export const SHOWCASE = 0.86;

export function useLoop(active: boolean) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(SHOWCASE);
  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(progress);
      progress.value = SHOWCASE;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(progress);
  }, [active, reduceMotion, progress]);
  return progress;
}

export function stage(p: number, from: number, to: number) {
  "worklet";
  const x = Math.min(1, Math.max(0, (p - from) / (to - from)));
  return 1 - Math.pow(1 - x, 3);
}

export function fadeOut(p: number) {
  "worklet";
  return 1 - stage(p, 0.93, 1);
}

interface RevealOptions {
  x?: number;
  y?: number;
  scale?: number;
}

export function useReveal(p: SharedValue<number>, from: number, to: number, { x = 0, y = 0, scale = 1 }: RevealOptions = {}) {
  return useAnimatedStyle(() => {
    const k = stage(p.value, from, to);
    return {
      opacity: k * fadeOut(p.value),
      transform: [{ translateX: (1 - k) * x }, { translateY: (1 - k) * y }, { scale: scale + (1 - scale) * k }],
    };
  });
}
