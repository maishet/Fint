import { useInfiniteQuery } from "@tanstack/react-query";
import { financeApi } from "../api/finance";
import { ApiRequestError } from "../api/client";
import { knownNotifications } from "./logic";

export const NOTIFICATIONS_KEY = ["me-notifications"] as const;

const unavailableError = (error: unknown) => error instanceof ApiRequestError && error.status === 404;

/**
 * Lo informativo de Avisos (`GET /api/me/notifications`), de a 30 con "Ver anteriores". Con un backend que todavía no
 * tiene el endpoint (404), `available` es `false`: la pantalla muestra solo "Por hacer", sin pestañas, como antes.
 */
export function useNotificationsFeed() {
  const query = useInfiniteQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: ({ pageParam, signal }) => financeApi.listNotifications({ cursor: pageParam, limit: 30 }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: (count, error) => !unavailableError(error) && count < 2,
    staleTime: 60_000,
  });
  const pages = query.data?.pages ?? [];
  return {
    available: query.isSuccess,
    unavailable: unavailableError(query.error),
    items: knownNotifications(pages.flatMap((page) => page.items)),
    unread: pages[0]?.unread ?? 0,
    isLoading: query.isLoading,
    hasMore: Boolean(query.hasNextPage),
    loadMore: () => void query.fetchNextPage(),
    loadingMore: query.isFetchingNextPage,
    refetch: query.refetch,
  };
}
