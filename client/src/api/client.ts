import type { ComparisonResult, TaxProfile } from "../types";

const TOKEN_KEY = "incometax_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed with status ${res.status}`, res.status);
  }
  return data as T;
}

export interface AuthResponse {
  token: string;
  user: { id: number; email: string; name: string };
}

export const api = {
  register: (email: string, password: string, name: string) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  listReturns: () => request<{ financialYear: string; updatedAt: string; profile: TaxProfile }[]>("/returns"),
  getReturn: (fy: string) => request<{ profile: TaxProfile }>(`/returns/${fy}`),
  saveReturn: (fy: string, profile: TaxProfile) =>
    request<{ profile: TaxProfile; comparison: ComparisonResult }>(`/returns/${fy}`, {
      method: "PUT",
      body: JSON.stringify(profile),
    }),
  compute: (fy: string, profile: TaxProfile) =>
    request<{ comparison: ComparisonResult }>(`/returns/${fy}/compute`, {
      method: "POST",
      body: JSON.stringify(profile),
    }),

  chatHistory: () => request<{ messages: { role: "user" | "assistant"; content: string; created_at: string }[] }>("/ai/chat"),
  sendChat: (message: string, financialYear?: string) =>
    request<{ reply: string }>("/ai/chat", { method: "POST", body: JSON.stringify({ message, financialYear }) }),
  suggestDeductions: (fy: string) => request<{ suggestions: string }>(`/ai/suggest-deductions/${fy}`),
};

export { ApiError };
