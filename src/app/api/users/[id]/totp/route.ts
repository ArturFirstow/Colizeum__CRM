import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { writeAudit, clientIp } from "@/lib/audit";
import { raiseAlert } from "@/lib/services/security-alerts";
import {
  generateSecret,
  otpauthUrl,
  verifyCode,
  generateRecoveryCodes,
} from "@/lib/totp";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

// Второй фактор настраивает себе каждый сам. Чужой второй фактор не трогает
// никто, включая администратора: иначе смысл второго фактора теряется —
// админ мог бы войти под любым сотрудником.
async function guardSelf(ctxId: string, sessionUserId: string) {
  return ctxId === sessionUserId;
}

// ── Шаг 1: получить секрет и QR-код. Второй фактор ещё НЕ включается ────────
export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    if (!(await guardSelf(id, session.userId))) {
      return fail("forbidden", "Второй фактор каждый настраивает себе сам", 403);
    }

    const secret = generateSecret();
    // Секрет пишем сразу, но без totpEnabledAt — пока это черновик, вход он
    // не меняет. Если человек бросит настройку на полпути, ничего не сломается.
    await prisma.user.update({ where: { id }, data: { totpSecret: secret } });

    const url = otpauthUrl(secret, session.email);
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 240 });
    return ok({ secret, qr });
  });
}

// ── Шаг 2: подтвердить кодом и включить ─────────────────────────────────────
const enableSchema = z.object({ code: z.string().min(1) });

export async function PUT(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    if (!(await guardSelf(id, session.userId))) {
      return fail("forbidden", "Второй фактор каждый настраивает себе сам", 403);
    }
    const { code } = enableSchema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user?.totpSecret) return fail("no_secret", "Сначала получите QR-код", 400);
    if (!verifyCode(user.totpSecret, code)) {
      return fail("invalid_code", "Код не подошёл. Проверьте, что на телефоне верное время.", 400);
    }

    // Запасные коды показываем ОДИН раз, в базе держим только хэши — так же,
    // как пароли. Потеряны — настраивать второй фактор заново.
    const codes = generateRecoveryCodes();
    const hashes = await Promise.all(codes.map((c) => hashPassword(c.replace(/-/g, ""))));

    await prisma.user.update({
      where: { id },
      data: { totpEnabledAt: new Date(), totpRecoveryCodes: JSON.stringify(hashes) },
    });

    writeAudit({
      action: "totp.enable",
      userId: session.userId,
      userName: session.name,
      entityType: "user",
      entityId: id,
      ip: clientIp(req),
    });
    return ok({ recoveryCodes: codes });
  });
}

// ── Отключение: только с паролем, чтобы чужой открытый ноутбук не помог ─────
const disableSchema = z.object({ password: z.string().min(1) });

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    if (!(await guardSelf(id, session.userId))) {
      return fail("forbidden", "Второй фактор каждый настраивает себе сам", 403);
    }
    const { password } = disableSchema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return fail("not_found", "Сотрудник не найден", 404);
    if (!(await verifyPassword(password, user.passwordHash))) {
      return fail("invalid_credentials", "Неверный пароль", 401);
    }

    await prisma.user.update({
      where: { id },
      data: { totpSecret: null, totpEnabledAt: null, totpRecoveryCodes: null },
    });
    writeAudit({
      action: "totp.disable",
      userId: session.userId,
      userName: session.name,
      entityType: "user",
      entityId: id,
      ip: clientIp(req),
      ok: false, // отключение защиты — событие, которое должно бросаться в глаза
    });
    await raiseAlert({
      kind: "totp-off",
      userId: session.userId,
      userName: session.name,
      ip: clientIp(req),
      detail: "Вход теперь только по паролю. Если телефон сменили — подключите код заново.",
    });
    return ok({ disabled: true });
  });
}
