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

export interface CronJob {
  id: string;
  name: string;
  time: string;
  createdAt: string;
  updatedAt: string;
  updateById: string;
}

export interface CronJobResponse {
  success: boolean;
  status: number;
  message: string;
  data: CronJob[];
}

export interface UpdateCronResponse {
  success: boolean;
  status?: number;
  message: string;
  data?: CronJob;
}

export async function fetchCronjobs(): Promise<CronJobResponse> {
  const { data } = await api.get<CronJobResponse>("/api/v1/admin/cronjobs");
  return data;
}

export async function updateCronjob(id: string, name: string, time: string): Promise<UpdateCronResponse> {
  const { data } = await api.put<UpdateCronResponse>(`/api/v1/admin/cronjobs/${id}`, { name, time });
  return data;
}
