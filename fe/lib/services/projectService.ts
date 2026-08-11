import { apiClient } from '@/lib/api/client';

export interface ProjectListItem {
  id: string;
  name: string;
  description: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  createdAt: string;
  updatedAt: string | null;
  taskCount: number;
  subtaskCount: number;
}

export interface ProjectTaskNode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  assigneeName: string | null;
  type: string;
  status: string;
  completionPct: number | null;
  totalQty: number | null;
  completedQty: number | null;
  durationDays: number | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  childCount: number;
  children: ProjectTaskNode[];
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  createdAt: string;
  updatedAt: string | null;
  taskCount: number;
  subtaskCount: number;
  rootTasks: ProjectTaskNode[];
}

export interface ProjectTaskBranch {
  project: {
    id: string;
    name: string;
  };
  task: ProjectTaskNode;
  children: ProjectTaskNode[];
}

export type ProjectTaskTypeValue = 'GROUP' | 'TASK' | 'MILESTONE';
export type ProjectTaskStatusValue =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'CANCELLED';

export interface UpdateProjectTaskInput {
  name: string;
  assigneeName?: string | null;
  type: ProjectTaskTypeValue;
  status: ProjectTaskStatusValue;
  durationDays?: number | null;
  totalQty?: number | null;
  completedQty?: number | null;
  completionPct?: number | null;
}

export const PROJECT_TASK_TYPE_OPTIONS: { value: ProjectTaskTypeValue; label: string }[] = [
  { value: 'GROUP', label: 'Group' },
  { value: 'TASK', label: 'Task' },
  { value: 'MILESTONE', label: 'Milestone' },
];

export const PROJECT_TASK_STATUS_OPTIONS: { value: ProjectTaskStatusValue; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PROJECT_TASK_TYPE_FROM_LABEL: Record<string, ProjectTaskTypeValue> = {
  Group: 'GROUP',
  Task: 'TASK',
  Milestone: 'MILESTONE',
};

const PROJECT_TASK_STATUS_FROM_LABEL: Record<string, ProjectTaskStatusValue> = {
  Pending: 'PENDING',
  'In Progress': 'IN_PROGRESS',
  Completed: 'COMPLETED',
  'On Hold': 'ON_HOLD',
  Cancelled: 'CANCELLED',
};

export function projectTaskTypeToApi(type: string): ProjectTaskTypeValue {
  return PROJECT_TASK_TYPE_FROM_LABEL[type] ?? 'TASK';
}

export function projectTaskStatusToApi(status: string): ProjectTaskStatusValue {
  return PROJECT_TASK_STATUS_FROM_LABEL[status] ?? 'PENDING';
}

export interface ProjectPreviewRow {
  startRow: number;
  code: string;
  name: string;
  assigneeName: string;
  durationDays: number | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  totalQty: number | null;
  completedQty: number | null;
  completionPct: number | null;
}

interface ApiErrorResponse {
  message?: string;
  error?: string;
}

interface FailedRow {
  row: number;
  reason: string;
}

export interface PreviewProjectResponse {
  success: boolean;
  status: number;
  message: string;
  data?: {
    sampleRows: ProjectPreviewRow[];
    taskCount: number;
  };
  failedRows?: FailedRow[];
}

export interface CreateProjectResponse {
  success: boolean;
  status: number;
  message: string;
  data?: {
    projectId: string;
    taskCount: number;
  };
  failedRows?: FailedRow[];
}

export function formatProjectApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: ApiErrorResponse } }).response;
    const message = response?.data?.message?.trim() || response?.data?.error?.trim();
    if (message) return message;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function formatProjectUploadErrorMessage(
  res: Pick<PreviewProjectResponse | CreateProjectResponse, 'message' | 'failedRows'>,
): string {
  const parts: string[] = [];
  if (res.message?.trim()) parts.push(res.message.trim());
  for (const row of res.failedRows ?? []) {
    if (row.reason && row.reason !== res.message) {
      parts.push(`Row ${row.row}: ${row.reason}`);
    }
  }
  return parts.join('\n') || 'Upload failed';
}

