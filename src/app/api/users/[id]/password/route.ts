import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { passwordChangeSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Смена пароля.
//   • сотрудник меняет СВОЙ пароль — обязан подтвердить текущий;
//   • администратор (Owner) сбрасывает пароль любому сотруднику — текущий не
//     требуется, он его и не знает.
// Больше никто и никого поменять не может: без этого правила любой сотрудник
// мог бы забрать себе чужой доступ.
export async function POST(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    const isSelf = id === session.userId;
    const isAdmin = session.role === "Owner";

    if (!isSelf && !isAdmin) {
      return fail("forbidden", "Менять чужой пароль может только администратор", 403);
    }

    const data = passwordChangeSchema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return fail("not_found", "Сотрудник не найден", 404);

    if (isSelf) {
      if (!data.currentPassword) {
        return fail("validation", "Введите текущий пароль", 422);
      }
      const okCurrent = await verifyPassword(data.currentPassword, user.passwordHash);
      if (!okCurrent) return fail("invalid_credentials", "Текущий пароль неверен", 401);
    }

    await prisma.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(data.newPassword) },
    });

    return ok({ changed: true });
  });
}
