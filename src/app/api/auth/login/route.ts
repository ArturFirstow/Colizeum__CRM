import { NextRequest } from "next/server";
import { z } from "zod";
import { login } from "@/lib/auth";
import { fail, ok, handleError } from "@/lib/api";
import { checkLoginAllowed, registerFailedLogin, clearLoginAttempts } from "@/lib/rate-limit";
import { writeAudit, clientIp } from "@/lib/audit";

const schema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const ip = clientIp(req);
    const email = body.email.trim().toLowerCase();

    // Ключ — почта + адрес: перебор по одному аккаунту не мешает войти
    // остальным сотрудникам из офиса.
    const key = `${email}|${ip}`;

    const verdict = checkLoginAllowed(key);
    if (!verdict.allowed) {
      const minutes = Math.ceil(verdict.retryAfterSec / 60);
      // В журнал пишем сам факт блокировки: по нему видно подбор пароля.
      writeAudit({ action: "login.blocked", entityType: "user", ip, ok: false, userName: email });
      return fail(
        "too_many_attempts",
        `Слишком много неудачных попыток входа. Попробуйте через ${minutes} мин.`,
        429,
      );
    }

    const result = await login(body.email, body.password);
    if (!result.ok) {
      registerFailedLogin(key);
      // Почту в журнале оставляем: без неё непонятно, чей аккаунт подбирают.
      writeAudit({ action: "login.fail", entityType: "user", ip, ok: false, userName: email });
      return fail("invalid_credentials", result.error, 401);
    }

    clearLoginAttempts(key);
    writeAudit({
      action: "login.ok",
      userId: result.user.userId,
      userName: result.user.name,
      entityType: "user",
      entityId: result.user.userId,
      ip,
    });
    return ok({ user: result.user });
  } catch (err) {
    return handleError(err);
  }
}
