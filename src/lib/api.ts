import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError, requireSession } from "@/lib/auth";

// Единый формат ответа/ошибки для API (блупринт 9).
// { error: { code, message } }

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(code: string, message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/**
 * Обёртка для route-хендлеров: гарантирует сессию и ловит типовые ошибки
 * (Zod → 400, Unauthorized → 401, прочее → 500).
 */
export async function withSession<T>(
  handler: (session: Awaited<ReturnType<typeof requireSession>>) => Promise<T>,
): Promise<T | NextResponse> {
  try {
    const session = await requireSession();
    return await handler(session);
  } catch (err) {
    return handleError(err);
  }
}

export function handleError(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return fail("unauthorized", "Требуется вход", 401);
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return fail("validation", first?.message ?? "Ошибка валидации", 422, {
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  console.error("[API error]", err);
  const message = err instanceof Error ? err.message : "Внутренняя ошибка";
  return fail("internal", message, 500);
}
