import { apiClient } from '@/lib/api/client';

// ─── Types ───

export interface AdminTaskDay {
  date: string;
  label: string;
  taskCount: number;
  userCount: number;
  managerCount: number;
  tasks: AdminTask[];
}

export interface AdminTask {
  id: string;
  name: string;
  status: string;
  accept: string;
  completedByTime: string;
  userName: string;
  managerName: string;
}

export interface GetAllTasksResponse {
  success: boolean;
  status: number;
  message: string;
  days: AdminTaskDay[];
}

export interface CreateTaskResponse {
  success: boolean;
  status: number;
  message: string;
  processed: number;
  failedRows: { row: number; reason: string }[];
}

export interface TaskImportRow {
  startRow: number;
  date: string;
  name: string;
  number: string;
  email?: string;
  managerName: string;
  managerMobile: string;
  taskName: string;
  rawStartTime: string;
  rawEndTime: string;
}

/** Preview-only row: user + task fields; excel metadata is optional until Create. */
export type TaskPreviewRow = {
  id: string;
  name: string;
  number: string;
  taskName: string;
  rawStartTime: string;
  rawEndTime: string;
} & Partial<Pick<TaskImportRow, 'startRow' | 'date' | 'email' | 'managerName' | 'managerMobile'>>;

export function enrichPreviewRowsForCreate(rows: TaskPreviewRow[]): TaskImportRow[] {
  const metaByUser = new Map<
    string,
    Pick<TaskImportRow, 'startRow' | 'date' | 'email' | 'managerName' | 'managerMobile'>
  >();

  for (const row of rows) {
    const key = `${row.number}|${row.name}`;
    if (metaByUser.has(key)) continue;
    if (row.date && row.managerName && row.managerMobile && row.startRow != null) {
      metaByUser.set(key, {
        startRow: row.startRow,
        date: row.date,
        email: row.email,
        managerName: row.managerName,
        managerMobile: row.managerMobile,
      });
    }
  }

  return rows.map((row) => {
    const key = `${row.number}|${row.name}`;
    const meta = metaByUser.get(key);
    return {
      startRow: row.startRow ?? meta?.startRow ?? 0,
      date: row.date ?? meta?.date ?? '',
      name: row.name,
      number: row.number,
      email: row.email ?? meta?.email,
      managerName: row.managerName ?? meta?.managerName ?? '',
      managerMobile: row.managerMobile ?? meta?.managerMobile ?? '',
      taskName: row.taskName,
      rawStartTime: row.rawStartTime,
      rawEndTime: row.rawEndTime,
    };
  });
}

export interface PreviewTaskResponse {
  success: boolean;
  status: number;
  message: string;
  rows: TaskImportRow[];
  failedRows: { row: number; reason: string }[];
}

type ApiErrorResponse = {
  error?: string;
  message?: string;
};

export interface FollowUpResponse {
  success: boolean;
  status: number;
  message: string;
  sent: number;
  skippedNoPhone: number;
  skippedNoTasks: number;
  failedSends: number;
  managerSummarySent: boolean;
}

// ─── API calls ───

export async function fetchAllTasks(): Promise<GetAllTasksResponse> {
  const { data } = await apiClient.get<GetAllTasksResponse>('/admin/tasks');
  return data;
}

export function formatUploadErrorMessage(
  res: Pick<CreateTaskResponse, 'message' | 'failedRows'> | Pick<PreviewTaskResponse, 'message' | 'failedRows'>,
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

export async function previewTaskFile(file: File): Promise<PreviewTaskResponse> {
  const formData = new FormData();
  formData.append('assignTask', file);
  const res = await apiClient.post('/task/preview-task', formData, {
    validateStatus: () => true,
  });
  const data = res.data as Partial<PreviewTaskResponse & ApiErrorResponse>;
  if (typeof data?.success === 'boolean' && Array.isArray(data.rows)) {
    return {
      success: data.success,
      status: data.status ?? res.status,
      message: data.message || 'Preview finished',
      rows: data.rows,
      failedRows: data.failedRows ?? [],
    };
  }
  const message = data?.message?.trim() || data?.error?.trim() || `Preview failed (HTTP ${res.status})`;
  return {
    success: false,
    status: res.status,
    message,
    rows: [],
    failedRows: [{ row: 0, reason: message }],
  };
}

export async function createTasksFromPreview(rows: TaskImportRow[]): Promise<CreateTaskResponse> {
  const res = await apiClient.post('/task/create-task', { rows }, {
    validateStatus: () => true,
  });
  const data = res.data as Partial<CreateTaskResponse & ApiErrorResponse>;
  if (typeof data?.success === 'boolean') {
    return {
      success: data.success,
      status: data.status ?? res.status,
      message: data.message || 'Create finished',
      processed: data.processed ?? 0,
      failedRows: data.failedRows ?? [],
    };
  }
  const message = data?.message?.trim() || data?.error?.trim() || `Create failed (HTTP ${res.status})`;
  return {
    success: false,
    status: res.status,
    message,
    processed: 0,
    failedRows: [{ row: 0, reason: message }],
  };
}

export async function uploadTaskFile(file: File): Promise<CreateTaskResponse> {
  const formData = new FormData();
  formData.append('assignTask', file);
  try {
    const res = await apiClient.post('/task/create-task', formData, {
      validateStatus: () => true,
    });
    const data = res.data as Partial<CreateTaskResponse & ApiErrorResponse>;

    if (typeof data?.success === 'boolean') {
      return {
        success: data.success,
        status: data.status ?? res.status,
        message: data.message || 'Upload finished',
        processed: data.processed ?? 0,
        failedRows: data.failedRows ?? [],
      };
    }

    const message =
      data?.message?.trim() ||
      data?.error?.trim() ||
      `Upload failed (HTTP ${res.status})`;

    return {
      success: false,
      status: res.status,
      message,
      processed: 0,
      failedRows: [{ row: 0, reason: message }],
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Upload failed';
    return {
      success: false,
      status: 500,
      message,
      processed: 0,
      failedRows: [{ row: 0, reason: message }],
    };
  }
}

export async function sendFollowUp(managerId: string): Promise<FollowUpResponse> {
  const { data } = await apiClient.post<FollowUpResponse>(
    `/task/manager/${managerId}/follow-up`,
  );
  return data;
}
