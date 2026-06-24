/** Cached until a mutation invalidates the query — no refetch on focus/remount while fresh. */
export const cachedQueryOptions = {
  staleTime: Infinity,
  gcTime: 1000 * 60 * 30,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;
