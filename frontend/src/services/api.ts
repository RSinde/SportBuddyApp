import { auth } from '@/config/firebase';

// On Android emulator 'localhost' refers to the emulator itself, not your computer —
// use 10.0.2.2 there. On a physical device, use your computer's LAN IP.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  { body, headers, ...options }: RequestOptions = {},
  forceRefresh = false
): Promise<T> {
  const token = await auth.currentUser?.getIdToken(forceRefresh);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Token expirado ou inválido — tenta uma vez com token forçado
  if (response.status === 401 && !forceRefresh) {
    return request<T>(path, { body, headers, ...options }, true);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new ApiError(
      errorBody?.message ?? `Request failed with status ${response.status}`,
      response.status
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => {
    const sep = path.includes('?') ? '&' : '?';
    return request<T>(`${path}${sep}_t=${Date.now()}`, { cache: 'no-store' });
  },
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
};
