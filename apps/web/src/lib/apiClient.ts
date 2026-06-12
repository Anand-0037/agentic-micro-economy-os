export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
};

function resolveUrl(workerUrl: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const base = workerUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiRequest<T>(
  workerUrl: string,
  path: string,
  options: ApiRequestOptions = {},
  apiKey?: string,
): Promise<T> {
  const isDevMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("dev") === "1";
  const isForceArchived =
    isDevMode &&
    typeof window !== "undefined" &&
    (new URLSearchParams(window.location.search).get("archived") === "1" ||
      localStorage.getItem("ameo.force_archived") === "true");
  if (isForceArchived) {
    throw new ApiError(`Forced archived proof view enabled`, 503);
  }

  const { method = "GET", body, timeoutMs = 8000, signal } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (apiKey) {
    headers["X-API-KEY"] = apiKey;
  }
  const response = await fetch(resolveUrl(workerUrl, path), {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: signal ?? AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new ApiError(`Request failed (${response.status}) for ${path}`, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function apiGet<T>(
  workerUrl: string,
  path: string,
  timeoutMs = 8000,
  apiKey?: string,
): Promise<T> {
  return apiRequest<T>(workerUrl, path, { timeoutMs }, apiKey);
}

export function apiPost<T>(
  workerUrl: string,
  path: string,
  timeoutMs = 8000,
  apiKey?: string,
): Promise<T> {
  return apiRequest<T>(workerUrl, path, { method: "POST", timeoutMs }, apiKey);
}
