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

const AUTH_TOKEN_STORAGE_KEY = "finova:authToken";
let cachedToken: string | null | undefined;

function readStoredToken(): string | null {
  if (cachedToken !== undefined) {
    return cachedToken;
  }
  if (typeof window === "undefined") {
    return null;
  }
  cachedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  return cachedToken;
}

export function getAuthToken(): string | null {
  return readStoredToken();
}

export function setAuthToken(token: string | null) {
  if (typeof token === "string" && token) {
    cachedToken = token;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    }
    return;
  }

  cachedToken = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }
}

export function clearAuthToken() {
  setAuthToken(null);
}

function toHeaderRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (Array.isArray(headers)) {
    return headers.reduce<Record<string, string>>((accumulator, [key, value]) => {
      if (key) {
        accumulator[key] = String(value);
      }
      return accumulator;
    }, {});
  }

  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }

  return { ...(headers as Record<string, string>) };
}

function buildHeaders(body: BodyInit | null | undefined, headers?: HeadersInit, skipAuth?: boolean): Record<string, string> {
  const record = toHeaderRecord(headers);
  const hasContentType = "Content-Type" in record || "content-type" in record;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  if (!isFormData && !hasContentType) {
    record["Content-Type"] = "application/json";
  }

  if (!skipAuth) {
    const token = getAuthToken();
    if (token) {
      record.Authorization = `Token ${token}`;
    }
  }

  return record;
}

function handleUnauthorized(skipRedirect?: boolean) {
  // Dropping the stored token keeps auth functional when browsers block third-party cookies.
  clearAuthToken();
  if (skipRedirect) {
    return;
  }
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.replace("/login");
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

type RequestOptions = RequestInit & { skipJson?: boolean; skipAuth?: boolean; skipAuthRedirect?: boolean };

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipJson, skipAuth, skipAuthRedirect, headers, ...rest } = options;
  const normalizedPath = normalizePath(path);
  const requestHeaders = buildHeaders(rest.body as BodyInit | null | undefined, headers, skipAuth);
  const response = await fetch(`${apiBase}${normalizedPath}`, {
    ...rest,
    headers: requestHeaders,
  });

  if (response.status === 204 || skipJson) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await response.json() : undefined;

  if (response.status === 401) {
    handleUnauthorized(skipAuthRedirect);
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
  async login(username: string, password: string) {
    return apiFetch<{ token: string; user: UserProfile }>("/auth/login/", {
      method: "POST",
      skipAuth: true,
      skipAuthRedirect: true,
      body: JSON.stringify({ username, password }),
    });
  },
  async register(username: string, password: string, email?: string) {
    return apiFetch<{ token: string; user: UserProfile }>("/auth/register/", {
      method: "POST",
      skipAuth: true,
      skipAuthRedirect: true,
      body: JSON.stringify({ username, password, email }),
    });
  },
  async logout() {
    await apiFetch("/auth/logout/", { method: "POST", body: JSON.stringify({}) });
  },
  async me(): Promise<{ user: UserProfile }> {
    return apiFetch<{ user: UserProfile }>("/auth/me/");
  },
};

export const analysisApi = {
  async analyze(file: File, includeExplanation = true): Promise<AnalysisPayload> {
    const formData = new FormData();
    formData.append("file", file);
    const endpoint = includeExplanation ? "/analyze/?explain=1" : "/analyze/";

    const headers = buildHeaders(formData, undefined, false);
    // Token header keeps uploads authenticated without relying on third-party cookies.
    const response = await fetch(`${apiBase}${normalizePath(endpoint)}`, {
      method: "POST",
      body: formData,
      headers,
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : undefined;

    if (response.status === 401) {
      handleUnauthorized();
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
