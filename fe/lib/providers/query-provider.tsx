'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { cachedQueryOptions } from '@/lib/query-config';
import DashboardRealtimeProvider from '@/lib/providers/dashboard-realtime-provider';

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            ...cachedQueryOptions,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DashboardRealtimeProvider>{children}</DashboardRealtimeProvider>
    </QueryClientProvider>
  );
}
