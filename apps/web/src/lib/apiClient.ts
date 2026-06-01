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
): Promise<T> {
  const { method = "GET", body, timeoutMs = 8000, signal } = options;
  const response = await fetch(resolveUrl(workerUrl, path), {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
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
): Promise<T> {
  return apiRequest<T>(workerUrl, path, { timeoutMs });
}

export function apiPost<T>(
  workerUrl: string,
  path: string,
  timeoutMs = 8000,
): Promise<T> {
  return apiRequest<T>(workerUrl, path, { method: "POST", timeoutMs });
}
