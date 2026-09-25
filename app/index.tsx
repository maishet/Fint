import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { YStack } from "tamagui";
import { ApiRequestError } from "../src/api/client";
import { financeApi } from "../src/api/finance";
import { useAuth } from "../src/auth/AuthProvider";
import { getInitialRoute } from "../src/auth/initial-route";
import { DataStateCard } from "../src/components/DataStateCard";
import { dashboardOverviewQuery } from "../src/home/useHomeData";
import { FintLoadingScreen } from "../src/ui";

/**
 * Arranque (y vuelta del login): la pantalla de carga sobre la losa con la
 * etapa real que se espera: la sesión, el perfil y, si va al Inicio, su
 * resumen. Así el Inicio abre con el saldo ya puesto. Con todo en caché la
 * espera dura menos de 400 ms y no se ve nada.
 */
export default function IndexScreen() {
  const { t } = useTranslation();
  const { isLoading, session } = useAuth();
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: financeApi.getMe,
    enabled: !!session,  });
  const isUnauthorized =
    meQuery.error instanceof ApiRequestError && meQuery.error.status === 401;
  const goesHome = !!session && !isUnauthorized && meQuery.data?.setupComplete === true;
  // Misma clave y consulta que el Inicio: lo que se trae aquí, el Inicio lo lee de la caché.
  const overviewQuery = useQuery({ ...dashboardOverviewQuery, enabled: goesHome });
  const [done, setDone] = useState(false);

  const waitingSession = isLoading;
  const waitingProfile = !!session && meQuery.isLoading;
  const waitingSummary = goesHome && overviewQuery.isLoading;

  if (meQuery.error && !isUnauthorized) {
    return (
      <YStack flex={1} items="center" justify="center" bg="$background" p="$4">
        <DataStateCard
          message={t("states.profileLoadError")}
          onRetry={() => {
            void meQuery.refetch();
          }}
        />
      </YStack>
    );
  }

  const stage = waitingSession
    ? t("loadingScreen.session")
    : waitingProfile || !goesHome
      ? t("loadingScreen.accounts")
      : t("loadingScreen.summary");
  const retry = waitingProfile ? () => void meQuery.refetch() : waitingSummary ? () => void overviewQuery.refetch() : undefined;

  // Al terminar, la pantalla de carga (ya sin logo: la malla y "My Fint") se queda debajo mientras monta el destino.
  return (
    <>
      <FintLoadingScreen
        surface="slab"
        startComplete
        stage={stage}
        ready={!waitingSession && !waitingProfile && !waitingSummary}
        onDone={() => setDone(true)}
        onRetry={retry}
      />
      {done ? <Redirect href={getInitialRoute(Boolean(session), isUnauthorized, meQuery.data?.setupComplete) as never} /> : null}
    </>
  );
}
