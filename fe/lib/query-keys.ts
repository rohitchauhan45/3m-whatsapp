import type { QueryClient } from '@tanstack/react-query';
import type { TimeRange } from '@/lib/services/dashboardService';

export const queryKeys = {
  adminTasks: ['admin-tasks'] as const,
  cronjobs: ['cronjobs'] as const,
  dashboard: {
    root: ['dashboard'] as const,
    taskCards: (time: TimeRange) => ['dashboard', 'task-cards', time] as const,
    taskTable: (params: Record<string, unknown>) =>
      ['dashboard', 'task-table', params] as const,
    userCards: (time: TimeRange) => ['dashboard', 'user-cards', time] as const,
    userTable: (params: Record<string, unknown>) =>
      ['dashboard', 'user-table', params] as const,
  },
} as const;

export function invalidateDashboardQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.dashboard.root,
    refetchType: 'active',
  });
}

export function invalidateAdminTasks(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.adminTasks,
    refetchType: 'active',
  });
}
