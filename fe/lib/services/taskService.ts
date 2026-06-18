import axios from "axios";
import { getToken } from "./authService";

const API_URL =
  process.env.NEXT_PUBLIC_AUTH_SERVER_URL || "http://localhost:4000";

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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
  const { data } = await api.get<GetAllTasksResponse>("/api/v1/admin/tasks");
  return data;
}

export function formatUploadErrorMessage(res: CreateTaskResponse): string {
  const parts: string[] = [];
  if (res.message?.trim()) parts.push(res.message.trim());
  for (const row of res.failedRows ?? []) {
    if (row.reason && row.reason !== res.message) {
      parts.push(`Row ${row.row}: ${row.reason}`);
    }
  }
  return parts.join("\n") || "Upload failed";
}

export async function uploadTaskFile(file: File): Promise<CreateTaskResponse> {
  const formData = new FormData();
  formData.append("assignTask", file);
  try {
    const res = await api.post("/api/v1/task/create-task", formData, {
      validateStatus: () => true,
    });
    const data = res.data as Partial<CreateTaskResponse & ApiErrorResponse>;

    if (typeof data?.success === "boolean") {
      return {
        success: data.success,
        status: data.status ?? res.status,
        message: data.message || "Upload finished",
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
    const message = e instanceof Error ? e.message : "Upload failed";
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
  const { data } = await api.post<FollowUpResponse>(`/api/v1/task/manager/${managerId}/follow-up`);
  return data;
}
