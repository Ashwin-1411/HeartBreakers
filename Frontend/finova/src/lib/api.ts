export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://heartbreakers.onrender.com";

const SESSION_KEY_STORAGE = "finova:sessionKey";
let inMemorySessionKey: string | null | undefined;

function readStoredSessionKey(): string | null {
  if (inMemorySessionKey !== undefined) {
    return inMemorySessionKey;
  }
  if (typeof window === "undefined") {
    return null;
  }
  inMemorySessionKey = window.localStorage.getItem(SESSION_KEY_STORAGE);
  return inMemorySessionKey;
}

function persistSessionKey(key: string | null | undefined) {
  if (typeof key === "string" && key) {
    inMemorySessionKey = key;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_KEY_STORAGE, key);
    }
    return;
  }
  if (key === null) {
    inMemorySessionKey = null;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_KEY_STORAGE);
    }
  }
}

function clearSessionKey() {
  persistSessionKey(null);
}

function mergeHeaders(headers?: HeadersInit): Record<string, string> {
  const result: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (headers) {
    if (Array.isArray(headers)) {
      for (const [key, value] of headers) {
        if (typeof key === "string") {
          result[key] = String(value);
        }
      }
    } else if (typeof Headers !== "undefined" && headers instanceof Headers) {
      headers.forEach((value, key) => {
        result[key] = value;
      });
    } else {
      Object.assign(result, headers as Record<string, string>);
    }
  }

  const sessionKey = readStoredSessionKey();
  if (sessionKey) {
    result["X-Session-Key"] = sessionKey;
  }

  return result;
}

function updateSessionKeyFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return;
  }
  const nextKey = (payload as { sessionKey?: unknown }).sessionKey;
  if (typeof nextKey === "string" && nextKey) {
    persistSessionKey(nextKey);
  } else if (nextKey === null) {
    clearSessionKey();
  }
}

function resolveApiBase(urlString: string): string {
  try {
    const url = new URL(urlString);
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/api";
    }
    return url.toString().replace(/\/$/, "");
  } catch (error) {
    const sanitized = urlString.replace(/\/$/, "");
    return sanitized.endsWith("/api") ? sanitized : `${sanitized}/api`;
  }
}

const apiBase = resolveApiBase(configuredBaseUrl);

function normalizePath(path: string): string {
  if (!path) {
    return "/";
  }

  const [rawPath, query = ""] = path.split("?");
  const trimmed = rawPath.trim();
  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withTrailingSlash = prefixed.endsWith("/") ? prefixed : `${prefixed}/`;

  return query ? `${withTrailingSlash}?${query}` : withTrailingSlash;
}

type RequestOptions = RequestInit & { skipJson?: boolean };

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipJson, headers, ...rest } = options;
  const normalizedPath = normalizePath(path);
  const response = await fetch(`${apiBase}${normalizedPath}`, {
    credentials: "include",
    ...rest,
    headers: mergeHeaders(headers),
  });

  if (response.status === 204 || skipJson) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await response.json() : undefined;

  if (isJson) {
    updateSessionKeyFromPayload(data);
  }

  if (!response.ok) {
    const message = (data as { error?: string; message?: string } | undefined)?.error ||
      (data as { message?: string } | undefined)?.message ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export interface UserProfile {
  id: number;
  username: string;
  email?: string | null;
}

export interface SessionPayload {
  authenticated: boolean;
  user?: UserProfile;
  csrfToken?: string;
  sessionKey?: string | null;
}

export interface ReasonedStat {
  attribute?: string;
  issue?: string;
  severity?: string;
  violation_rate?: number;
  dimensions?: string[];
  impacts?: string[];
  rule?: string;
  title?: string;
  description?: string;
  message?: string;
}

export interface Recommendation {
  priority: string;
  dimension: string;
  action: string;
}

export interface AnalysisPayload {
  analysis_id: number;
  dataset: { rows: number; columns: number };
  overall_dqs: number;
  reasoned_stats: ReasonedStat[];
  summary?: string | null;
  dimension_scores: Record<string, number>;
  genai_summary?: string;
  genai_recommendations?: Recommendation[];
  genai_safety_note?: string;
  context_bundle: Record<string, unknown>;
}

export interface HistoryItem {
  id: number;
  dataset_name: string;
  created_at: string;
  overall_dqs: number;
}

export interface HistoryListResponse {
  results: HistoryItem[];
}

export interface HistoryDetailResponse extends HistoryItem {
  dimension_scores: Record<string, number>;
  reasoned_stats: ReasonedStat[];
  genai_summary?: string | null;
  genai_recommendations: Recommendation[];
}

export interface TrendResponse {
  overall_trend: "improving" | "degrading" | "stable";
  delta: number;
  dimension_trends: Record<string, "up" | "down" | "same">;
  timeline: HistoryItem[];
}

export const authApi = {
  async session(): Promise<SessionPayload> {
    return apiFetch<SessionPayload>("/auth/session/");
  },
  async login(username: string, password: string) {
    return apiFetch<{ user: UserProfile; sessionKey?: string }>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },
  async register(username: string, password: string, email?: string) {
    return apiFetch<{ user: UserProfile; sessionKey?: string }>("/auth/register/", {
      method: "POST",
      body: JSON.stringify({ username, password, email }),
    });
  },
  async logout() {
    await apiFetch("/auth/logout/", { method: "POST", body: JSON.stringify({}) });
    clearSessionKey();
  },
};

export const analysisApi = {
  async analyze(file: File, includeExplanation = true): Promise<AnalysisPayload> {
    const formData = new FormData();
    formData.append("file", file);
    const endpoint = includeExplanation ? "/analyze/?explain=1" : "/analyze/";

    const sessionKey = readStoredSessionKey();
    const response = await fetch(`${apiBase}${normalizePath(endpoint)}`, {
      method: "POST",
      credentials: "include",
      body: formData,
      headers: sessionKey ? { "X-Session-Key": sessionKey } : undefined,
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : undefined;

    if (contentType.includes("application/json")) {
      updateSessionKeyFromPayload(data);
    }

    if (!response.ok) {
      const message = (data && (data.error || data.message)) || "Failed to analyze dataset";
      throw new ApiError(message, response.status, data);
    }

    return data as AnalysisPayload;
  },

  async history(): Promise<HistoryListResponse> {
    return apiFetch<HistoryListResponse>("/history/");
  },

  async historyDetail(id: string | number): Promise<HistoryDetailResponse> {
    return apiFetch<HistoryDetailResponse>(`/history/${id}/`);
  },

  async trend(): Promise<TrendResponse> {
    return apiFetch<TrendResponse>("/trend/");
  },

  async health(): Promise<{ status: string; ontology_loaded: boolean }> {
    return apiFetch<{ status: string; ontology_loaded: boolean }>("/health/");
  },

  async chat(message: string, context?: unknown): Promise<{ response: string }> {
    return apiFetch<{ response: string }>("/chat/", {
      method: "POST",
      body: JSON.stringify({ message, context }),
    });
  },
};
