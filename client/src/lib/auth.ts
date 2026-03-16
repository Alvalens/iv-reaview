const API_BASE = import.meta.env.VITE_BASE_API_URL || "http://localhost:8080/api";

export interface User {
  id: string;
  username: string;
  createdAt?: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export interface MeResponse {
  user: User;
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  // Get token from localStorage
  const token = localStorage.getItem("token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add Authorization header if token exists
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...headers,
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const authApi = {
  register: async (username: string, password: string): Promise<AuthResponse> => {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },

  login: async (username: string, password: string): Promise<AuthResponse> => {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },

  me: async (): Promise<MeResponse> => {
    return request("/auth/me");
  },
};
