import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useCapabilities } from "../api/capabilities";
import { financeApi } from "../api/finance";
import { notify } from "../ui/notify";
import { DEFAULT_HOME_LAYOUT, normalizeHomeLayout, type HomeLayout } from "./layout";

export const HOME_LAYOUT_KEY = ["home-layout"] as const;

/**
 * El orden y la visibilidad de las secciones del Inicio (`/api/me/home-layout`). La caché de React Query se guarda en
 * el teléfono, así que al abrir la app el Inicio ya sale en el orden de la persona. Con el backend anterior no hay
 * "Personalizar inicio" (`available` en `false`) y el Inicio va en el orden de siempre.
 */
export function useHomeLayout() {
  const { t } = useTranslation();
  const { capabilities } = useCapabilities();
  const available = capabilities.features.homeLayout === true;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: HOME_LAYOUT_KEY,
    queryFn: async () => normalizeHomeLayout(await financeApi.getHomeLayout()),
    enabled: available,
    staleTime: 5 * 60_000,
  });

  /** Se ve al instante; si el servidor falla, vuelve atrás y avisa. */
  const save = useCallback(
    async (next: HomeLayout) => {
      const previous = queryClient.getQueryData<HomeLayout>(HOME_LAYOUT_KEY);
      queryClient.setQueryData(HOME_LAYOUT_KEY, next);
      try {
        queryClient.setQueryData(HOME_LAYOUT_KEY, normalizeHomeLayout(await financeApi.saveHomeLayout(next)));
      } catch {
        queryClient.setQueryData(HOME_LAYOUT_KEY, previous);
        notify.error(t("home.customize.saveError"));
      }
    },
    [queryClient, t],
  );

  return { available, layout: available ? (query.data ?? DEFAULT_HOME_LAYOUT) : DEFAULT_HOME_LAYOUT, save };
}
