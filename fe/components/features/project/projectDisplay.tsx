import type { ReactNode } from 'react';
import type { ProjectTaskNode } from '@/lib/services/projectService';
import {
  formatProjectCompletion,
  formatProjectDate,
  formatProjectDateRange,
  formatProjectQty,
} from '@/lib/services/projectService';
import {
  getProjectTaskStatusTextClassName,
} from '@/lib/utils/status-styles';

const topBoxTitleClass = 'text-xl max-md:text-lg font-semibold text-brand-primary leading-tight break-words';

type DetailItemProps = Readonly<{
  label: string;
  value: ReactNode;
}>;

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-0.5 text-base text-gray-800 break-words">{value}</div>
    </div>
  );
}

export function ProjectStatusLabel({
  status,
  className = 'font-semibold',
}: Readonly<{
  status: string;
  className?: string;
}>) {
  return (
    <span className={`${className} ${getProjectTaskStatusTextClassName(status)}`}>
      {status}
    </span>
  );
}

type ProjectOverviewPanelProps = Readonly<{
  name: string;
  description?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  taskCount: number;
  subtaskCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}>;

export function ProjectOverviewPanel({
  name,
  description,
  plannedStart,
  plannedEnd,
  actualStart,
  actualEnd,
  taskCount,
  subtaskCount,
  createdAt,
  updatedAt,
}: ProjectOverviewPanelProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 max-md:p-4 shadow-sm space-y-4">
      <div>
        <h2 className={topBoxTitleClass}>{name}</h2>
        {description?.trim() && (
          <p className="mt-2 text-sm text-gray-600">{description.trim()}</p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DetailItem label="Total task" value={String(taskCount)} />
        <DetailItem label="Subtask" value={String(subtaskCount)} />
        <DetailItem
          label="Planned schedule"
          value={formatProjectDateRange(plannedStart, plannedEnd)}
        />
        <DetailItem
          label="Actual schedule"
          value={formatProjectDateRange(actualStart, actualEnd)}
        />
      </div>

      {(createdAt || updatedAt) && (
        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
          {createdAt && <DetailItem label="Created" value={formatProjectDate(createdAt)} />}
          {updatedAt && <DetailItem label="Updated" value={formatProjectDate(updatedAt)} />}
        </div>
      )}
    </div>
  );
}

type ProjectTaskMetricsProps = Readonly<{
  task: ProjectTaskNode;
  className?: string;
}>;

export function ProjectTaskMetrics({ task, className = '' }: ProjectTaskMetricsProps) {
  return (
    <div
      className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}
    >
      <DetailItem label="Type" value={task.type} />
      <DetailItem label="Status" value={<ProjectStatusLabel status={task.status} />} />
      <DetailItem label="Duration" value={task.durationDays != null ? `${task.durationDays} days` : '—'} />
      <DetailItem label="Completion" value={formatProjectCompletion(task.completionPct)} />
      <DetailItem
        label="Planned schedule"
        value={formatProjectDateRange(task.plannedStart, task.plannedEnd)}
      />
      <DetailItem
        label="Actual schedule"
        value={formatProjectDateRange(task.actualStart, task.actualEnd)}
      />
      <DetailItem label="Total qty" value={formatProjectQty(task.totalQty)} />
      <DetailItem label="Completed qty" value={formatProjectQty(task.completedQty)} />
      <DetailItem label="Assignee" value={task.assigneeName ?? '—'} />
      <DetailItem label="Subtask" value={String(task.childCount)} />
    </div>
  );
}
