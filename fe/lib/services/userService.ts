const AUTH_SERVER_URL =
  process.env.NEXT_PUBLIC_AUTH_SERVER_URL || "http://localhost:4000";

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

/**
 * Get all users with pagination and search (admin only)
 */
export async function getAllUsers(
  token: string,
  options: { page?: number; limit?: number; search?: string } = {}
): Promise<UsersResponse> {
  const { page = 1, limit = 10, search = "" } = options;
  const queryParams = new URLSearchParams();
  
  if (page) queryParams.append("page", page.toString());
  if (limit) queryParams.append("limit", limit.toString());
  if (search) queryParams.append("search", search);

  const queryString = queryParams.toString();
  const url = `${AUTH_SERVER_URL}/api/v1/user${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch users");
  }

  return data as UsersResponse;
}

/**
 * Create a new user (admin only)
 */
export async function createUser(
  token: string,
  userData: CreateUserData
): Promise<User> {
  const response = await fetch(`${AUTH_SERVER_URL}/api/v1/user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to create user");
  }

  return data as User;
}

/**
 * Update a user (admin only)
 */
export async function updateUser(
  token: string,
  userId: string,
  userData: UpdateUserData
): Promise<User> {
  const response = await fetch(`${AUTH_SERVER_URL}/api/v1/user/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to update user");
  }

  return data as User;
}

/**
 * Delete a user (admin only)
 */
export async function deleteUser(
  token: string,
  userId: string
): Promise<void> {
  const response = await fetch(`${AUTH_SERVER_URL}/api/v1/user/${userId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to delete user");
  }
}