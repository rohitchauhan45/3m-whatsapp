'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  Loader2,
  MessageSquare,
  Search,
  Target,
  Users,
  UserCheck,
  UserX,
  CalendarCheck,
} from 'lucide-react';
import { usePageHeader } from '@/lib/utils/page-header-context';
import Modal, { ModalDetailRow } from '@/components/ui/Modal';
import Dropdown from '@/components/ui/Dropdown';
import {
  TIME_RANGE_OPTIONS,
  type TimeRange,
  type TaskStatusFilter,
  type UserStatusFilter,
  fetchTaskCards,
  fetchTaskTable,
  fetchUserCards,
  fetchUserTable,
  formatShortDisplayDate,
  showsDateColumn,
  type PaginationMeta,
} from '@/lib/services/dashboardService';
import { queryKeys } from '@/lib/query-keys';
import { cachedQueryOptions } from '@/lib/query-config';
import ScheduleSettings from './ScheduleSettings';

const TRUNCATE_LENGTH = 40;

type TaskDetailModalData = {
  taskName: string;
  userName: string;
  userNumber: string;
  reason: string;
};

function truncateText(text: string) {
  if (text.length <= TRUNCATE_LENGTH) return text;
  return `${text.slice(0, TRUNCATE_LENGTH)}....`;
}

function TruncatedText({ text }: { text: string | null | undefined }) {
  const value = text?.trim() || '—';
  if (value === '—') return <span className="text-gray-400">—</span>;

  const isLong = value.length > TRUNCATE_LENGTH;
  return <span className="block truncate">{isLong ? truncateText(value) : value}</span>;
}

function shouldShowRowEye(data: TaskDetailModalData) {
  return [data.taskName, data.userName, data.userNumber, data.reason].some(
    (v) => v !== '—' && v.length > TRUNCATE_LENGTH,
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  iconColor: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-3 flex items-center gap-3 shadow-sm">
      <Icon size={38} className={`shrink-0 ${iconColor}`} strokeWidth={2} />
      <div>
        <p className="text-[15px] text-gray-500 font-medium">{title}</p>
        <p className="text-[26px] font-semibold text-gray-700">{value}</p>
      </div>
    </div>
  );
}

function TableFilters({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  timeRange,
  onTimeRangeChange,
  leftSlot,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  timeRange: TimeRange;
  onTimeRangeChange: (value: TimeRange) => void;
  leftSlot?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
      <div>{leftSlot}</div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
      <div className="relative w-full sm:w-64">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-primary/20 bg-white"
        />
      </div>
      <Dropdown
        value={timeRange}
        onChange={(v) => onTimeRangeChange(v as TimeRange)}
        options={TIME_RANGE_OPTIONS}
        align="right"
      />
      </div>
    </div>
  );
}

const TASK_STATUS_FILTER_OPTIONS: { value: TaskStatusFilter; label: string }[] = [
  { value: 'remark', label: 'Remark' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'pending', label: 'Pending' },
  { value: 'ontrack', label: 'Ontrack' },
  { value: 'completed', label: 'Complete' },
  { value: 'all', label: 'All' },
];

const USER_STATUS_FILTER_OPTIONS: { value: UserStatusFilter; label: string }[] = [
  { value: 'decline', label: 'Cancelled' },
  { value: 'remaining', label: 'Remaining' },
  { value: 'accept', label: 'Accept' },
  { value: 'all', label: 'All' },
];

