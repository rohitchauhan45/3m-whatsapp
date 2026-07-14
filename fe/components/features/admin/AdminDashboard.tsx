'use client';

import { useEffect, useRef, useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  Loader2,
  MessageSquare,
  Search,
  Users,
  UserCheck,
  UserX,
  CalendarCheck,
  Activity,
} from 'lucide-react';
import { usePageHeader } from '@/lib/utils/page-header-context';
import Modal, { ModalDetailRow } from '@/components/ui/Modal';
import Dropdown from '@/components/ui/Dropdown';
import {
  TIME_RANGE_OPTIONS,
  type TimeRange,
  type TaskStatusFilter,
  type UserStatusFilter,
  type TaskTableUserGroup,
  type TaskTableUserTask,
  type DashboardDailyTask,
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
  description?: string | null;
  date?: string;
  rawStartTime?: string;
  rawEndTime?: string;
  startAt?: string;
  endAt?: string;
  status?: string | null;
  sent?: boolean;
  sendAt?: string | null;
  howmuchComplete?: string | null;
  extratTme?: number | null;
  actualTime?: string | null;
  totalTime?: string | null;
  remarkReason?: string | null;
  reason: string;
};

function formatTaskStatusLabel(status: string | null | undefined): string {
  if (!status || status === 'notSend') return 'not send';
  if (status === 'onTrack') return 'in progress';
  if (status === 'inProgress') return 'in progress';
  return status;
}

function formatModalDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function buildAllTaskDetailModal(
  group: TaskTableUserGroup,
  task: TaskTableUserTask,
): TaskDetailModalData {
  return {
    taskName: task.name,
    userName: group.name,
    userNumber: group.number,
    description: task.description,
    date: task.date,
    rawStartTime: task.rawStartTime,
    rawEndTime: task.rawEndTime,
    startAt: task.startAt,
    endAt: task.endAt,
    status: task.status,
    sent: task.sent,
    sendAt: task.sendAt,
    howmuchComplete: task.howmuchComplete,
    extratTme: task.extratTme,
    actualTime: task.actualTime,
    totalTime: task.totalTime,
    remarkReason: task.remarkReason,
    reason: task.remarkReason || '—',
  };
}

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

function buildFilterTaskDetailModal(
  group: TaskTableUserGroup,
  task: TaskTableUserTask,
): TaskDetailModalData {
  return {
    taskName: task.name,
    userName: group.name,
    userNumber: group.number,
    reason: task.remarkReason || '—',
  };
}