export async function fetchProjects(): Promise<{ data: ProjectListItem[] }> {
  const { data } = await apiClient.get<{
    success: boolean;
    data?: ProjectListItem[];
  }>('/project');
  return { data: data.data ?? [] };
}

export async function fetchProjectById(projectId: string): Promise<ProjectDetail | null> {
  const { data } = await apiClient.get<{
    success: boolean;
    data?: ProjectDetail;
    message?: string;
  }>(`/project/${projectId}`);
  return data.success ? data.data ?? null : null;
}

export async function fetchProjectTaskBranch(
  projectId: string,
  taskId: string,
): Promise<ProjectTaskBranch | null> {
  const { data } = await apiClient.get<{
    success: boolean;
    data?: ProjectTaskBranch;
    message?: string;
  }>(`/project/${projectId}/tasks/${taskId}`);
  return data.success ? data.data ?? null : null;
}

export async function updateProjectTask(
  projectId: string,
  taskId: string,
  input: UpdateProjectTaskInput,
): Promise<{ success: boolean; message: string; data?: ProjectTaskNode }> {
  const { data } = await apiClient.patch<{
    success: boolean;
    message?: string;
    data?: ProjectTaskNode;
  }>(`/project/${projectId}/tasks/${taskId}`, input);
  return {
    success: data.success,
    message: data.message ?? 'Update finished',
    data: data.data,
  };
}

export function formatProjectCompletion(value: number | null): string {
  if (value == null) return '—';
  return `${Number(value.toFixed(2))}%`;
}

export function formatProjectCreatedDate(value: string): string {
  return formatProjectDate(value);
}

export function formatProjectDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatProjectDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const startLabel = formatProjectDate(start);
  const endLabel = formatProjectDate(end);
  if (startLabel === '—' && endLabel === '—') return '—';
  if (startLabel !== '—' && endLabel !== '—') return `${startLabel} – ${endLabel}`;
  return startLabel !== '—' ? startLabel : endLabel;
}

export function formatProjectQty(value: number | null | undefined): string {
  if (value == null) return '—';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/\.?0+$/, '');
}

export async function previewProjectFile(file: File): Promise<PreviewProjectResponse> {
  const formData = new FormData();
  formData.append('projectReport', file);
  const res = await apiClient.post('/project/preview', formData, {
    validateStatus: () => true,
  });
  const data = res.data as Partial<PreviewProjectResponse & ApiErrorResponse>;
  if (typeof data?.success === 'boolean' && data.data) {
    return {
      success: data.success,
      status: data.status ?? res.status,
      message: data.message || 'Preview finished',
      data: data.data,
      failedRows: data.failedRows ?? [],
    };
  }
  const message =
    data?.message?.trim() || data?.error?.trim() || `Preview failed (HTTP ${res.status})`;
  return {
    success: false,
    status: res.status,
    message,
    failedRows: [{ row: 0, reason: message }],
  };
}

export async function createProjectFromFile(input: {
  file: File;
  name: string;
  description?: string;
}): Promise<CreateProjectResponse> {
  const formData = new FormData();
  formData.append('projectReport', input.file);
  formData.append('name', input.name.trim());
  if (input.description?.trim()) {
    formData.append('description', input.description.trim());
  }

  const res = await apiClient.post('/project', formData, {
    validateStatus: () => true,
  });
  const data = res.data as Partial<CreateProjectResponse & ApiErrorResponse>;
  if (typeof data?.success === 'boolean') {
    return {
      success: data.success,
      status: data.status ?? res.status,
      message: data.message || 'Create finished',
      data: data.data,
      failedRows: data.failedRows ?? [],
    };
  }
  const message =
    data?.message?.trim() || data?.error?.trim() || `Create failed (HTTP ${res.status})`;
  return {
    success: false,
    status: res.status,
    message,
    failedRows: [{ row: 0, reason: message }],
  };
}

export function projectNameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.xlsx$/i, '').trim();
  if (!base) return 'New Project';
  return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}
