import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { userUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Правка сотрудника (имя, роль) — только администратор сервиса (Owner).
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    if (session.role !== "Owner") {
      return fail("forbidden", "Менять сотрудников может только администратор", 403);
    }
    const { id } = await ctx.params;
    const data = userUpdateSchema.parse(await req.json());
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
      },
      select: { id: true, name: true, email: true, role: true },
    });
    return ok(user);
  });
}
