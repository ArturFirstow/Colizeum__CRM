import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError, requireSession } from "@/lib/auth";
import { PublicError } from "@/lib/errors";

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
  // Ошибка, написанная специально для человека, — показываем как есть.
  if (err instanceof PublicError) {
    return fail(err.code, err.message, err.status);
  }

  // Всё остальное наружу не выпускаем: в тексте внутренней ошибки бывают пути
  // к файлам, куски SQL и имена колонок. Подробности — в журнале сервера
  // (`pm2 logs colizeum`), человеку — одна понятная фраза и метка, по которой
  // эту запись в журнале можно найти.
  const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
  console.error(`[API error ${ref}]`, err);
  return fail(
    "internal",
    `Что-то пошло не так. Если повторяется — сообщите администратору код ошибки ${ref}.`,
    500,
  );
}
