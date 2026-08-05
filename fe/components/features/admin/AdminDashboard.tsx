'use client';

import { useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Users,
  UserCheck,
  UserX,
  CalendarCheck,
  Activity,
  UserPlus,
} from 'lucide-react';
import AddUserTaskModal from '@/components/features/admin/AddUserTaskModal';
import Modal, { ModalDetailGrid, ModalDetailRow } from '@/components/ui/Modal';
import Dropdown from '@/components/ui/Dropdown';
import {
  createTasksFromPreview,
  enrichPreviewRowsForCreate,
  formatUploadErrorMessage,
  type TaskPreviewRow,
} from '@/lib/services/taskService';
import { validatePreviewRows } from '@/lib/utils/taskImportValidation';
import { invalidateAdminTasks, invalidateDashboardQueries, queryKeys } from '@/lib/query-keys';
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
import { formatDayMonthYearFromIso } from '@/lib/utils/taskTabDate';
import { editTask } from '@/lib/services/taskService';
import { cachedQueryOptions } from '@/lib/query-config';
import { useToast } from '@/lib/providers/toast-provider';
import {
  getOnTrackStatusClassName,
  getSentClassName,
  getTaskStatusClassName,
  getUserStatusClassName,
} from '@/lib/utils/status-styles';
import { ui } from '@/lib/utils/ui-classes';

const TRUNCATE_LENGTH_DEFAULT = 40;
const TRUNCATE_LENGTH_LARGE = 100;

function useTruncateLength() {
  const [length, setLength] = useState(TRUNCATE_LENGTH_DEFAULT);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const update = () => setLength(mq.matches ? TRUNCATE_LENGTH_LARGE : TRUNCATE_LENGTH_DEFAULT);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return length;
}

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

