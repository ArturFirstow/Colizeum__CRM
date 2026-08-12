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

    // Взяли заявку в работу — сразу заводим задачу «связаться»: иначе она
    // оседает в списке, а звонок откладывается «на потом».
    if (data.assignedToId) {
      const who = lead.company || lead.name || lead.contact || "клиентом с сайта";
      const already = await prisma.task.findFirst({
        where: { ownerId: data.assignedToId, title: { startsWith: `Связаться с ${who}` } },
        select: { id: true },
      });
      if (!already) {
        await prisma.task.create({
          data: {
            title: `Связаться с ${who}`,
            kind: "Менеджер",
            side: "Мы",
            status: "Открыта",
            ownerId: data.assignedToId,
            assigneeId: data.assignedToId,
            notes: [lead.contact, lead.comment].filter(Boolean).join("\n") || undefined,
          },
        });
      }
    }

    return ok(lead);
  });
}
