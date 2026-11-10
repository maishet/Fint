import { Canvas, Group, Skia, Skottie } from "@shopify/react-native-skia";
import { useEffect, useMemo, useState } from "react";
import {
  Easing,
  ReduceMotion,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useThemeMode } from "../theme/ThemeMode";
import { fintPalette } from "../theme/palette";

const sources = {
  "coin-drop": require("../../assets/lottie/coin-drop.json"),
  "coin-stack": require("../../assets/lottie/coin-stack.json"),
  "coin-pull": require("../../assets/lottie/coin-pull.json"),
} as const;

export type LottieName = keyof typeof sources;

type Entry = { file: string; segments: Record<string, number[]>; slots: Record<string, string> };

const manifest = require("../../assets/lottie/manifest.json") as { fps: number; animations: Record<LottieName, Entry> };
const animations = manifest.animations;

export interface FintLottieProps {
  name: LottieName;
  size: number;
  play?: string[];
  loop?: string;
  delay?: number;
  frame?: SharedValue<number>;
}

export function FintLottie({ name, size, play = [], loop, delay = 0, frame: driven }: FintLottieProps) {
  const [ready, setReady] = useState(false);
  const surface = useSharedValue({ width: 0, height: 0 });
  useAnimatedReaction(
    () => surface.value.width > 0,
    (has, had) => {
      if (has && !had) runOnJS(setReady)(true);
    },
  );
  const { themeMode } = useThemeMode();
  const reduceMotion = useReducedMotion();
  const entry = animations[name];

  const animation = useMemo(() => {
    const made = Skia.Skottie.Make(JSON.stringify(sources[name]));
    const palette = fintPalette[themeMode] as unknown as Record<string, string>;
    for (const [slot, token] of Object.entries(entry.slots)) {
      const color = palette[token];
      if (color) made.setColorSlot(slot, Skia.Color(color));
    }
    return made;
  }, [name, entry, themeMode]);

  const segments = play.map((id) => entry.segments[id]).filter(Boolean);
  const loopSegment = loop ? entry.segments[loop] : undefined;
  const still = loopSegment ? loopSegment[0] : (segments.at(-1)?.[1] ?? 0);
  const frame = useSharedValue(reduceMotion ? still : (segments[0]?.[0] ?? still));
  const key = `${name}:${play.join(",")}:${loop ?? ""}`;

  useEffect(() => {
    if (!ready || driven) return;
    if (reduceMotion) {
      frame.value = still;
      return;
    }
    const fps = manifest.fps;
    const run = (from: number, to: number) =>
      withTiming(to, { duration: ((to - from) / fps) * 1000, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    const steps = segments.flatMap(([from, to]) => [withTiming(from, { duration: 0 }), run(from, to)]);
    if (loopSegment && loopSegment[1] > loopSegment[0]) {
      steps.push(withRepeat(withSequence(withTiming(loopSegment[0], { duration: 0 }), run(loopSegment[0], loopSegment[1])), -1));
    }
    if (steps.length) frame.value = withDelay(delay, withSequence(...steps));
    else frame.value = still;
    return () => cancelAnimation(frame);
  }, [key, reduceMotion, ready]);

  const scale = size / animation.size().width;

  return (
    <Canvas style={{ width: size, height: size }} onSize={surface} androidWarmup accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Group transform={[{ scale }]}>
        <Skottie animation={animation} frame={driven ?? frame} />
      </Group>
    </Canvas>
  );
}
