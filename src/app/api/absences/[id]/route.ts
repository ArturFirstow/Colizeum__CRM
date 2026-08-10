import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { absenceUpdateSchema } from "@/lib/validation";
import { dayStart } from "@/lib/absence";

type Ctx = { params: Promise<{ id: string }> };

// Своё отсутствие правит и удаляет сам сотрудник; чужое — руководитель или админ.
async function load(id: string, session: { userId: string; role: string }) {
  const absence = await prisma.absence.findUnique({ where: { id } });
  if (!absence) return { error: fail("not_found", "Запись не найдена", 404) } as const;
  const canManageOthers = session.role === "Director" || session.role === "Owner";
  if (absence.userId !== session.userId && !canManageOthers) {
    return { error: fail("forbidden", "Чужое отсутствие меняет руководитель или админ", 403) } as const;
  }
  return { absence } as const;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    const found = await load(id, session);
    if ("error" in found) return found.error;

    const data = absenceUpdateSchema.parse(await req.json());
    // Период проверяем ДО записи: в запросе может прийти только одна из дат,
    // и сравнивать её надо с той, что уже лежит в базе.
    const start = data.startDate ? dayStart(data.startDate) : found.absence.startDate;
    const end = data.endDate ? dayStart(data.endDate) : found.absence.endDate;
    if (end < start) {
      return fail("validation", "Последний день не может быть раньше первого", 422);
    }

    const updated = await prisma.absence.update({
      where: { id },
      data: {
        ...(data.kind !== undefined ? { kind: data.kind } : {}),
        startDate: start,
        endDate: end,
        ...(data.coverUserId !== undefined ? { coverUserId: data.coverUserId || null } : {}),
        ...(data.note !== undefined ? { note: data.note || null } : {}),
      },
    });
    return ok(updated);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    const found = await load(id, session);
    if ("error" in found) return found.error;
    await prisma.absence.delete({ where: { id } });
    return ok({ deleted: true });
  });
}
