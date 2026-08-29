const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_BASE_URL = configuredApiUrl?.replace(/\/+$/, '') ?? '';

let sessionToken: string | null = null;

export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  /** JSON-serialisable data or FormData. */
  body?: unknown;
  /** Set false for public endpoints such as login and registration. */
  authenticated?: boolean;
  /** Overrides the current session token for this request. */
  token?: string | null;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly payload?: unknown;

  constructor(message: string, status: number, code?: string, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export function setApiSessionToken(token: string | null) {
  sessionToken = token;
}

export function getApiSessionToken() {
  return sessionToken;
}

export async function apiRequest<Response>(path: string, options: ApiRequestOptions = {}): Promise<Response> {
  const url = resolveApiUrl(path);
  const {
    authenticated = true,
    body: requestBody,
    headers: requestHeaders,
    token: tokenOverride,
    ...requestInit
  } = options;
  const headers = new Headers(requestHeaders);
  const token = tokenOverride === undefined ? sessionToken : tokenOverride;
  const isFormData = typeof FormData !== 'undefined' && requestBody instanceof FormData;
  let body: BodyInit | undefined;

  if (requestBody !== undefined && requestBody !== null) {
    if (isFormData) {
      body = requestBody as FormData;
    } else {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(requestBody);
    }
  }

  headers.set('Accept', 'application/json');
  if (authenticated && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...requestInit,
    body,
    headers,
  });
  const payload = await readPayload(response);

  if (!response.ok) {
    const details = readErrorDetails(payload);
    throw new ApiError(details.message ?? `Request failed (${response.status})`, response.status, details.code, payload);
  }

  return payload as Response;
}

export const api = {
  get<Response>(path: string, options?: Omit<ApiRequestOptions, 'body' | 'method'>) {
    return apiRequest<Response>(path, { ...options, method: 'GET' });
  },
  post<Response>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'body' | 'method'>) {
    return apiRequest<Response>(path, { ...options, body, method: 'POST' });
  },
  patch<Response>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'body' | 'method'>) {
    return apiRequest<Response>(path, { ...options, body, method: 'PATCH' });
  },
  put<Response>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'body' | 'method'>) {
    return apiRequest<Response>(path, { ...options, body, method: 'PUT' });
  },
  delete<Response>(path: string, options?: Omit<ApiRequestOptions, 'body' | 'method'>) {
    return apiRequest<Response>(path, { ...options, method: 'DELETE' });
  },
};

export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return fallback;
}

function resolveApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not configured. Add it to your Expo environment and restart the app.');
  }
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function readErrorDetails(payload: unknown): { code?: string; message?: string } {
  if (!payload || typeof payload !== 'object') {
    return typeof payload === 'string' ? { message: payload } : {};
  }

  const value = payload as Record<string, unknown>;
  const nested = value.error && typeof value.error === 'object'
    ? value.error as Record<string, unknown>
    : undefined;

  return {
    code: asString(nested?.code) ?? asString(value.code),
    message: asString(nested?.message) ?? asString(value.message) ?? asString(value.error),
  };
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
