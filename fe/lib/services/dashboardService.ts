import { apiClient } from '@/lib/api/client';

export type TimeRange =
  | 'today'
  | 'yesterday'
  | 'thisweek'
  | 'lastweek'
  | 'thismonth'
  | 'lastmonth'
  | 'thisyear';

export const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisweek', label: 'This Week' },
  { value: 'lastweek', label: 'Last Week' },
  { value: 'thismonth', label: 'This Month' },
  { value: 'lastmonth', label: 'Last Month' },
  { value: 'thisyear', label: 'This Year' },
];

export interface TaskCardData {
  ontrack: number;
  complete: number;
  remarkTask: number;
  totalTask: number;
}

export interface UserCardData {
  accept: number;
  decline: number;
  attented: number;
  totaluser: number;
}

export interface DashboardTask {
  id: string;
  name: string;
  rawStartTime: string;
  rawEndTime: string;
  status: string | null;
  remarkReason: string | null;
  startAt: string;
  endAt: string;
  date?: string;
  user?: { name: string; number: string };
}

export interface DashboardDailyTask {
  id: string;
  userId: string;
  status: string | null;
  finaldecision: string | null;
  notAttentReason: string | null;
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
  | 'ontrack'
  | 'pending'
  | 'completed'
  | 'cancelled';

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

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'June',
  'July',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Show date column for multi-day ranges (not today / yesterday). */
export function showsDateColumn(time: TimeRange): boolean {
  return time !== 'today' && time !== 'yesterday';
}

/** e.g. 1Jan, 13May, 30June — calendar day as stored (UTC date parts). */
export function formatShortDisplayDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const day = d.getUTCDate();
  const month = SHORT_MONTHS[d.getUTCMonth()] ?? '';
  return `${day}${month}`;
}

export async function fetchTaskCards(time: TimeRange) {
  const { data } = await apiClient.get<{ data: TaskCardData }>('/admin/dashboard/task-cards', {
    params: { time },
  });
  return data.data;
}

export async function fetchTaskTable(query: TableQuery) {
  const { data } = await apiClient.get<{ tasks: DashboardTask[]; pagination: PaginationMeta }>(
    '/admin/dashboard/task-table',
    { params: query },
  );
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
