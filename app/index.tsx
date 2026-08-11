import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useTranslation } from "react-i18next";
import { YStack } from "tamagui";
import { ApiRequestError } from "../src/api/client";
import { financeApi } from "../src/api/finance";
import { useAuth } from "../src/auth/AuthProvider";
import { getInitialRoute } from "../src/auth/initial-route";
import { DataStateCard } from "../src/components/DataStateCard";
import { FintLoadingScreen } from "../src/ui";

export default function IndexScreen() {
  const { t } = useTranslation();
  const { isLoading, session } = useAuth();
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: financeApi.getMe,
    enabled: !!session,
    retry: false,
  });

  if (isLoading || (!!session && meQuery.isLoading)) {
    return <FintLoadingScreen />;
  }

  const isUnauthorized =
    meQuery.error instanceof ApiRequestError && meQuery.error.status === 401;
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

  return (
    <Redirect
      href={
        getInitialRoute(
          Boolean(session),
          isUnauthorized,
          meQuery.data?.setupComplete,
        ) as never
      }
    />
  );
}
