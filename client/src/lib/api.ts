import type { ScoringResult } from "./types";

const API_BASE = "/api";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
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

export const api = {
  // Sessions
  createSession: (data: {
    jobTitle: string;
    companyName: string;
    jobDescription: string;
    cvContent?: string;
    interviewType: "HR" | "TECHNICAL";
    personaId: string;
    duration?: number;
  }) => request("/sessions", { method: "POST", body: JSON.stringify(data) }),

  getSession: (id: string) => request(`/sessions/${id}`),

  scoreSession: (id: string) =>
    request<ScoringResult>(`/sessions/${id}/score`, { method: "POST" }),

  // Health check
  health: () => request<{ status: string }>("/health"),
};