function TaskStatusFilterBar({
  value,
  onChange,
}: {
  value: TaskStatusFilter;
  onChange: (value: TaskStatusFilter) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 p-1.5 overflow-x-auto">
      {TASK_STATUS_FILTER_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`px-4 py-2 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all ${
              active
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function UserStatusFilterBar({
  value,
  onChange,
}: {
  value: UserStatusFilter;
  onChange: (value: UserStatusFilter) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 p-1.5 overflow-x-auto">
      {USER_STATUS_FILTER_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`px-4 py-2 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all ${
              active
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const TABLE_MIN_HEIGHT = 'min-h-[420px]';
const EMPTY_ROW_HEIGHT = 'h-[380px]';

function DataTableShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`overflow-x-auto border border-gray-200 rounded-xl bg-white ${TABLE_MIN_HEIGHT}`}
    >
      {children}
    </div>
  );
}

function TaskStatusBadge({ status }: { status: string | null }) {
  const s = status || 'pending';

  const config: Record<string, { label: string; className: string }> = {
    completed: { label: 'completed', className: 'text-green-600' },
    inProgress: { label: 'inProgress', className: 'text-blue-600' },
    remark: { label: 'remark', className: 'text-red-400' },
    cancelled: { label: 'cancelled', className: 'text-red-600' },
    pending: { label: 'not send', className: 'text-red-600' },
    onTrack: { label: 'onTrack', className: 'text-blue-600' },
  };

  const { label, className } = config[s] || config.pending;

  return <span className={`text-xs font-semibold capitalize ${className}`}>{label}</span>;
}

function UserStatusBadge({
  status,
  sent,
}: {
  status: string | null;
  sent?: boolean | null;
}) {
  const displayStatus = status || 'remaining';

  if (displayStatus === 'remaining' && sent !== undefined) {
    return (
      <span
        className={`text-xs font-semibold capitalize ${
          sent ? 'text-red-600' : 'text-gray-500'
        }`}
      >
        remaining
      </span>
    );
  }

  const config: Record<string, { label: string; className: string }> = {
    accept: { label: 'accept', className: 'text-green-600' },
    decline: { label: 'decline', className: 'text-red-600' },
    remaining: { label: 'remaining', className: 'text-amber-600' },
  };

  const { label, className } = config[displayStatus] || {
    label: displayStatus,
    className: 'text-gray-600',
  };

  return <span className={`text-xs font-semibold capitalize ${className}`}>{label}</span>;
}

function PaginationBar({
  pagination,
  onPageChange,
  onLimitChange,
}: {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  const { page, limit, total, totalPages } = pagination;
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100">
      <p className="text-sm text-gray-500">
        Page {page} of {totalPages || 1} | {total} results
      </p>
      <div className="flex items-center gap-2">
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          {[10, 20, 50].map((n) => (
            <option key={n} value={n}>
              {n} rows
            </option>
          ))}
        </select>
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40"
        >
          Prev
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { setShowDashboardTabs, dashboardTab: tab, setDashboardTab } = usePageHeader();
  const [taskTimeRange, setTaskTimeRange] = useState<TimeRange>('today');
  const [userTimeRange, setUserTimeRange] = useState<TimeRange>('today');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [taskDetailModal, setTaskDetailModal] = useState<TaskDetailModalData | null>(null);
  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatusFilter>('remark');
  const [userStatusFilter, setUserStatusFilter] = useState<UserStatusFilter>('remaining');
  const prevTabRef = useRef(tab);

  const openTaskDetailModal = (data: TaskDetailModalData) => setTaskDetailModal(data);

  useEffect(() => {
    setShowDashboardTabs(true);
    return () => {
      setShowDashboardTabs(false);
      setDashboardTab('task');
    };
  }, [setShowDashboardTabs, setDashboardTab]);

  useEffect(() => {
    if (prevTabRef.current !== tab) {
      setSearch('');
      setSearchInput('');
      prevTabRef.current = tab;
    }
  }, [tab]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [taskTimeRange, userTimeRange, taskStatusFilter, userStatusFilter, search, tab]);

  const taskCardsQuery = useQuery({
    queryKey: queryKeys.dashboard.taskCards(taskTimeRange),
    queryFn: () => fetchTaskCards(taskTimeRange),
    enabled: tab === 'task',
    ...cachedQueryOptions,
  });

  const taskTableQuery = useQuery({
    queryKey: queryKeys.dashboard.taskTable({
      time: taskTimeRange,
      status: taskStatusFilter,
      page,
      limit,
      search,
    }),
    queryFn: () =>
      fetchTaskTable({
        time: taskTimeRange,
        status: taskStatusFilter,
        page,
        limit,
        search: search || undefined,
      }),
    enabled: tab === 'task',
    ...cachedQueryOptions,
  });

  const userCardsQuery = useQuery({
    queryKey: queryKeys.dashboard.userCards(userTimeRange),
    queryFn: () => fetchUserCards(userTimeRange),
    enabled: tab === 'user',
    ...cachedQueryOptions,
  });

  const userTableQuery = useQuery({
    queryKey: queryKeys.dashboard.userTable({
      time: userTimeRange,
      status: userStatusFilter,
      page,
      limit,
      search,
    }),
    queryFn: () =>
      fetchUserTable({
        time: userTimeRange,
        status: userStatusFilter,
        page,
        limit,
        search: search || undefined,
      }),
    enabled: tab === 'user',
    ...cachedQueryOptions,
  });

  const isLoading =
    (tab === 'task' && (taskCardsQuery.isLoading || taskTableQuery.isLoading)) ||
    (tab === 'user' && (userCardsQuery.isLoading || userTableQuery.isLoading));

  const showTaskDateCol = showsDateColumn(taskTimeRange);
  const showUserDateCol = showsDateColumn(userTimeRange);
  const isAllFilter = taskStatusFilter === 'all';
  const isRemarkFilter = taskStatusFilter === 'remark';
  const isOnTrackFilter = taskStatusFilter === 'ontrack';
  const isPendingFilter = taskStatusFilter === 'pending';
  const isCompletedFilter = taskStatusFilter === 'completed';
  const isCancelledFilter = taskStatusFilter === 'cancelled';
  const showTaskStatusCol = isAllFilter || isPendingFilter;
  const showTaskReasonCol = isAllFilter || isRemarkFilter || isCancelledFilter;
  const showCompletedAtCol = isCompletedFilter;
  const taskReasonWidth = isRemarkFilter ? '34%' : '24%';

  const isUserAllFilter = userStatusFilter === 'all';
  const isUserAcceptFilter = userStatusFilter === 'accept';
  const isUserDeclineFilter = userStatusFilter === 'decline';
  const isUserRemainingFilter = userStatusFilter === 'remaining';
  const showUserStatusCol = isUserAllFilter || isUserRemainingFilter;
  const showUserOnTrackCol = isUserAllFilter || isUserAcceptFilter;
  const showUserReasonCol = isUserAllFilter || isUserDeclineFilter;
  const showUserSentCol = isUserAllFilter || isUserAcceptFilter || isUserRemainingFilter;
  const userReasonWidth = isUserDeclineFilter ? '34%' : '22%';

  return (
    <div className="animate-fade-in min-h-[calc(100dvh-11rem)] flex flex-col w-full">
      <div className="flex-1 flex flex-col min-h-0">
          {/* TASK TAB */}
          {tab === 'task' && (
            <div className="space-y-12 flex flex-col flex-1 min-h-0">
              {taskCardsQuery.data && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    title="On Track"
                    value={taskCardsQuery.data.ontrack}
                    icon={Target}
                    iconColor="text-blue-600"
                  />
                  <StatCard
                    title="Completed"
                    value={taskCardsQuery.data.complete}
                    icon={CheckCircle2}
                    iconColor="text-green-600"
                  />
                  <StatCard
                    title="Remark"
                    value={taskCardsQuery.data.remarkTask}
                    icon={MessageSquare}
                    iconColor="text-amber-600"
                  />
                  <StatCard
                    title="Total Tasks"
                    value={taskCardsQuery.data.totalTask}
                    icon={ClipboardList}
                    iconColor="text-purple-600"
                  />
                </div>
              )}

              <div className="flex flex-col flex-1 min-h-0">
                <TableFilters
                  searchValue={searchInput}
                  onSearchChange={setSearchInput}
                  searchPlaceholder="Search tasks..."
                  timeRange={taskTimeRange}
                  onTimeRangeChange={setTaskTimeRange}
                  leftSlot={
                    <TaskStatusFilterBar value={taskStatusFilter} onChange={setTaskStatusFilter} />
                  }
                />

                {isLoading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="animate-spin text-gray-400" size={28} />
                  </div>
                ) : (
                  <>
                    <DataTableShell>
                      <table className="w-full text-sm table-fixed">
                        <colgroup>
                          <col style={{ width: '22%' }} />
                          <col style={{ width: '14%' }} />
                          {showTaskDateCol && <col style={{ width: '8%' }} />}
                          <col style={{ width: '8%' }} />
                          <col style={{ width: '8%' }} />
                          {showTaskStatusCol && <col style={{ width: '10%' }} />}
                          {showTaskReasonCol && <col style={{ width: taskReasonWidth }} />}
                          {showCompletedAtCol && <col style={{ width: '16%' }} />}
                          <col style={{ width: '4%' }} />
                        </colgroup>
                        <thead>
                          <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                            <th className="px-4 py-3">Task</th>
                            <th className="px-4 py-3">User</th>
                            {showTaskDateCol && (
                              <th className="px-4 py-3">Date</th>
                            )}
                            <th className="px-4 py-3">Start</th>
                            <th className="px-4 py-3">End</th>
                            {showTaskStatusCol && <th className="px-4 py-3">Status</th>}
                            {showTaskReasonCol && (
                              <th className="px-4 py-3">Reason</th>
                            )}
                            {showCompletedAtCol && <th className="px-4 py-3">Completed At</th>}
                            <th className="px-2 py-3" aria-label="View details" />
                          </tr>
                        </thead>
                        <tbody>
                          {taskTableQuery.data?.tasks.map((task) => {
                            const detailData: TaskDetailModalData = {
                              taskName: task.name,
                              userName: task.user?.name || '—',
                              userNumber: task.user?.number || '—',
                              reason: task.remarkReason || '—',
                            };
                            const openDetail = () => openTaskDetailModal(detailData);
                            const showEye = shouldShowRowEye(detailData);

                            return (
                            <tr key={task.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                              <td className="px-4 py-3 font-medium text-gray-900">
                                <TruncatedText text={task.name} />
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                <TruncatedText text={task.user?.name} />
                                <div className="text-xs text-gray-400 mt-0.5">
                                  <TruncatedText text={task.user?.number} />
                                </div>
                              </td>
                              {showTaskDateCol && (
                                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                  {task.date ? formatShortDisplayDate(task.date) : '—'}
                                </td>
                              )}
                              <td className="px-4 py-3 text-gray-700">{task.rawStartTime}</td>
                              <td className="px-4 py-3 text-gray-700">{task.rawEndTime}</td>
                              {showTaskStatusCol && (
                                <td className="px-4 py-3">
                                  <TaskStatusBadge status={isPendingFilter ? null : task.status} />
                                </td>
                              )}
                              {showTaskReasonCol && (
                                <td className="px-4 py-3 text-gray-600">
                                  {isCancelledFilter ? (
                                    <TruncatedText text="user decline, for more info see in user tab" />
                                  ) : (
                                    <TruncatedText text={task.remarkReason} />
                                  )}
                                </td>
                              )}
                              {showCompletedAtCol && <td className="px-4 py-3 text-gray-400">—</td>}
                              <td className="px-2 py-3 text-center align-middle">
                                {showEye && (
                                  <button
                                    type="button"
                                    onClick={openDetail}
                                    className="text-brand-primary hover:text-brand-primaryDark transition-colors"
                                    aria-label="View full details"
                                  >
                                    <Eye size={16} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                          })}
                          {!taskTableQuery.data?.tasks.length && (
                            <tr>
                              <td
                                colSpan={
                                  (showTaskDateCol ? 6 : 5) +
                                  (showTaskStatusCol ? 1 : 0) +
                                  (showTaskReasonCol ? 1 : 0) +
                                  (showCompletedAtCol ? 1 : 0) +
                                  1
                                }
                                className={`${EMPTY_ROW_HEIGHT} align-middle text-center text-gray-400`}
                              >
                                No tasks for this period
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </DataTableShell>
                    {taskTableQuery.data?.pagination && (
                      <PaginationBar
                        pagination={taskTableQuery.data.pagination}
                        onPageChange={setPage}
                        onLimitChange={(l) => {
                          setLimit(l);
                          setPage(1);
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* USER TAB */}
          {tab === 'user' && (
            <div className="space-y-12 flex flex-col flex-1 min-h-0">
              {userCardsQuery.data && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    title="Accepted"
                    value={userCardsQuery.data.accept}
                    icon={UserCheck}
                    iconColor="text-green-600"
                  />
                  <StatCard
                    title="Declined"
                    value={userCardsQuery.data.decline}
                    icon={UserX}
                    iconColor="text-red-600"
                  />
                  <StatCard
                    title="Attended"
                    value={userCardsQuery.data.attented}
                    icon={CalendarCheck}
                    iconColor="text-blue-600"
                  />
                  <StatCard
                    title="Total Users"
                    value={userCardsQuery.data.totaluser}
                    icon={Users}
                    iconColor="text-purple-600"
                  />
                </div>
              )}

              <div className="flex flex-col flex-1 min-h-0">
                <TableFilters
                  searchValue={searchInput}
                  onSearchChange={setSearchInput}
                  searchPlaceholder="Search by name or number..."
                  timeRange={userTimeRange}
                  onTimeRangeChange={setUserTimeRange}
                  leftSlot={
                    <UserStatusFilterBar value={userStatusFilter} onChange={setUserStatusFilter} />
                  }
                />

                {isLoading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="animate-spin text-gray-400" size={28} />
                  </div>
                ) : (
                  <>
                    <DataTableShell>
                      <table className="w-full text-sm table-fixed">
                        <colgroup>
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '14%' }} />
                          {showUserDateCol && <col style={{ width: '8%' }} />}
                          {showUserStatusCol && <col style={{ width: '12%' }} />}
                          {showUserOnTrackCol && <col style={{ width: '12%' }} />}
                          {showUserReasonCol && <col style={{ width: userReasonWidth }} />}
                          {showUserSentCol && <col style={{ width: '8%' }} />}
                        </colgroup>
                        <thead>
                          <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                            <th className="px-4 py-3">User</th>
                            <th className="px-4 py-3">Number</th>
                            {showUserDateCol && (
                              <th className="px-4 py-3">Date</th>
                            )}
                            {showUserStatusCol && <th className="px-4 py-3">Status</th>}
                            {showUserOnTrackCol && <th className="px-4 py-3">On Track</th>}
                            {showUserReasonCol && <th className="px-4 py-3">Reason</th>}
                            {showUserSentCol && <th className="px-4 py-3">Sent</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {userTableQuery.data?.dailyTasks.map((dt) => {
                            const isRemainingRow = !dt.status || dt.status === 'remaining';
                            const useRemainingSentColors =
                              isUserRemainingFilter || (isUserAllFilter && isRemainingRow);

                            return (
                            <tr key={dt.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {dt.user?.name || '—'}
                              </td>
                              <td className="px-4 py-3 text-gray-600">{dt.user?.number || '—'}</td>
                              {showUserDateCol && (
                                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                  {dt.date ? formatShortDisplayDate(dt.date) : '—'}
                                </td>
                              )}
                              {showUserStatusCol && (
                                <td className="px-4 py-3">
                                  <UserStatusBadge
                                    status={dt.status}
                                    sent={useRemainingSentColors ? dt.sent : undefined}
                                  />
                                </td>
                              )}
                              {showUserOnTrackCol && (
                                <td className="px-4 py-3 text-gray-600">{dt.finaldecision || '—'}</td>
                              )}
                              {showUserReasonCol && (
                                <td className="px-4 py-3 text-gray-600">
                                  <TruncatedText text={dt.notAttentReason} />
                                </td>
                              )}
                              {showUserSentCol && (
                                <td className="px-4 py-3">
                                  {dt.sent ? (
                                    <span className="text-green-600 text-xs font-semibold">Yes</span>
                                  ) : (
                                    <span className="text-red-600 text-xs font-semibold capitalize">
                                      not send
                                    </span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                          })}
                          {!userTableQuery.data?.dailyTasks.length && (
                            <tr>
                              <td
                                colSpan={
                                  2 +
                                  (showUserDateCol ? 1 : 0) +
                                  (showUserStatusCol ? 1 : 0) +
                                  (showUserOnTrackCol ? 1 : 0) +
                                  (showUserReasonCol ? 1 : 0) +
                                  (showUserSentCol ? 1 : 0)
                                }
                                className={`${EMPTY_ROW_HEIGHT} align-middle text-center text-gray-400`}
                              >
                                No users for this period
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </DataTableShell>
                    {userTableQuery.data?.pagination && (
                      <PaginationBar
                        pagination={userTableQuery.data.pagination}
                        onPageChange={setPage}
                        onLimitChange={(l) => {
                          setLimit(l);
                          setPage(1);
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* TIME TAB */}
          {tab === 'time' && (
            <div className="max-w-xl w-full mx-auto">
              <ScheduleSettings />
            </div>
          )}
      </div>

      <Modal
        open={!!taskDetailModal}
        onClose={() => setTaskDetailModal(null)}
        title="Task Details"
        size="lg"
      >
        {taskDetailModal && (
          <>
            <ModalDetailRow label="Task Name" value={taskDetailModal.taskName} />
            <ModalDetailRow label="User Name" value={taskDetailModal.userName} />
            <ModalDetailRow label="User Number" value={taskDetailModal.userNumber} />
            <ModalDetailRow label="Reason" value={taskDetailModal.reason} />
          </>
        )}
      </Modal>
    </div>
  );
}
