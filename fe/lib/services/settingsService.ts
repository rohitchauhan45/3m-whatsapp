import { apiClient } from '@/lib/api/client';

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
  const { data } = await apiClient.get<CronJobResponse>('/admin/cronjobs');
  return data;
}

export async function updateCronjob(
  id: string,
  name: string,
  time: string,
): Promise<UpdateCronResponse> {
  const { data } = await apiClient.put<UpdateCronResponse>(`/admin/cronjobs/${id}`, {
    name,
    time,
  });
  return data;
}
