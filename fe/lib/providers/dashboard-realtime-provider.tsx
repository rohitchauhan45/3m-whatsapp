'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { getRealtimeServerUrl } from '@/lib/api/client';
import { queryKeys } from '@/lib/query-keys';

const DASHBOARD_UPDATED_EVENT = 'DASHBOARD_UPDATED';

export default function DashboardRealtimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socketUrl = getRealtimeServerUrl();
    if (!socketUrl) return;

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    const refreshDashboard = () => {
      void queryClient.refetchQueries({
        queryKey: queryKeys.dashboard.root,
        type: 'active',
      });
      void queryClient.refetchQueries({
        queryKey: queryKeys.adminTasks,
        type: 'active',
      });
    };

    socket.on(DASHBOARD_UPDATED_EVENT, refreshDashboard);

    return () => {
      socket.off(DASHBOARD_UPDATED_EVENT, refreshDashboard);
      socket.disconnect();
    };
  }, [queryClient]);

  return children;
}
