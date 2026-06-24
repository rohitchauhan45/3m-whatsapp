import { apiClient, getApiErrorMessage } from '@/lib/api/client';

export interface LoginCredentials {
  identifier: string;
  password: string;
}

export interface SignupData {
  name: string;
  number: string;
  email: string;
  password: string;
  role?: string;
}

export interface AuthResponse {
  token?: string;
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    name?: string;
    image_url?: string;
    [key: string]: unknown;
  };
  requires_verification?: boolean;
  message?: string;
  email?: string;
  tempUserId?: number;
}

export interface ErrorResponse {
  error: string;
  message?: string;
  requiresVerification?: boolean;
  email?: string;
}

export interface ApiMessage {
  message: string;
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Login failed'));
  }
}

export async function signup(data: SignupData): Promise<AuthResponse> {
  try {
    const { data: result } = await apiClient.post<AuthResponse>('/auth/signup', data);
    return result;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Signup failed'));
  }
}

export async function verifyEmail(email: string, code?: string): Promise<AuthResponse> {
  try {
    const { data } = await apiClient.post<AuthResponse>(
      '/auth/verify-email',
      code ? { email, code } : { email },
    );
    return data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Email verification failed'));
  }
}

export async function resendVerification(email: string): Promise<void> {
  try {
    await apiClient.post('/auth/resend-verification', { email });
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to resend verification code'));
  }
}

export async function getMe(token: string): Promise<AuthResponse['user']> {
  try {
    const { data } = await apiClient.get<AuthResponse['user']>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to get user profile'));
  }
}

export async function forgotPassword(
  email: string,
): Promise<{ success: boolean; message: string; token?: string }> {
  try {
    const { data } = await apiClient.post<{ success: boolean; message: string; token?: string }>(
      '/auth/forget-password',
      { email },
    );
    return data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to send reset link'));
  }
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const { data } = await apiClient.post<{ success: boolean; message: string }>(
      '/auth/reset-password',
      { token, password },
    );
    return data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to reset password'));
  }
}

export async function verifyOtp(
  token: string,
  otp: number,
): Promise<{
  success: boolean;
  message: string;
  userId?: string;
  userRole?: string;
  email?: string;
}> {
  try {
    const { data } = await apiClient.post<{
      success: boolean;
      message: string;
      userId?: string;
      userRole?: string;
      email?: string;
    }>('/auth/verify-otp', { token, otp });
    return data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to verify otp'));
  }
}

export async function verifyToken(token: string): Promise<AuthResponse> {
  try {
    const { data } = await apiClient.get<AuthResponse>('/auth/verify-email', {
      params: { token },
    });
    return data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to verify email'));
  }
}

export function storeToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token);
  }
}

export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_token');
  }
  return null;
}

export function removeToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
  }
}
