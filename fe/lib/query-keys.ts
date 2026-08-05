import type { QueryClient } from '@tanstack/react-query';
import type { TimeRange } from '@/lib/services/dashboardService';

export const queryKeys = {
  adminTasks: ['admin-tasks'] as const,
  draftTasks: ['draft-tasks'] as const,
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
  sites: ['sites'] as const,
  siteDetail: (siteId: string) => ['sites', siteId] as const,
  siteAssignableUsers: (siteId: string) => ['sites', siteId, 'assignable-users'] as const,
} as const;

export function invalidateDashboardQueries(queryClient: QueryClient) {
  return queryClient.refetchQueries({
    queryKey: queryKeys.dashboard.root,
    type: 'active',
  });
}

export function invalidateAdminTasks(queryClient: QueryClient) {
  return queryClient.refetchQueries({
    queryKey: queryKeys.adminTasks,
    type: 'active',
  });
}

export function invalidateDraftTasks(queryClient: QueryClient) {
  return queryClient.refetchQueries({
    queryKey: queryKeys.draftTasks,
    type: 'active',
  });
}
