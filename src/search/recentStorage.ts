import * as SecureStore from "expo-secure-store";
import { MAX_RECENT } from "./logic";

/** Las búsquedas recientes viven en el dispositivo, por persona (no en el backend). */
function storageKey(userId: string) {
  return `fint-search-recent-${userId}`;
}

export async function getRecentSearches(userId: string): Promise<string[]> {
  try {
    const value = await SecureStore.getItemAsync(storageKey(userId));
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export async function storeRecentSearches(userId: string, recent: readonly string[]) {
  await SecureStore.setItemAsync(storageKey(userId), JSON.stringify(recent.slice(0, MAX_RECENT)));
}
