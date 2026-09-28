import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useCapabilities } from "../api/capabilities";
import { financeApi } from "../api/finance";
import { useAuth } from "../auth/AuthProvider";
import { randomId } from "../shared/id";
import { notify } from "../ui/notify";
import { upsertSavedPlace, type SavedPlace } from "./places";

/**
 * Los lugares con nombre ("Casa", "Trabajo") viven en el servidor (`/api/me/places`), así pasan a otro teléfono. Con el
 * backend anterior siguen en el dispositivo, por persona. Se reconocen a menos de 50 m (`findSavedPlace`).
 */
function storageKey(userId: string) {
  return `fint-saved-places-${userId}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readDevicePlaces(userId: string): Promise<SavedPlace[]> {
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

/**
 * Los lugares del servidor. La primera vez sube los que quedaron en el teléfono (del más viejo al más nuevo, para que
 * el servidor aplique las mismas reglas) y los borra de ahí; si algo falla, quedan para el próximo intento.
 */
async function loadServerPlaces(userId: string): Promise<SavedPlace[]> {
  const onDevice = await readDevicePlaces(userId);
  if (onDevice.length) {
    // Los ids viejos eran `Date.now()`; el servidor pide uuid.
    for (const place of [...onDevice].reverse()) await financeApi.saveSavedPlace({ ...place, kind: place.kind ?? "other", id: UUID.test(place.id) ? place.id : randomId() });
    await SecureStore.deleteItemAsync(storageKey(userId));
  }
  return financeApi.listSavedPlaces();
}

export function useSavedPlaces() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { capabilities } = useCapabilities();
  const onServer = capabilities.features.savedPlaces === true;
  const queryClient = useQueryClient();
  const key = useMemo(() => ["saved-places", userId, onServer ? "server" : "device"] as const, [userId, onServer]);
  const query = useQuery({
    queryKey: key,
    queryFn: () => (!userId ? Promise.resolve([]) : onServer ? loadServerPlaces(userId) : readDevicePlaces(userId)),
    staleTime: onServer ? 5 * 60_000 : Infinity,
  });

  /** Aplica el cambio al instante y lo guarda; si el servidor falla, vuelve atrás y avisa. */
  const apply = useCallback(
    async (next: SavedPlace[], persist: () => Promise<SavedPlace[] | void>) => {
      if (!userId) return;
      const previous = queryClient.getQueryData<SavedPlace[]>(key);
      queryClient.setQueryData(key, next);
      try {
        const confirmed = await persist();
        if (confirmed) queryClient.setQueryData(key, confirmed);
      } catch {
        queryClient.setQueryData(key, previous);
        notify.error(t("movementForm.locationSheet.placeError"));
      }
    },
    [key, queryClient, userId, t],
  );

  const save = useCallback(
    (place: SavedPlace) => {
      const next = upsertSavedPlace(query.data ?? [], place);
      return apply(next, () =>
        onServer ? financeApi.saveSavedPlace(place) : SecureStore.setItemAsync(storageKey(userId!), JSON.stringify(next)),
      );
    },
    [apply, onServer, query.data, userId],
  );

  const remove = useCallback(
    (id: string) => {
      const next = (query.data ?? []).filter((p) => p.id !== id);
      return apply(next, () =>
        onServer ? financeApi.deleteSavedPlace(id) : SecureStore.setItemAsync(storageKey(userId!), JSON.stringify(next)),
      );
    },
    [apply, onServer, query.data, userId],
  );

  return { places: query.data ?? [], save, remove };
}
