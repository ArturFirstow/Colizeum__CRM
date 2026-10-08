import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  login,
  readPendingToken,
  startSession,
  sessionPayloadOf,
} from "@/lib/auth";
import { fail, ok, handleError } from "@/lib/api";
import { checkLoginAllowed, registerFailedLogin, clearLoginAttempts } from "@/lib/rate-limit";
import { writeAudit, clientIp } from "@/lib/audit";
import { verifyCode, normalizeRecoveryCode } from "@/lib/totp";
import { verifyPassword } from "@/lib/auth";

// Вход устроен в два шага, если у сотрудника включён второй фактор:
//   шаг 1 — почта и пароль, в ответ приходит временный пропуск;
//   шаг 2 — код из приложения (или запасной код) вместе с этим пропуском.
// Пропуск живёт 5 минут и сам по себе доступа не даёт.
const step1 = z.object({ email: z.string().min(1), password: z.string().min(1) });
const step2 = z.object({ pending: z.string().min(1), code: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ip = clientIp(req);

    // ── Шаг 2: пришёл код ────────────────────────────────────────────────────
    if (body && typeof body === "object" && "pending" in body) {
      const { pending, code } = step2.parse(body);
      const userId = await readPendingToken(pending);
      if (!userId) {
        return fail("pending_expired", "Время на ввод кода истекло. Войдите заново.", 401);
      }
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.totpSecret) return fail("invalid_credentials", "Войдите заново", 401);

      const key = `${user.email}|${ip}`;
      const verdict = checkLoginAllowed(key);
      if (!verdict.allowed) {
        const minutes = Math.ceil(verdict.retryAfterSec / 60);
        writeAudit({ action: "login.blocked", userId: user.id, userName: user.name, ip, ok: false });
        return fail("too_many_attempts", `Слишком много попыток. Попробуйте через ${minutes} мин.`, 429);
      }

      let passed = verifyCode(user.totpSecret, code);
      let usedRecovery = false;

      // Запасной код: одноразовый, после использования вычёркивается.
      if (!passed && user.totpRecoveryCodes) {
        const stored: string[] = JSON.parse(user.totpRecoveryCodes);
        const given = normalizeRecoveryCode(code);
        for (const hash of stored) {
          if (await verifyPassword(given, hash)) {
            passed = true;
            usedRecovery = true;
            await prisma.user.update({
              where: { id: user.id },
              data: { totpRecoveryCodes: JSON.stringify(stored.filter((h) => h !== hash)) },
            });
            break;
          }
        }
      }

      if (!passed) {
        registerFailedLogin(key);
        writeAudit({ action: "login.fail", userId: user.id, userName: user.name, ip, ok: false, changedFields: ["неверный код"] });
        return fail("invalid_code", "Неверный код. Проверьте время на телефоне.", 401);
      }

      clearLoginAttempts(key);
      const payload = sessionPayloadOf(user);
      await startSession(payload);
      writeAudit({
        action: "login.ok",
        userId: user.id,
        userName: user.name,
        entityType: "user",
        entityId: user.id,
        ip,
        changedFields: usedRecovery ? ["вход по запасному коду"] : ["вход с кодом"],
      });
      return ok({ user: payload, usedRecovery });
    }

    // ── Шаг 1: почта и пароль ────────────────────────────────────────────────
    const parsed = step1.parse(body);
    const email = parsed.email.trim().toLowerCase();
    const key = `${email}|${ip}`;

    const verdict = checkLoginAllowed(key);
    if (!verdict.allowed) {
      const minutes = Math.ceil(verdict.retryAfterSec / 60);
      writeAudit({ action: "login.blocked", entityType: "user", ip, ok: false, userName: email });
      return fail("too_many_attempts", `Слишком много неудачных попыток входа. Попробуйте через ${minutes} мин.`, 429);
    }

    const result = await login(parsed.email, parsed.password);

    if (result.ok === false) {
      registerFailedLogin(key);
      writeAudit({ action: "login.fail", entityType: "user", ip, ok: false, userName: email });
      return fail("invalid_credentials", result.error, 401);
    }

    if (result.ok === "totp") {
      // Пароль верный — счётчик попыток сбрасываем, дальше считаем попытки кода.
      clearLoginAttempts(key);
      return ok({ need2fa: true, pending: result.pending, name: result.name });
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
