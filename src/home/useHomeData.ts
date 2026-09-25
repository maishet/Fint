import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { financeApi } from "../api/finance";
import { buildAttention, nextDue } from "./attention";
import { buildSpendingSeries, spendingRange } from "./spending";

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

export function useHomeData(selectedAccount: { id: string; name: string } | null) {
  const overviewQuery = useQuery(dashboardOverviewQuery);
  const currency = overviewQuery.data?.currency;

  const accountsQuery = useQuery({
    queryKey: ["accounts", "overview", currency ?? ""],
    queryFn: ({ signal }) => financeApi.getAccountsOverview(currency, signal),
    enabled: Boolean(currency),
  });

  const occurrencesQuery = useQuery({
    queryKey: ["payment-occurrences", "open"],
    queryFn: ({ signal }) => financeApi.listPaymentOccurrences({ status: "open" }, signal),
  });

  const pendingQuery = useQuery({
    queryKey: ["pending-movements", "summary"],
    queryFn: () => financeApi.getPendingMovementsSummary(),
  });

  const range = spendingRange();
  const spendingTxQuery = useQuery({
    queryKey: ["dashboard", "spending-series", range.from, range.to],
    queryFn: () => financeApi.listAllTransactions({ from: range.from, to: range.to, type: "expense" }),
    staleTime: 60_000,
  });

  const categoriesQuery = useQuery({
    queryKey: ["dashboard", "expense-categories", currency, selectedAccount?.id ?? null],
    queryFn: ({ signal }) =>
      financeApi.getDashboardExpenseCategories(
        { currency: currency!, ...(selectedAccount ? { accountId: selectedAccount.id } : {}) },
        signal,
      ),
    enabled: Boolean(currency),
  });

  const attention = useMemo(
    () => buildAttention(occurrencesQuery.data ?? [], pendingQuery.data?.count ?? 0),
    [occurrencesQuery.data, pendingQuery.data?.count],
  );
  const upcoming = useMemo(() => nextDue(occurrencesQuery.data ?? []), [occurrencesQuery.data]);

  const spending = useMemo(
    () =>
      currency && spendingTxQuery.data
        ? buildSpendingSeries(spendingTxQuery.data, { currency, account: selectedAccount?.name ?? null })
        : null,
    [currency, selectedAccount?.name, spendingTxQuery.data],
  );

  const refetchAll = () =>
    Promise.all([
      overviewQuery.refetch(),
      accountsQuery.refetch(),
      occurrencesQuery.refetch(),
      pendingQuery.refetch(),
      spendingTxQuery.refetch(),
      categoriesQuery.refetch(),
    ]);

  return {
    overview: overviewQuery.data,
    accounts: accountsQuery.data?.items ?? [],
    attention,
    upcoming,
    spending,
    categories: categoriesQuery.data?.categories ?? [],
    isLoading: overviewQuery.isLoading,
    isSpendingLoading: spendingTxQuery.isLoading || categoriesQuery.isLoading,
    isRefreshing:
      overviewQuery.isRefetching || accountsQuery.isRefetching || occurrencesQuery.isRefetching || spendingTxQuery.isRefetching,
    error: overviewQuery.error,
    refetchAll,
  };
}
