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

  scoreSession: async (id: string): Promise<ScoringResult> => {
    // Poll until scoring completes (server returns 202 while per-question scoring is running)
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      const res = await fetch(`${API_BASE}/sessions/${id}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 202) {
        // Scoring in progress — wait and retry
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || `Scoring failed: ${res.status}`);
      }

      return res.json() as Promise<ScoringResult>;
    }
    throw new Error("Scoring timed out — per-question scoring took too long");
  },

  // Health check
  health: () => request<{ status: string }>("/health"),
};
