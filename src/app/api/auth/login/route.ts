import { NextRequest } from "next/server";
import { z } from "zod";
import { login } from "@/lib/auth";
import { fail, ok, handleError } from "@/lib/api";
import { checkLoginAllowed, registerFailedLogin, clearLoginAttempts } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

/** Адрес, с которого пришёл запрос. За nginx настоящий адрес приходит в заголовке. */
function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());

    // Ключ — почта + адрес: перебор по одному аккаунту не мешает войти
    // остальным сотрудникам из офиса.
    const key = `${body.email.trim().toLowerCase()}|${clientIp(req)}`;

    const verdict = checkLoginAllowed(key);
    if (!verdict.allowed) {
      const minutes = Math.ceil(verdict.retryAfterSec / 60);
      return fail(
        "too_many_attempts",
        `Слишком много неудачных попыток входа. Попробуйте через ${minutes} мин.`,
        429,
      );
    }

    const result = await login(body.email, body.password);
    if (!result.ok) {
      registerFailedLogin(key);
      return fail("invalid_credentials", result.error, 401);
    }

    clearLoginAttempts(key);
    return ok({ user: result.user });
  } catch (err) {
    return handleError(err);
  }
}