function getTaskDisplayStatus(task: {
  status: string;
  finaldecision?: string | null;
}): string {
  return task.finaldecision ?? task.status;
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
    status: getTaskDisplayStatus(task),
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

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}....`;
}

function TruncatedText({
  text,
  maxLength,
}: {
  text: string | null | undefined;
  maxLength: number;
}) {
  const value = text?.trim() || '—';
  if (value === '—') return <span className="text-gray-400">—</span>;

  const isLong = value.length > maxLength;
  return <span className="block truncate">{isLong ? truncateText(value, maxLength) : value}</span>;
}

function shouldShowRowEye(data: TaskDetailModalData, maxLength: number) {
  return [data.taskName, data.userName, data.userNumber, data.reason].some(
    (v) => v !== '—' && v.length > maxLength,
  );
}

function isTaskEditable(startAt: string): boolean {
  const start = new Date(startAt);
  return !Number.isNaN(start.getTime()) && start.getTime() > Date.now();
}

type TaskAddForm = {
  userName: string;
  userNumber: string;
  dateLabel: string;
  date: string;
  managerName: string;
  managerMobile: string;
  name: string;
  start: string;
  end: string;
};

type TaskEditForm = {
  taskId: string;
  userName: string;
  dateLabel: string;
  name: string;
  start: string;
  end: string;
};

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
  rightSlot,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  timeRange: TimeRange;
  onTimeRangeChange: (value: TimeRange) => void;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
      <div>{leftSlot}</div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
        {rightSlot}
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
    <div className={ui.tabBar}>
      {TASK_STATUS_FILTER_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={active ? ui.tabActive : ui.tabInactive}
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
    <div className={ui.tabBar}>
      {USER_STATUS_FILTER_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={active ? ui.tabActive : ui.tabInactive}
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
  const className = getTaskStatusClassName(s);

  const labels: Record<string, string> = {
    completed: 'completed',
    inProgress: 'in progress',
    remark: 'remark',
    cancelled: 'cancelled',
    blocked: 'blocked',
    hold: 'hold',
    notSend: 'not send',
    pending: 'not send',
    onTrack: 'in progress',
    deleted: 'deleted',
  };

  const label = labels[s] ?? s;

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
        className={`${textSize} font-semibold capitalize ${getUserStatusClassName(displayStatus, sent)}`}
      >
        remaining
      </span>
    );
  }

  const labels: Record<string, string> = {
    accept: 'accept',
    decline: 'decline',
    remaining: 'remaining',
  };

  const label = labels[displayStatus] ?? displayStatus;
  const className = getUserStatusClassName(displayStatus, sent);

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

type AdminDashboardTab = 'user' | 'task';

type AdminDashboardProps = {
  tab: AdminDashboardTab;
  initialSearch?: string;
  initialTimeRange?: TimeRange;
  onAddTask?: () => void;
};

export default function AdminDashboard({
  tab,
  initialSearch = '',
  initialTimeRange = 'today',
  onAddTask,
}: AdminDashboardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();
  const [taskTimeRange, setTaskTimeRange] = useState<TimeRange>(initialTimeRange);
  const [userTimeRange, setUserTimeRange] = useState<TimeRange>('today');
  const [search, setSearch] = useState(initialSearch);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [taskDetailModal, setTaskDetailModal] = useState<TaskDetailModalData | null>(null);
  const [taskEditForm, setTaskEditForm] = useState<TaskEditForm | null>(null);
  const [addTaskForm, setAddTaskForm] = useState<TaskAddForm | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [userDetailModal, setUserDetailModal] = useState<DashboardDailyTask | null>(null);
  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatusFilter>(
    initialSearch ? 'all' : 'remark',
  );
  const [userStatusFilter, setUserStatusFilter] = useState<UserStatusFilter>('remaining');
  const truncateLength = useTruncateLength();

  const createTaskMutation = useMutation({
    mutationFn: createTasksFromPreview,
    onSuccess: (res) => {
      if (!res.success) {
        showError(formatUploadErrorMessage(res));
        return;
      }
      invalidateAdminTasks(queryClient);
      invalidateDashboardQueries(queryClient);
      setAddTaskForm(null);
      setAddUserOpen(false);
      showToast(res.message || 'Task created', 'success');
    },
    onError: (err: Error) => showError(err.message),
  });

  const editTaskMutation = useMutation({
    mutationFn: (form: TaskEditForm) =>
      editTask(form.taskId, {
        name: form.name.trim(),
        start: form.start.trim(),
        end: form.end.trim(),
      }),
    onSuccess: (res) => {
      if (!res.success) {
        showError(res.error || res.message || 'Failed to update task');
        return;
      }
      invalidateDashboardQueries(queryClient);
      setTaskEditForm(null);
      showToast(res.message || 'Task updated', 'success');
    },
    onError: () => {
      showError('Failed to update task');
    },
  });

  const openTaskEditModal = (group: TaskTableUserGroup, task: TaskTableUserTask) => {
    setTaskEditForm({
      taskId: task.id,
      userName: group.name,
      dateLabel: formatDayMonthYearFromIso(task.date),
      name: task.name,
      start: task.rawStartTime,
      end: task.rawEndTime,
    });
  };

  const openAddTaskModal = (group: TaskTableUserGroup) => {
    const dateLabel = group.tasks[0]?.date ? formatDayMonthYearFromIso(group.tasks[0].date) : '';
    setAddTaskForm({
      userName: group.name,
      userNumber: group.number,
      dateLabel,
      date: dateLabel,
      managerName: group.managerName,
      managerMobile: group.managerMobile,
      name: '',
      start: '',
      end: '',
    });
  };

  const handleCreateAddTask = () => {
    if (!addTaskForm) return;

    const previewRow = {
      id: 'new-modal',
      name: addTaskForm.userName,
      number: addTaskForm.userNumber,
      taskName: addTaskForm.name.trim(),
      rawStartTime: addTaskForm.start.trim(),
      rawEndTime: addTaskForm.end.trim(),
      date: addTaskForm.date,
      managerName: addTaskForm.managerName,
      managerMobile: addTaskForm.managerMobile,
      startRow: 0,
    };

    const validation = validatePreviewRows([previewRow]);
    if (!validation.valid) {
      showError(validation.errors.join('\n'));
      return;
    }

    createTaskMutation.mutate(enrichPreviewRowsForCreate([previewRow]));
  };

  const handleCreateAddUser = (rows: TaskPreviewRow[]) => {
    createTaskMutation.mutate(enrichPreviewRowsForCreate(rows));
  };

  const goToUserTasks = (userName: string, userNumber: string) => {
    const term = userName.trim() || userNumber.trim();
    router.push(`/tasks?search=${encodeURIComponent(term)}`);
  };

  useEffect(() => {
    setTaskTimeRange(initialTimeRange);
  }, [initialTimeRange]);

  useEffect(() => {
    setSearchInput(initialSearch);
    setSearch(initialSearch);
    if (initialSearch) {
      setTaskStatusFilter('all');
    }
  }, [initialSearch]);

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
  const showTaskStatusCol = isAllFilter || isPendingFilter;
  const showTaskReasonCol = !isAllFilter && (isRemarkFilter || isCancelledFilter);
  const showExtraTimeCol = !isAllFilter && isDelayedFilter;
  const showHowMuchCompleteCol = !isAllFilter && isDelayedFilter;
  const showCompletedAtCol = !isAllFilter && isCompletedFilter;
  const showTaskDateColInTable = !isAllFilter && showTaskDateCol;
  const taskReasonWidth = isRemarkFilter ? '34%' : '24%';

  const taskTrailingColCount = 1;

  const taskGroupedColSpan =
    4 +
    taskTrailingColCount +
    (showTaskDateColInTable ? 1 : 0) +
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
          <div className="space-y-6 flex flex-col flex-1 min-h-0">
            <div className="space-y-5">
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
                    iconColor="text-brand-primary"
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

              {onAddTask && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={onAddTask}
                    className={ui.btnPrimary}
                  >
                    <Plus size={16} />
                    Add Task
                  </button>
                </div>
              )}
            </div>

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
                        <col style={{ width: isAllFilter ? '14%' : '16%' }} />
                        <col
                          style={{
                            width: isAllFilter ? '36%' : isRemarkFilter ? '32%' : '42%',
                          }}
                        />
                        {showTaskDateColInTable && <col style={{ width: '8%' }} />}
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '11%' }} />
                        {showExtraTimeCol && <col style={{ width: '10%' }} />}
                        {showHowMuchCompleteCol && <col style={{ width: '12%' }} />}
                        {showTaskReasonCol && <col style={{ width: taskReasonWidth }} />}
                        {showCompletedAtCol && <col style={{ width: '12%' }} />}
                        <col style={{ width: '12%' }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-50 text-left text-sm uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-3">User</th>
                          <th className="px-4 py-3">Task</th>
                          {showTaskDateColInTable && <th className="px-4 py-3">Date</th>}
                          <th className="px-4 py-3 pr-8">Start</th>
                          <th className="px-4 py-3 pl-2">End</th>
                          {showExtraTimeCol && <th className="px-4 py-3">Extra Time</th>}
                          {showHowMuchCompleteCol && (
                            <th className="px-4 py-3">How Much Complete</th>
                          )}
                          {showTaskReasonCol && <th className="px-4 py-3">Reason</th>}
                          {showCompletedAtCol && <th className="px-4 py-3">Completed At</th>}
                          <th className="px-2 py-3 whitespace-nowrap" aria-label="Status and actions">
                            {showTaskStatusCol ? 'Status' : ''}
                          </th>
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
                                : !isPendingFilter && shouldShowRowEye(detailData, truncateLength);
                              const canEdit = isTaskEditable(task.startAt);

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
                                      <div className="flex flex-col">
                                        <div>
                                          <div className="font-medium text-gray-900">
                                            <TruncatedText text={group.name} maxLength={truncateLength} />
                                          </div>
                                          <div className="text-sm text-gray-500 mt-1">
                                            <TruncatedText text={group.number} maxLength={truncateLength} />
                                          </div>
                                        </div>
                                        <div className="pt-4 mt-2">
                                          <button
                                            type="button"
                                            onClick={() => openAddTaskModal(group)}
                                            className={ui.btnGhostBlue}
                                          >
                                            <Plus size={14} strokeWidth={2.5} />
                                            Task
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  )}
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    <TruncatedText text={task.name} maxLength={truncateLength} />
                                  </td>
                                  {showTaskDateColInTable && (
                                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                      {task.date ? formatShortDisplayDate(task.date) : '—'}
                                    </td>
                                  )}
                                  <td className="px-4 py-3 pr-8 text-gray-700">{task.rawStartTime}</td>
                                  <td className="px-4 py-3 pl-2 text-gray-700">{task.rawEndTime}</td>
                                  {showExtraTimeCol && (
                                    <td className="px-4 py-3 text-gray-700">
                                      {formatExtraTime(task.extratTme)}
                                    </td>
                                  )}
                                  {showHowMuchCompleteCol && (
                                    <td className="px-4 py-3 text-gray-700">
                                      <TruncatedText text={task.howmuchComplete} maxLength={truncateLength} />
                                    </td>
                                  )}
                                  {showTaskReasonCol && (
                                    <td className="px-4 py-3 text-gray-600">
                                      {isCancelledFilter ? (
                                        <TruncatedText text="user decline, for more info see in user tab" maxLength={truncateLength} />
                                      ) : (
                                        <TruncatedText text={task.remarkReason} maxLength={truncateLength} />
                                      )}
                                    </td>
                                  )}
                                  {showCompletedAtCol && (
                                    <td className="px-4 py-3 text-gray-400">—</td>
                                  )}
                                  <td className="px-2 py-3 align-middle whitespace-nowrap">
                                    <div className="flex items-center w-full">
                                      {showTaskStatusCol && (
                                        <TaskStatusBadge
                                          status={getTaskDisplayStatus(task)}
                                          large
                                        />
                                      )}
                                      <span className="flex-1 flex items-center justify-center min-w-0">
                                        {canEdit ? (
                                          <button
                                            type="button"
                                            onClick={() => openTaskEditModal(group, task)}
                                            className="text-brand-primary hover:text-brand-primaryDark transition-colors"
                                            aria-label="Edit task"
                                          >
                                            <Pencil size={18} />
                                          </button>
                                        ) : null}
                                      </span>
                                      <span className="inline-flex w-[18px] shrink-0 items-center justify-center">
                                        {showEye ? (
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
                                        ) : null}
                                      </span>
                                    </div>
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
                  <div className="flex items-center justify-between gap-4 pt-4">
                    <div className="min-w-0">
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
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddUserOpen(true)}
                      className={ui.btnPrimary}
                    >
                      <UserPlus size={16} />
                      Add User
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* USER TAB */}
        {tab === 'user' && (
          <div className="space-y-12 flex flex-col flex-1 min-h-0">
            {userCardsQuery.data && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
                  title="Remaining"
                  value={userCardsQuery.data.remaining}
                  icon={Clock}
                  iconColor="text-amber-600"
                />
                <StatCard
                  title="Attended"
                  value={userCardsQuery.data.attented}
                  icon={CalendarCheck}
                  iconColor="text-brand-primary"
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
                                  <TruncatedText text={dt.remarkReason} maxLength={truncateLength} />
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
                                    className={ui.linkPrimary}
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
      </div>

      <Modal
        open={!!userDetailModal}
        onClose={() => setUserDetailModal(null)}
        title="User Details"
        size="xl"
      >
        {userDetailModal && (
          <ModalDetailGrid>
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
              valueClassName={getUserStatusClassName(
                userDetailModal.status,
                !userDetailModal.status || userDetailModal.status === 'remaining'
                  ? userDetailModal.sent
                  : undefined,
              )}
            />
            <ModalDetailRow
              label="On Track"
              value={userDetailModal.finaldecision || '—'}
              valueClassName={getOnTrackStatusClassName(userDetailModal.finaldecision)}
              hideWhenEmpty={false}
            />
            <ModalDetailRow
              label="Sent"
              value={userDetailModal.sent ? 'Yes' : 'not send'}
              valueClassName={getSentClassName(userDetailModal.sent)}
            />
            <ModalDetailRow
              label="Decline Reason"
              value={userDetailModal.remarkReason || '—'}
              fullWidth
            />
            <ModalDetailRow
              label="Absent Reason"
              value={userDetailModal.absentReason || '—'}
              fullWidth
            />
          </ModalDetailGrid>
        )}
      </Modal>

      <AddUserTaskModal
        open={addUserOpen}
        onClose={() => setAddUserOpen(false)}
        onSubmit={handleCreateAddUser}
        isSubmitting={createTaskMutation.isPending}
      />

      <Modal
        open={!!addTaskForm}
        onClose={() => !createTaskMutation.isPending && setAddTaskForm(null)}
        title="Add Task"
        size="xl"
        headerRight={
          addTaskForm ? (
            <span className="text-lg font-medium text-amber-800 tabular-nums whitespace-nowrap">
              {addTaskForm.dateLabel}
            </span>
          ) : null
        }
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setAddTaskForm(null)}
              disabled={createTaskMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateAddTask}
              disabled={
                createTaskMutation.isPending ||
                !addTaskForm?.name.trim() ||
                !addTaskForm?.start.trim() ||
                !addTaskForm?.end.trim()
              }
              className={ui.btnPrimary}
            >
              {createTaskMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating…
                </>
              ) : (
                'Create'
              )}
            </button>
          </div>
        }
      >
        {addTaskForm && (
          <ModalDetailGrid>
            <ModalDetailRow label="User Name" value={addTaskForm.userName} />
            <ModalDetailRow label="User Number" value={addTaskForm.userNumber} />
            <div className="sm:col-span-2 rounded-xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm">
              <p className="mb-1.5 text-sm font-medium text-gray-500">Task name</p>
              <input
                type="text"
                value={addTaskForm.name}
                onChange={(e) =>
                  setAddTaskForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                }
                placeholder="Task name"
                className={ui.inputEditable}
              />
            </div>
            <div className="rounded-xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm">
              <p className="mb-1.5 text-sm font-medium text-gray-500">Start time</p>
              <input
                type="text"
                value={addTaskForm.start}
                onChange={(e) =>
                  setAddTaskForm((prev) => (prev ? { ...prev, start: e.target.value } : prev))
                }
                placeholder="e.g. 9am"
                className={ui.inputEditable}
              />
            </div>
            <div className="rounded-xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm">
              <p className="mb-1.5 text-sm font-medium text-gray-500">End time</p>
              <input
                type="text"
                value={addTaskForm.end}
                onChange={(e) =>
                  setAddTaskForm((prev) => (prev ? { ...prev, end: e.target.value } : prev))
                }
                placeholder="e.g. 11am"
                className={ui.inputEditable}
              />
            </div>
          </ModalDetailGrid>
        )}
      </Modal>

      <Modal
        open={!!taskEditForm}
        onClose={() => !editTaskMutation.isPending && setTaskEditForm(null)}
        title="Edit Task"
        size="md"
        headerRight={
          taskEditForm ? (
            <span className="text-lg font-semibold text-amber-800 tabular-nums whitespace-nowrap">
              {taskEditForm.dateLabel}
            </span>
          ) : null
        }
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setTaskEditForm(null)}
              disabled={editTaskMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => taskEditForm && editTaskMutation.mutate(taskEditForm)}
              disabled={
                editTaskMutation.isPending ||
                !taskEditForm?.name.trim() ||
                !taskEditForm?.start.trim() ||
                !taskEditForm?.end.trim()
              }
              className={ui.btnPrimary}
            >
              {editTaskMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        }
      >
        {taskEditForm && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              User: <span className="font-medium text-gray-800">{taskEditForm.userName}</span>
            </p>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-gray-700">Task name</span>
              <input
                type="text"
                value={taskEditForm.name}
                onChange={(e) =>
                  setTaskEditForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                }
                className={ui.inputEditable}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-gray-700">Start time</span>
              <input
                type="text"
                value={taskEditForm.start}
                onChange={(e) =>
                  setTaskEditForm((prev) => (prev ? { ...prev, start: e.target.value } : prev))
                }
                placeholder="e.g. 9am"
                className={ui.inputEditable}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-gray-700">End time</span>
              <input
                type="text"
                value={taskEditForm.end}
                onChange={(e) =>
                  setTaskEditForm((prev) => (prev ? { ...prev, end: e.target.value } : prev))
                }
                placeholder="e.g. 11am"
                className={ui.inputEditable}
              />
            </label>
          </div>
        )}
      </Modal>

      <Modal
        open={!!taskDetailModal}
        onClose={() => setTaskDetailModal(null)}
        title={taskDetailModal?.taskName || 'Task Details'}
        size="xl"
      >
        {taskDetailModal && (
          <ModalDetailGrid>
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
                valueClassName={getTaskStatusClassName(taskDetailModal.status)}
              />
            )}
            {taskDetailModal.sent !== undefined && (
              <ModalDetailRow
                label="Sent"
                value={taskDetailModal.sent ? 'Yes' : 'not send'}
                valueClassName={getSentClassName(taskDetailModal.sent)}
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
            {taskDetailModal.description !== undefined && (
              <ModalDetailRow
                label="Description"
                value={taskDetailModal.description || '—'}
                fullWidth
              />
            )}
            <ModalDetailRow
              label="Remark Reason"
              value={taskDetailModal.remarkReason ?? taskDetailModal.reason}
              fullWidth
            />
          </ModalDetailGrid>
        )}
      </Modal>
    </div>
  );
}