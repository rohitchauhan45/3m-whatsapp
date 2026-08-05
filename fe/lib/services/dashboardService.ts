import { apiClient } from '@/lib/api/client';

export type TimeRange =
  | 'today'
  | 'tomorrow'
  | 'yesterday'
  | 'thisweek'
  | 'lastweek'
  | 'thismonth'
  | 'lastmonth'
  | 'thisyear';

export const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisweek', label: 'This Week' },
  { value: 'lastweek', label: 'Last Week' },
  { value: 'thismonth', label: 'This Month' },
  { value: 'lastmonth', label: 'Last Month' },
  { value: 'thisyear', label: 'This Year' },
];

export interface TaskCardData {
  inProgress: number;
  delayedTask: number;
  complete: number;
  remarkTask: number;
  cancelledTask: number;
  totalTask: number;
}

export interface UserCardData {
  accept: number;
  decline: number;
  remaining: number;
  attented: number;
  totaluser: number;
}

export interface DashboardTask {
  id: string;
  name: string;
  rawStartTime: string;
  rawEndTime: string;
  status: string;
  remarkReason: string | null;
  extratTme: number | null;
  howmuchComplete: string | null;
  startAt: string;
  endAt: string;
  date?: string;
  user?: { name: string; number: string };
}

export interface TaskTableUserTask {
  id: string;
  name: string;
  description: string | null;
  rawStartTime: string;
  rawEndTime: string;
  startAt: string;
  endAt: string;
  status: string;
  finaldecision: string | null;
  remarkReason: string | null;
  extratTme: number | null;
  howmuchComplete: string | null;
  actualTime: string | null;
  totalTime: string | null;
  sent: boolean;
  sendAt: string | null;
  date: string;
}

export interface TaskTableUserGroup {
  userId: string;
  name: string;
  number: string;
  managerName: string;
  managerMobile: string;
  tasks: TaskTableUserTask[];
}

export interface DashboardDailyTask {
  id: string;
  userId: string;
  status: string | null;
  finaldecision: string | null;
  remarkReason: string | null;
  absentReason: string | null;
  sent: boolean;
  date: string;
  user?: { name: string; number: string };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type TaskStatusFilter =
  | 'all'
  | 'remark'
  | 'inprogress'
  | 'pending'
  | 'completed'
  | 'cancelled'
  | 'delayed';

export type UserStatusFilter = 'all' | 'accept' | 'remaining' | 'decline';

type TableQuery = {
  page?: number;
  limit?: number;
  search?: string;
  time: TimeRange;
  status?: TaskStatusFilter;
};

type UserTableQuery = {
  page?: number;
  limit?: number;
  search?: string;
  time: TimeRange;
  status?: UserStatusFilter;
};

/** Show date column for multi-day ranges (not today / tomorrow / yesterday). */
export function showsDateColumn(time: TimeRange): boolean {
  return time !== 'today' && time !== 'tomorrow' && time !== 'yesterday';
}

export { formatShortDisplayDate } from '@/lib/utils/taskTabDate';

export async function fetchTaskCards(time: TimeRange) {
  const { data } = await apiClient.get<{ data: TaskCardData }>('/admin/dashboard/task-cards', {
    params: { time },
  });
  return data.data;
}

export async function fetchTaskTable(query: TableQuery) {
  const { data } = await apiClient.get<{
    tasks: DashboardTask[];
    groupedByUser?: TaskTableUserGroup[];
    pagination: PaginationMeta;
  }>('/admin/dashboard/task-table', { params: query });
  return data;
}

export async function fetchUserCards(time: TimeRange) {
  const { data } = await apiClient.get<{ data: UserCardData }>('/admin/dashboard/user-cards', {
    params: { time },
  });
  return data.data;
}

export async function fetchUserTable(query: UserTableQuery) {
  const { data } = await apiClient.get<{
    dailyTasks: DashboardDailyTask[];
    pagination: PaginationMeta;
  }>('/admin/dashboard/user-table', { params: query });
  return data;
}
