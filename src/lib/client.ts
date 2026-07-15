"use client";

// Клиентский помощник для вызова API с единым разбором ошибок.
export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const isForm = options.body instanceof FormData;
  const res = await fetch(url, {
    ...options,
    headers: isForm
      ? options.headers
      : { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const err = data as { error?: { message?: string; issues?: unknown } } | null;
    const message = err?.error?.message ?? `Ошибка ${res.status}`;
    throw new ApiError(message, res.status, err?.error);
  }
  return data as T;
}

export class ApiError extends Error {
  status: number;
  detail?: unknown;
  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}
