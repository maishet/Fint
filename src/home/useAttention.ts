import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { financeApi } from "../api/finance";
import { isComingSoon } from "../config/comingSoon";
import { gmailSummary } from "../settings/logic";
import { buildAttention, nextDue } from "./attention";

/**
 * Lo que la persona tiene por hacer: pagos vencidos y por vencer, movimientos por revisar y Gmail si dejó de
 * sincronizar. Lo comparten los avisos del Inicio, el número de la campana y la pantalla Avisos (su "Por hacer").
 */
export function useAttention() {
  const occurrencesQuery = useQuery({
    queryKey: ["payment-occurrences", "open"],
    queryFn: ({ signal }) => financeApi.listPaymentOccurrences({ status: "open" }, signal),
  });
  const pendingQuery = useQuery({
    queryKey: ["pending-movements", "summary"],
    queryFn: () => financeApi.getPendingMovementsSummary(),
  });
  const sourcesQuery = useQuery({ queryKey: ["gmail-sources"], queryFn: financeApi.listGmailSources });

  // Con Gmail en "Pronto" no hay a dónde mandar a reconectar: el aviso no sale.
  const gmailDown = !isComingSoon("gmail") && sourcesQuery.data ? gmailSummary(sourcesQuery.data).state === "reconnect" : false;
  const items = useMemo(
    () => buildAttention(occurrencesQuery.data ?? [], pendingQuery.data?.count ?? 0, new Date(), gmailDown),
    [occurrencesQuery.data, pendingQuery.data?.count, gmailDown],
  );
  const upcoming = useMemo(() => nextDue(occurrencesQuery.data ?? []), [occurrencesQuery.data]);

  return {
    items,
    upcoming,
    occurrences: occurrencesQuery.data ?? [],
    isLoading: occurrencesQuery.isLoading || pendingQuery.isLoading,
    isRefetching: occurrencesQuery.isRefetching || pendingQuery.isRefetching || sourcesQuery.isRefetching,
    error: occurrencesQuery.error ?? pendingQuery.error,
    refetch: () => Promise.all([occurrencesQuery.refetch(), pendingQuery.refetch(), sourcesQuery.refetch()]),
  };
}
