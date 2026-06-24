import axios, { type AxiosError } from 'axios';

function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_AUTH_SERVER_URL is not set');
  }
  return url.replace(/\/$/, '');
}

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    return data?.error || data?.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export type { AxiosError };
