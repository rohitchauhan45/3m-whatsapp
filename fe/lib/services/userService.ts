import { apiClient, getApiErrorMessage } from '@/lib/api/client';

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  role_name?: string;
  name?: string;
  image_url?: string;
  [key: string]: unknown;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UsersResponse {
  users: User[];
  pagination: PaginationInfo;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  role_name: string;
  name?: string;
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  password?: string;
  role_name?: string;
  name?: string;
}

export async function getAllUsers(
  token: string,
  options: { page?: number; limit?: number; search?: string } = {},
): Promise<UsersResponse> {
  const { page = 1, limit = 10, search = '' } = options;

  try {
    const { data } = await apiClient.get<UsersResponse>('/user', {
      params: { page, limit, search: search || undefined },
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to fetch users'));
  }
}

export async function createUser(token: string, userData: CreateUserData): Promise<User> {
  try {
    const { data } = await apiClient.post<User>('/user', userData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to create user'));
  }
}

export async function updateUser(
  token: string,
  userId: string,
  userData: UpdateUserData,
): Promise<User> {
  try {
    const { data } = await apiClient.put<User>(`/user/${userId}`, userData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to update user'));
  }
}

export async function deleteUser(token: string, userId: string): Promise<void> {
  try {
    await apiClient.delete(`/user/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to delete user'));
  }
}
