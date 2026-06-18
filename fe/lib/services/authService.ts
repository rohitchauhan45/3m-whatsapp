const AUTH_SERVER_URL =
  process.env.NEXT_PUBLIC_AUTH_SERVER_URL || "http://localhost:4000";

/**
 * Safely parse JSON response, handling empty or invalid responses
 */
async function parseJsonResponse(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type");

  if (contentType && contentType.includes("application/json")) {
    try {
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    } catch (error) {
      // If JSON parsing fails, return empty object
      return {};
    }
  }

  return {};
}

export interface LoginCredentials {
  identifier: string; // email or username
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

/**
 * Login user with email/username and password
 */
export async function login(
  credentials: LoginCredentials,
): Promise<AuthResponse> {
  const response = await fetch(`${AUTH_SERVER_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || data.message || "Login failed");
  }

  return data as AuthResponse;
}

/**
 * Sign up a new user
 */
export async function signup(data: SignupData): Promise<AuthResponse> {
  const response = await fetch(`${AUTH_SERVER_URL}/api/v1/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(result.error || result.message || "Signup failed");
  }

  // If verification is required, return the response with that info
  if (result.requires_verification) {
    return result;
  }

  return result as AuthResponse;
}

/**
 * Verify email with verification code
 */
export async function verifyEmail(
  email: string,
  code?: string
): Promise<AuthResponse> {
  const response = await fetch(`${AUTH_SERVER_URL}/api/v1/auth/verify-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(code ? { email, code } : { email }),
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || data.message || "Email verification failed");
  }

  return data as AuthResponse;
}

/**
 * Resend verification code
 */
export async function resendVerification(email: string): Promise<void> {
  const response = await fetch(
    `${AUTH_SERVER_URL}/api/v1/auth/resend-verification`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    },
  );

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || data.message || "Failed to resend verification code");
  }
}

/**
 * Get current user profile (requires token)
 */
export async function getMe(token: string): Promise<AuthResponse["user"]> {
  const response = await fetch(`${AUTH_SERVER_URL}/api/v1/auth/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || data.message || "Failed to get user profile");
  }

  return data;
}

/**
 * Request password reset email
 */
export async function forgotPassword(email: string): Promise<{ success: boolean; message: string; token?: string }> {
  const response = await fetch(`${AUTH_SERVER_URL}/api/v1/auth/forget-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || data.message || "Failed to send reset link");
  }

  return data as { success: boolean; message: string; token?: string };
}

/**
 * Reset password using token from email
 */
export async function resetPassword(
  token: string,
  password: string,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${AUTH_SERVER_URL}/api/v1/auth/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, password }),
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || data.message || "Failed to reset password");
  }

  return data as { success: boolean; message: string };
}

//verify-otp
export async function verifyOtp(token: string, otp: number): Promise<{ success: boolean; message: string; userId?: string; userRole?: string; email?: string }> {
  const response = await fetch(`${AUTH_SERVER_URL}/api/v1/auth/verify-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, otp }),
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data.error || data.message || "Failed to verify otp");
  }
  return data as { success: boolean; message: string; userId?: string; userRole?: string; email?: string };
}

/**
 * Verify email when user clicks emailed link (?token=)
 */
export async function verifyToken(token: string): Promise<AuthResponse> {
  const response = await fetch(
    `${AUTH_SERVER_URL}/api/v1/auth/verify-email?token=${token}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || data.message || "Failed to verify email");
  }

  return data as AuthResponse;
}

/**
 * Store token in localStorage
 */
export function storeToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("auth_token", token);
  }
}

/**
 * Get token from localStorage
 */
export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("auth_token");
  }
  return null;
}

/**
 * Remove token from localStorage
 */
export function removeToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth_token");
  }
}

