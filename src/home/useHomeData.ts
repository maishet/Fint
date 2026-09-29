import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCapabilities } from "../api/capabilities";
import { financeApi } from "../api/finance";
import { buildSpendingSeries, spendingRange } from "./spending";
import { useAttention } from "./useAttention";

/**
 * Todo lo que pide el Inicio v3, armado con los endpoints que existen hoy.
 * Cuando el backend publique el resumen v2 (sección "Contrato con el backend"
 * del design system), cada bloque se reemplaza por su campo del resumen.
 *
 * Las claves de React Query cuelgan de "dashboard", "accounts",
 * "payment-occurrences" y "pending-movements", que las mutaciones de la app ya
 * invalidan: registrar o borrar un movimiento refresca el Inicio sin más.
 */
/** El resumen del Inicio; lo comparte la pantalla de arranque, que lo espera antes de pasar al Inicio. */
export const dashboardOverviewQuery = {
  queryKey: ["dashboard", "overview"] as const,
  queryFn: ({ signal }: { signal: AbortSignal }) => financeApi.getDashboardOverview(undefined, signal),
};

/** El tope que acepta el backend: en la práctica, todas. */
const ALL_CATEGORIES = 100;

export function useHomeData(selectedAccount: { id: string; name: string } | null) {
  const overviewQuery = useQuery(dashboardOverviewQuery);
  const currency = overviewQuery.data?.currency;

  const accountsQuery = useQuery({
    queryKey: ["accounts", "overview", currency ?? ""],
    queryFn: ({ signal }) => financeApi.getAccountsOverview(currency, signal),
    enabled: Boolean(currency),
  });

  const attention = useAttention();

  // La serie de Ritmo la calcula el backend nuevo (`/api/dashboard/spending`). Con el anterior, se arma aquí con los
  // movimientos de dos meses.
  const { capabilities } = useCapabilities();
  const serverSpending = capabilities.features.dashboardSpending === true;
  const spendingQuery = useQuery({
    queryKey: ["dashboard", "spending", currency, selectedAccount?.id ?? null],
    queryFn: ({ signal }) =>
      financeApi.getDashboardSpending({ currency: currency!, ...(selectedAccount ? { accountId: selectedAccount.id } : {}) }, signal),
    enabled: serverSpending && Boolean(currency),
  });
  const range = spendingRange();
  const spendingTxQuery = useQuery({
    queryKey: ["dashboard", "spending-series", range.from, range.to],
    queryFn: () => financeApi.listAllTransactions({ from: range.from, to: range.to, type: "expense" }),
    staleTime: 60_000,
    enabled: !serverSpending,
  });
  const seriesQuery = serverSpending ? spendingQuery : spendingTxQuery;

  // El backend nuevo devuelve todas las categorías (el anterior, solo las seis más grandes, y rechaza `limit`): la
  // tarjeta muestra las cuatro primeras y suma el resto en "Otros".
  const limit = capabilities.features.allExpenseCategories ? ALL_CATEGORIES : undefined;
  const categoriesQuery = useQuery({
    queryKey: ["dashboard", "expense-categories", currency, selectedAccount?.id ?? null, limit ?? null],
    queryFn: ({ signal }) =>
      financeApi.getDashboardExpenseCategories(
        { currency: currency!, ...(selectedAccount ? { accountId: selectedAccount.id } : {}), ...(limit ? { limit } : {}) },
        signal,
      ),
    enabled: Boolean(currency),
  });


  const spending = useMemo(() => {
    if (serverSpending) return spendingQuery.data ?? null;
    return currency && spendingTxQuery.data
      ? buildSpendingSeries(spendingTxQuery.data, { currency, account: selectedAccount?.name ?? null })
      : null;
  }, [serverSpending, spendingQuery.data, currency, selectedAccount?.name, spendingTxQuery.data]);

  const refetchAll = () =>
    Promise.all([
      overviewQuery.refetch(),
      accountsQuery.refetch(),
      attention.refetch(),
      seriesQuery.refetch(),
      categoriesQuery.refetch(),
    ]);

  return {
    overview: overviewQuery.data,
    accounts: accountsQuery.data?.items ?? [],
    attention: attention.items,
    upcoming: attention.upcoming,
    spending,
    categories: categoriesQuery.data?.categories ?? [],
    isLoading: overviewQuery.isLoading,
    isSpendingLoading: seriesQuery.isLoading || categoriesQuery.isLoading,
    isRefreshing:
      overviewQuery.isRefetching || accountsQuery.isRefetching || attention.isRefetching || seriesQuery.isRefetching,
    error: overviewQuery.error,
    refetchAll,
  };
}
