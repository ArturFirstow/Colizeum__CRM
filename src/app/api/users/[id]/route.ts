import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { userUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Правка сотрудника.
//   Имя и роль  — только администратор (Owner).
//   Ссылка на личную таблицу учёта — сотрудник ставит себе сам; администратор
//   может поправить любому (например, когда человек прислал ссылку в чат).
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    const data = userUpdateSchema.parse(await req.json());
    const isAdmin = session.role === "Owner";
    const isSelf = session.userId === id;

    if (!isAdmin && !isSelf) {
      return fail("forbidden", "Менять чужой профиль может только администратор", 403);
    }
    if (!isAdmin && (data.name !== undefined || data.role !== undefined)) {
      return fail("forbidden", "Имя и роль меняет администратор", 403);
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(isAdmin && data.name !== undefined ? { name: data.name } : {}),
        ...(isAdmin && data.role !== undefined ? { role: data.role } : {}),
        // Пустая строка = «убрать таблицу», поэтому пишем null, а не "".
        ...(data.sheetUrl !== undefined ? { sheetUrl: data.sheetUrl || null } : {}),
      },
      select: { id: true, name: true, email: true, role: true, sheetUrl: true },
    });
    return ok(user);
  });
}