function formatUserStatusLabel(status: string | null, sent?: boolean): string {
  const displayStatus = status || 'remaining';
  if (displayStatus === 'remaining' && sent !== undefined) {
    return 'remaining';
  }
  return displayStatus;
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

function formatExtraTime(mins: number | null | undefined): string {
  if (mins == null || mins <= 0) return '—';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

const TASK_STATUS_FILTER_OPTIONS: { value: TaskStatusFilter; label: string }[] = [
  { value: 'remark', label: 'Remark' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'pending', label: 'Pending' },
  { value: 'inprogress', label: 'In Progress' },
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

function TaskStatusBadge({
  status,
  large = false,
}: {
  status: string | null;
  large?: boolean;
}) {
  const s = status || 'pending';
  const textSize = large ? 'text-sm' : 'text-xs';

  const config: Record<string, { label: string; className: string }> = {
    completed: { label: 'completed', className: 'text-green-600' },
    inProgress: { label: 'in progress', className: 'text-blue-600' },
    remark: { label: 'remark', className: 'text-red-400' },
    cancelled: { label: 'cancelled', className: 'text-red-600' },
    notSend: { label: 'not send', className: 'text-red-600' },
    pending: { label: 'not send', className: 'text-red-600' },
    onTrack: { label: 'in progress', className: 'text-blue-600' },
  };

  const { label, className } = config[s] || config.pending;

  return <span className={`${textSize} font-semibold capitalize ${className}`}>{label}</span>;
}

function UserStatusBadge({
  status,
  sent,
  large = false,
}: {
  status: string | null;
  sent?: boolean | null;
  large?: boolean;
}) {
  const displayStatus = status || 'remaining';
  const textSize = large ? 'text-sm' : 'text-xs';

  if (displayStatus === 'remaining' && sent !== undefined) {
    return (
      <span
        className={`${textSize} font-semibold capitalize ${
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

  return <span className={`${textSize} font-semibold capitalize ${className}`}>{label}</span>;
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
  const [userDetailModal, setUserDetailModal] = useState<DashboardDailyTask | null>(null);
  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatusFilter>('remark');
  const [userStatusFilter, setUserStatusFilter] = useState<UserStatusFilter>('remaining');
  const prevTabRef = useRef(tab);
  const pendingUserTaskSearchRef = useRef<string | null>(null);

  const goToUserTasks = (userName: string, userNumber: string) => {
    const term = userName.trim() || userNumber.trim();
    pendingUserTaskSearchRef.current = term;
    setTaskTimeRange(userTimeRange);
    setTaskStatusFilter('all');
    setDashboardTab('task');
  };

  useEffect(() => {
    setShowDashboardTabs(true);
    return () => {
      setShowDashboardTabs(false);
      setDashboardTab('user');
    };
  }, [setShowDashboardTabs, setDashboardTab]);

  useEffect(() => {
    if (prevTabRef.current !== tab) {
      const pending = pendingUserTaskSearchRef.current;
      if (pending !== null) {
        setSearchInput(pending);
        setSearch(pending);
        pendingUserTaskSearchRef.current = null;
      } else {
        setSearch('');
        setSearchInput('');
      }
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
  const isDelayedFilter = taskStatusFilter === 'delayed';
  const isPendingFilter = taskStatusFilter === 'pending';
  const isCompletedFilter = taskStatusFilter === 'completed';
  const isCancelledFilter = taskStatusFilter === 'cancelled';
  const showTaskStatusCol = !isAllFilter && isPendingFilter;
  const showTaskReasonCol = !isAllFilter && (isRemarkFilter || isCancelledFilter);
  const showExtraTimeCol = !isAllFilter && isDelayedFilter;
  const showHowMuchCompleteCol = !isAllFilter && isDelayedFilter;
  const showCompletedAtCol = !isAllFilter && isCompletedFilter;
  const showTaskDateColInTable = !isAllFilter && showTaskDateCol;
  const taskReasonWidth = isRemarkFilter ? '34%' : '24%';

  const taskGroupedColSpan =
    5 +
    (showTaskDateColInTable ? 1 : 0) +
    (showTaskStatusCol ? 1 : 0) +
    (showExtraTimeCol ? 1 : 0) +
    (showHowMuchCompleteCol ? 1 : 0) +
    (showTaskReasonCol ? 1 : 0) +
    (showCompletedAtCol ? 1 : 0);

  const isUserAllFilter = userStatusFilter === 'all';
  const isUserAcceptFilter = userStatusFilter === 'accept';
  const isUserDeclineFilter = userStatusFilter === 'decline';
  const isUserRemainingFilter = userStatusFilter === 'remaining';
  const showUserStatusCol = isUserAllFilter || isUserRemainingFilter;
  const showUserOnTrackCol = isUserAcceptFilter;
  const showUserReasonCol = isUserDeclineFilter;
  const showUserSentCol = isUserAllFilter || isUserAcceptFilter || isUserRemainingFilter;
  const showUserDateColInTable = showUserDateCol && !isUserAllFilter;
  const userReasonWidth = isUserDeclineFilter ? '34%' : '22%';

  const userAllFilterColSpan = 6;
  const userTableColSpan =
    2 +
    (showUserDateColInTable ? 1 : 0) +
    (showUserStatusCol ? 1 : 0) +
    (showUserOnTrackCol ? 1 : 0) +
    (showUserReasonCol ? 1 : 0) +
    (showUserSentCol ? 1 : 0) +
    (isUserAllFilter ? 2 : 0);

  const groupedUsers = taskTableQuery.data?.groupedByUser ?? [];

  return (
    <div className="animate-fade-in min-h-[calc(100dvh-11rem)] flex flex-col w-full">
      <div className="flex-1 flex flex-col min-h-0">
          {/* TASK TAB */}
          {tab === 'task' && (
            <div className="space-y-12 flex flex-col flex-1 min-h-0">
              {taskCardsQuery.data && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  <StatCard
                    title="Remark"
                    value={taskCardsQuery.data.remarkTask}
                    icon={MessageSquare}
                    iconColor="text-amber-600"
                  />
                  <StatCard
                    title="Delayed"
                    value={taskCardsQuery.data.delayedTask}
                    icon={Clock}
                    iconColor="text-orange-600"
                  />
                  <StatCard
                    title="Cancelled"
                    value={taskCardsQuery.data.cancelledTask}
                    icon={UserX}
                    iconColor="text-red-600"
                  />
                  <StatCard
                    title="In Progress"
                    value={taskCardsQuery.data.inProgress}
                    icon={Activity}
                    iconColor="text-blue-600"
                  />
                  <StatCard
                    title="Complete"
                    value={taskCardsQuery.data.complete}
                    icon={CheckCircle2}
                    iconColor="text-green-600"
                  />
                  <StatCard
                    title="All"
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
                      <table className="w-full text-base table-fixed">
                        <colgroup>
                          <col style={{ width: isAllFilter ? '20%' : '18%' }} />
                          <col
                            style={{
                              width: isAllFilter ? '38%' : isRemarkFilter ? '22%' : '28%',
                            }}
                          />
                          {showTaskDateColInTable && <col style={{ width: '8%' }} />}
                          <col style={{ width: isAllFilter ? '14%' : '9%' }} />
                          <col style={{ width: isAllFilter ? '14%' : '9%' }} />
                          {showTaskStatusCol && <col style={{ width: '10%' }} />}
                          {showExtraTimeCol && <col style={{ width: '10%' }} />}
                          {showHowMuchCompleteCol && <col style={{ width: '12%' }} />}
                          {showTaskReasonCol && <col style={{ width: taskReasonWidth }} />}
                          {showCompletedAtCol && <col style={{ width: '12%' }} />}
                          <col style={{ width: isAllFilter ? '6%' : '5%' }} />
                        </colgroup>
                        <thead>
                          <tr className="bg-gray-50 text-left text-sm uppercase tracking-wide text-gray-500">
                            <th className="px-4 py-3">User</th>
                            <th className="px-4 py-3">Task</th>
                            {showTaskDateColInTable && <th className="px-4 py-3">Date</th>}
                            <th className="px-4 py-3">Start</th>
                            <th className="px-4 py-3">End</th>
                            {showTaskStatusCol && <th className="px-4 py-3">Status</th>}
                            {showExtraTimeCol && <th className="px-4 py-3">Extra Time</th>}
                            {showHowMuchCompleteCol && (
                              <th className="px-4 py-3">How Much Complete</th>
                            )}
                            {showTaskReasonCol && <th className="px-4 py-3">Reason</th>}
                            {showCompletedAtCol && <th className="px-4 py-3">Completed At</th>}
                            <th className="px-2 py-3" aria-label="View details" />
                          </tr>
                        </thead>
                        <tbody>
                          {groupedUsers.map((group, groupIndex) => (
                            <Fragment key={group.userId}>
                              {group.tasks.map((task, taskIndex) => {
                                const detailData = isAllFilter
                                  ? buildAllTaskDetailModal(group, task)
                                  : buildFilterTaskDetailModal(group, task);
                                const showEye = isAllFilter
                                  ? true
                                  : !isPendingFilter && shouldShowRowEye(detailData);

                                return (
                                  <tr
                                    key={task.id}
                                    className={`border-t border-gray-100 hover:bg-gray-50/50 ${
                                      taskIndex === group.tasks.length - 1
                                        ? 'border-b-[6px] border-b-gray-100'
                                        : ''
                                    }`}
                                  >
                                    {taskIndex === 0 && (
                                      <td
                                        rowSpan={group.tasks.length}
                                        className="px-4 py-3 align-top border-r border-gray-100 bg-gray-50/40"
                                      >
                                        <div className="font-medium text-gray-900">
                                          <TruncatedText text={group.name} />
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1">
                                          <TruncatedText text={group.number} />
                                        </div>
                                      </td>
                                    )}
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                      <TruncatedText text={task.name} />
                                    </td>
                                    {showTaskDateColInTable && (
                                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                        {task.date ? formatShortDisplayDate(task.date) : '—'}
                                      </td>
                                    )}
                                    <td className="px-4 py-3 text-gray-700">{task.rawStartTime}</td>
                                    <td className="px-4 py-3 text-gray-700">{task.rawEndTime}</td>
                                    {showTaskStatusCol && (
                                      <td className="px-4 py-3">
                                        <TaskStatusBadge
                                          status={task.status}
                                          large
                                        />
                                      </td>
                                    )}
                                    {showExtraTimeCol && (
                                      <td className="px-4 py-3 text-gray-700">
                                        {formatExtraTime(task.extratTme)}
                                      </td>
                                    )}
                                    {showHowMuchCompleteCol && (
                                      <td className="px-4 py-3 text-gray-700">
                                        <TruncatedText text={task.howmuchComplete} />
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
                                    {showCompletedAtCol && (
                                      <td className="px-4 py-3 text-gray-400">—</td>
                                    )}
                                    <td className="px-2 py-3 text-center align-middle">
                                      {showEye && (
                                        <button
                                          type="button"
                                          onClick={() => setTaskDetailModal(detailData)}
                                          className="text-brand-primary hover:text-brand-primaryDark transition-colors"
                                          aria-label={
                                            isAllFilter
                                              ? 'View full task details'
                                              : 'View full details'
                                          }
                                        >
                                          <Eye size={18} />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                              {groupIndex < groupedUsers.length - 1 && (
                                <tr aria-hidden="true">
                                  <td
                                    colSpan={taskGroupedColSpan}
                                    className="h-4 p-0 bg-gray-50/80 border-0"
                                  />
                                </tr>
                              )}
                            </Fragment>
                          ))}
                          {!groupedUsers.length && (
                            <tr>
                              <td
                                colSpan={taskGroupedColSpan}
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
                      <table className="w-full text-base table-fixed">
                        <colgroup>
                          {isUserAllFilter ? (
                            <>
                              <col style={{ width: '22%' }} />
                              <col style={{ width: '18%' }} />
                              <col style={{ width: '14%' }} />
                              <col style={{ width: '12%' }} />
                              <col style={{ width: '10%' }} />
                              <col style={{ width: '6%' }} />
                            </>
                          ) : (
                            <>
                              <col style={{ width: '18%' }} />
                              <col style={{ width: '14%' }} />
                              {showUserDateColInTable && <col style={{ width: '8%' }} />}
                              {showUserStatusCol && <col style={{ width: '12%' }} />}
                              {showUserOnTrackCol && <col style={{ width: '12%' }} />}
                              {showUserReasonCol && <col style={{ width: userReasonWidth }} />}
                              {showUserSentCol && <col style={{ width: '8%' }} />}
                            </>
                          )}
                        </colgroup>
                        <thead>
                          <tr className="bg-gray-50 text-left text-sm uppercase tracking-wide text-gray-500">
                            <th className="px-4 py-3">User</th>
                            <th className="px-4 py-3">Number</th>
                            {showUserDateColInTable && (
                              <th className="px-4 py-3">Date</th>
                            )}
                            {showUserStatusCol && <th className="px-4 py-3">Status</th>}
                            {showUserOnTrackCol && <th className="px-4 py-3">On Track</th>}
                            {showUserReasonCol && <th className="px-4 py-3">Reason</th>}
                            {showUserSentCol && <th className="px-4 py-3">Sent</th>}
                            {isUserAllFilter && <th className="px-4 py-3">Task</th>}
                            {isUserAllFilter && (
                              <th className="px-2 py-3" aria-label="View details" />
                            )}
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
                              {showUserDateColInTable && (
                                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                  {dt.date ? formatShortDisplayDate(dt.date) : '—'}
                                </td>
                              )}
                              {showUserStatusCol && (
                                <td className="px-4 py-3">
                                  <UserStatusBadge
                                    status={dt.status}
                                    sent={useRemainingSentColors ? dt.sent : undefined}
                                    large
                                  />
                                </td>
                              )}
                              {showUserOnTrackCol && (
                                <td className="px-4 py-3 text-gray-600">{dt.finaldecision || '—'}</td>
                              )}
                              {showUserReasonCol && (
                                <td className="px-4 py-3 text-gray-600">
                                  <TruncatedText text={dt.remarkReason} />
                                </td>
                              )}
                              {showUserSentCol && (
                                <td className="px-4 py-3">
                                  {dt.sent ? (
                                    <span className="text-sm font-semibold text-green-600">Yes</span>
                                  ) : (
                                    <span className="text-sm font-semibold capitalize text-red-600">
                                      not send
                                    </span>
                                  )}
                                </td>
                              )}
                              {isUserAllFilter && (
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      goToUserTasks(dt.user?.name || '', dt.user?.number || '')
                                    }
                                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                                  >
                                    Task
                                  </button>
                                </td>
                              )}
                              {isUserAllFilter && (
                                <td className="px-2 py-3 text-center align-middle">
                                  <button
                                    type="button"
                                    onClick={() => setUserDetailModal(dt)}
                                    className="text-brand-primary hover:text-brand-primaryDark transition-colors"
                                    aria-label="View full user details"
                                  >
                                    <Eye size={18} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                          })}
                          {!userTableQuery.data?.dailyTasks.length && (
                            <tr>
                              <td
                                colSpan={isUserAllFilter ? userAllFilterColSpan : userTableColSpan}
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

          {/* SETTING TAB */}
          {tab === 'setting' && (
            <div className="w-full max-w-5xl mx-auto">
              <ScheduleSettings />
            </div>
          )}
      </div>

      <Modal
        open={!!userDetailModal}
        onClose={() => setUserDetailModal(null)}
        title="User Details"
        size="lg"
      >
        {userDetailModal && (
          <>
            <ModalDetailRow label="User Name" value={userDetailModal.user?.name || '—'} />
            <ModalDetailRow label="Number" value={userDetailModal.user?.number || '—'} />
            <ModalDetailRow
              label="Date"
              value={
                userDetailModal.date ? formatShortDisplayDate(userDetailModal.date) : '—'
              }
            />
            <ModalDetailRow
              label="Status"
              value={formatUserStatusLabel(
                userDetailModal.status,
                !userDetailModal.status || userDetailModal.status === 'remaining'
                  ? userDetailModal.sent
                  : undefined,
              )}
            />
            <ModalDetailRow label="On Track" value={userDetailModal.finaldecision || '—'} />
            <ModalDetailRow
              label="Decline Reason"
              value={userDetailModal.remarkReason || '—'}
            />
            <ModalDetailRow
              label="Absent Reason"
              value={userDetailModal.absentReason || '—'}
            />
            <ModalDetailRow
              label="Sent"
              value={userDetailModal.sent ? 'Yes' : 'not send'}
            />
          </>
        )}
      </Modal>

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
            {taskDetailModal.date !== undefined && (
              <ModalDetailRow
                label="Date"
                value={
                  taskDetailModal.date ? formatShortDisplayDate(taskDetailModal.date) : '—'
                }
              />
            )}
            {taskDetailModal.description !== undefined && (
              <ModalDetailRow label="Description" value={taskDetailModal.description || '—'} />
            )}
            {taskDetailModal.rawStartTime !== undefined && (
              <ModalDetailRow label="Start Time" value={taskDetailModal.rawStartTime || '—'} />
            )}
            {taskDetailModal.rawEndTime !== undefined && (
              <ModalDetailRow label="End Time" value={taskDetailModal.rawEndTime || '—'} />
            )}
            {taskDetailModal.startAt !== undefined && (
              <ModalDetailRow
                label="Scheduled Start"
                value={formatModalDateTime(taskDetailModal.startAt)}
              />
            )}
            {taskDetailModal.endAt !== undefined && (
              <ModalDetailRow
                label="Scheduled End"
                value={formatModalDateTime(taskDetailModal.endAt)}
              />
            )}
            {taskDetailModal.status !== undefined && (
              <ModalDetailRow
                label="Status"
                value={formatTaskStatusLabel(taskDetailModal.status)}
              />
            )}
            {taskDetailModal.sent !== undefined && (
              <ModalDetailRow
                label="Sent"
                value={taskDetailModal.sent ? 'Yes' : 'not send'}
              />
            )}
            {taskDetailModal.sendAt !== undefined && (
              <ModalDetailRow
                label="Sent At"
                value={formatModalDateTime(taskDetailModal.sendAt)}
              />
            )}
            {taskDetailModal.howmuchComplete !== undefined && (
              <ModalDetailRow
                label="How Much Complete"
                value={taskDetailModal.howmuchComplete || '—'}
              />
            )}
            {taskDetailModal.extratTme !== undefined && (
              <ModalDetailRow
                label="Extra Time"
                value={formatExtraTime(taskDetailModal.extratTme)}
              />
            )}
            {taskDetailModal.actualTime !== undefined && (
              <ModalDetailRow label="Actual Time" value={taskDetailModal.actualTime || '—'} />
            )}
            {taskDetailModal.totalTime !== undefined && (
              <ModalDetailRow label="Total Time" value={taskDetailModal.totalTime || '—'} />
            )}
            <ModalDetailRow
              label="Remark Reason"
              value={taskDetailModal.remarkReason ?? taskDetailModal.reason}
            />
          </>
        )}
      </Modal>
    </div>
  );
}