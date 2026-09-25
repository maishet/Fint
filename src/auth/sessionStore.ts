import type { Session } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";

/**
 * La sesión actual fuera del contexto de React. `AuthProvider` la publica aquí;
 * sirve a lo que se dibuja dentro de un portal (las hojas de Tamagui se montan
 * fuera de `AuthProvider`, así que `useAuth` falla ahí), como el pin del mapa.
 */
let current: Session | null = null;
const listeners = new Set<() => void>();

export function publishSession(session: Session | null) {
  if (session === current) return;
  current = session;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCurrentSession() {
  return useSyncExternalStore(subscribe, () => current);
}
