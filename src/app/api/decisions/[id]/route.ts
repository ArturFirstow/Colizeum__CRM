import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { isLeadership } from "@/lib/scope";
import { decisionPatchSchema } from "@/lib/validation";
import { notifyDecisionResolved } from "@/lib/services/notify";

type Ctx = { params: Promise<{ id: string }> };

// Решение по запросу принимает руководитель; автор может свой запрос отозвать.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    const data = decisionPatchSchema.parse(await req.json());
    const item = await prisma.decisionRequest.findUnique({
      where: { id },
      select: { requesterId: true, title: true, status: true },
    });
    if (!item) return fail("not_found", "Запрос не найден", 404);
    if (!isLeadership(session) && item.requesterId !== session.userId) {
      return fail("forbidden", "Решение принимает руководитель", 403);
    }
    const updated = await prisma.decisionRequest.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.answer !== undefined ? { answer: data.answer ?? null } : {}),
        ...(data.status && data.status !== "Открыт" ? { resolvedAt: new Date() } : {}),
        ...(data.archived !== undefined ? { archivedAt: data.archived ? new Date() : null } : {}),
      },
    });
    // Автор узнаёт об ответе сразу, а не при следующем входе.
    if (data.status && data.status !== "Открыт" && item.status === "Открыт") {
      await notifyDecisionResolved({
        requesterId: item.requesterId,
        title: item.title,
        status: data.status,
        answer: updated.answer,
      });
    }

    return ok(updated);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    const item = await prisma.decisionRequest.findUnique({ where: { id }, select: { requesterId: true } });
    if (!item) return fail("not_found", "Запрос не найден", 404);
    if (!isLeadership(session) && item.requesterId !== session.userId) {
      return fail("forbidden", "Удалить может автор или руководитель", 403);
    }
    await prisma.decisionRequest.delete({ where: { id } });
    return ok({ ok: true });
  });
}
