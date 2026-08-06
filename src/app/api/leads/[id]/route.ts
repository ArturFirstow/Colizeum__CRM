import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { leadPatchSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Работа с заявкой: статус, ответственный, внутренний комментарий.
// Заявки общие для отдела — брать в работу может любой сотрудник.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withSession(async () => {
    const { id } = await ctx.params;
    const data = leadPatchSchema.parse(await req.json());
    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.comment !== undefined ? { comment: data.comment ?? null } : {}),
        ...(data.assignedToId !== undefined ? { assignedToId: data.assignedToId } : {}),
      },
      include: { assignedTo: { select: { id: true, name: true } } },
    });
    return ok(lead);
  });
}
