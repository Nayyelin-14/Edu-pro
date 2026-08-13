import { getRememberMe } from "@/lib/remember-me";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface Envelope<T> {
  isSuccess: boolean;
  message?: string;
  errors?: unknown;
  data?: T;
}

// The access_token JWT is short-lived (15 min by default) while the refresh
// token lives up to 7 days. The client never sees a 401 for an expired access
// token: it transparently rotates the session via /api/auth/refresh and retries
// the original request. Concurrent 401s share one in-flight refresh.
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remember: getRememberMe() }),
      });
      const body = (await res.json().catch(() => null)) as Envelope<unknown> | null;
      return res.ok && body?.isSuccess === true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/** Endpoints where a 401 means a real auth failure, not an expired session. */
const NO_REFRESH_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/api/auth/change-password",
  "/api/auth/enable-2fa",
  "/api/auth/disable-2fa",
  "/api/auth/verify-otp",
];

function isNoRefresh(url: string): boolean {
  const path = url.split("?")[0] ?? "";
  return NO_REFRESH_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function apiFetch<T>(
  url: string,
  init?: RequestInit,
  retried = false,
): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !body?.isSuccess) {
    if (
      res.status === 401 &&
      !retried &&
      !isNoRefresh(url) &&
      (await tryRefreshSession())
    ) {
      return apiFetch<T>(url, init, true);
    }
    throw new ApiClientError(
      res.status,
      body?.message ?? "Request failed",
      body?.errors,
    );
  }
  return body.data as T;
}
