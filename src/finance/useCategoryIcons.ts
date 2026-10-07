import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { financeApi } from "../api/finance";
import type { MovementKind } from "../api/types";

/**
 * El emoji que la persona eligió para cada categoría, para pintarlo en las
 * filas de movimientos. Los movimientos solo traen el nombre de la categoría,
 * así que se cruza con la lista de categorías (la misma consulta que usa la
 * pantalla de Categorías, así se comparte la caché).
 */
export function useCategoryIcons() {
  const query = useQuery({ queryKey: ["categories"], queryFn: () => financeApi.listCategories(), staleTime: 5 * 60_000 });

  const byKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of query.data ?? []) {
      if (!c.icon) continue;
      const name = c.name.trim().toLowerCase();
      map.set(`${c.type}:${name}`, c.icon);
      if (!map.has(`*:${name}`)) map.set(`*:${name}`, c.icon);
    }
    return map;
  }, [query.data]);

  return useCallback(
    (category: string, type?: MovementKind): string | null => {
      const name = category.trim().toLowerCase();
      return byKey.get(`${type}:${name}`) ?? byKey.get(`*:${name}`) ?? null;
    },
    [byKey],
  );
}
