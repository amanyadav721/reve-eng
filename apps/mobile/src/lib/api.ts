import { useAuth } from '@clerk/expo';
import { useCallback, useRef } from 'react';

// Talks to our API (apps/api) as the signed-in traveler: the Clerk session token goes in the
// Authorization header, and the API verifies it with @clerk/backend.

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API ${status}`);
  }
}

export function useApi() {
  const { getToken } = useAuth();
  // Stable across renders, so screens can use it in effects without re-running them.
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;

  return useCallback(
    async <T>(path: string, init: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown } = {}): Promise<T> => {
      const token = await tokenRef.current();
      const res = await fetch(`${BASE_URL}${path}`, {
        method: init.method ?? (init.body ? 'POST' : 'GET'),
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(init.body ? { 'content-type': 'application/json' } : {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
      });
      const body = await res.json().catch(() => undefined);
      if (!res.ok) throw new ApiError(res.status, body);
      return body as T;
    },
    [],
  );
}
