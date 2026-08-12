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

export async function apiFetch<T>(
  url: string,
  init?: RequestInit,
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
    throw new ApiClientError(
      res.status,
      body?.message ?? "Request failed",
      body?.errors,
    );
  }
  return body.data as T;
}
