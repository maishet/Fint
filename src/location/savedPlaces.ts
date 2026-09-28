import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { useCallback } from "react";
import { useAuth } from "../auth/AuthProvider";
import { upsertSavedPlace, type SavedPlace } from "./places";

/**
 * Los lugares con nombre ("Casa", "Trabajo") viven en el dispositivo, por persona, hasta que exista `saved_places`
 * en el contrato v2. Se reconocen a menos de 50 m (`findSavedPlace`).
 */
function storageKey(userId: string) {
  return `fint-saved-places-${userId}`;
}

async function readSavedPlaces(userId: string): Promise<SavedPlace[]> {
  try {
    const value = await SecureStore.getItemAsync(storageKey(userId));
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (p): p is SavedPlace =>
            typeof p === "object" && p !== null && typeof p.id === "string" && typeof p.name === "string" && typeof p.latitude === "number" && typeof p.longitude === "number",
        )
      : [];
  } catch {
    return [];
  }
}

export function useSavedPlaces() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();
  const key = ["saved-places", userId] as const;
  const query = useQuery({ queryKey: key, queryFn: () => (userId ? readSavedPlaces(userId) : Promise.resolve([])), staleTime: Infinity });

  const write = useCallback(
    async (next: SavedPlace[]) => {
      if (!userId) return;
      queryClient.setQueryData(["saved-places", userId], next);
      await SecureStore.setItemAsync(storageKey(userId), JSON.stringify(next));
    },
    [queryClient, userId],
  );

  const save = useCallback((place: SavedPlace) => write(upsertSavedPlace(query.data ?? [], place)), [query.data, write]);
  const remove = useCallback((id: string) => write((query.data ?? []).filter((p) => p.id !== id)), [query.data, write]);

  return { places: query.data ?? [], save, remove };
}
