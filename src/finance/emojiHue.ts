import { Skia } from "@shopify/react-native-skia";
import { File, Paths } from "expo-file-system";
import { useEffect, useState } from "react";
import { InteractionManager, Platform } from "react-native";
import { categoryHue, dominantHue, EMOJI_HUE_CANVAS as SIZE } from "./categoryTint";

const CACHE_FILE = "category-hues.v1.json";
const platformKey = `${Platform.OS}:${String(Platform.Version)}`;

const memory = new Map<string, number | null>();
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function keyOf(emoji: string) {
  return `${platformKey}:${emoji}`;
}

function cacheFile() {
  return new File(Paths.document, CACHE_FILE);
}

function loadCache() {
  if (loaded) return;
  loaded = true;
  try {
    const file = cacheFile();
    if (!file.exists) return;
    const data = JSON.parse(file.textSync()) as Record<string, number | null>;
    for (const [k, v] of Object.entries(data)) if (k.startsWith(`${platformKey}:`)) memory.set(k, v);
  } catch {
    return;
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      cacheFile().write(JSON.stringify(Object.fromEntries(memory)));
    } catch {
      return;
    }
  }, 500);
}

export function measureEmojiHue(emoji: string): number | null {
  const surface = Skia.Surface.Make(SIZE, SIZE);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color("transparent"));

  const paragraph = Skia.ParagraphBuilder.Make({ textStyle: { fontSize: SIZE * 0.8 } }).addText(emoji).build();
  paragraph.layout(SIZE);
  paragraph.paint(canvas, (SIZE - paragraph.getMaxIntrinsicWidth()) / 2, (SIZE - paragraph.getHeight()) / 2);
  surface.flush();

  const image = surface.makeImageSnapshot();
  const pixels = image.readPixels();
  image.dispose();
  paragraph.dispose();
  surface.dispose();
  if (!pixels || !(pixels instanceof Uint8Array)) return null;
  return dominantHue(pixels);
}

export function categoryHueSync(emoji: string | null | undefined, name: string): number {
  loadCache();
  const key = emoji?.trim();
  if (key) {
    const measured = memory.get(keyOf(key));
    if (typeof measured === "number") return measured;
  }
  return categoryHue(emoji, name);
}

function measureAndStore(emoji: string): number | null {
  const k = keyOf(emoji);
  if (memory.has(k)) return memory.get(k) ?? null;
  let hue: number | null = null;
  try {
    hue = measureEmojiHue(emoji);
  } catch {
    hue = null;
  }
  memory.set(k, hue);
  scheduleSave();
  return hue;
}

export function warmCategoryHues(emojis: ReadonlyArray<string | null | undefined>) {
  loadCache();
  const pending = [...new Set(emojis.map((e) => e?.trim()).filter((e): e is string => Boolean(e)))].filter(
    (e) => !memory.has(keyOf(e)),
  );
  if (pending.length === 0) return;
  InteractionManager.runAfterInteractions(() => {
    for (const e of pending) measureAndStore(e);
  });
}

export function useCategoryHue(emoji: string | null | undefined, name: string): number {
  const [hue, setHue] = useState(() => categoryHueSync(emoji, name));
  useEffect(() => {
    const key = emoji?.trim();
    setHue(categoryHueSync(emoji, name));
    if (!key || memory.has(keyOf(key))) return;
    const task = InteractionManager.runAfterInteractions(() => {
      const measured = measureAndStore(key);
      if (typeof measured === "number") setHue(measured);
    });
    return () => task.cancel();
  }, [emoji, name]);
  return hue;
}
