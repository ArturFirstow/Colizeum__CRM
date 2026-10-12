import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { worksheetNoteSchema } from "@/lib/validation";
import { guardAdvertiser } from "@/lib/guard";
import { weekStartOf, worksheetOwnerId } from "@/lib/worksheet";

// ─────────────────────────────────────────────────────────────────────────────
// Контекст по клиенту на неделю: «где мы сейчас, на что смотреть».
//
// Пишет руководитель проекта, читает менеджер. В прежнем задачнике это был
// абзац обстановки перед списком пунктов («финальная стадия согласования, по
// Приложению №4 остались вопросы») — без него список читается как набор строк.
//
// Пустой текст УДАЛЯЕТ заметку: иначе ошибочно написанный абзац остался бы
// висеть навсегда.
// ─────────────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  return withSession(async (session) => {
    const data = worksheetNoteSchema.parse(await req.json());
    if (data.advertiserId) await guardAdvertiser(session, data.advertiserId);

    const weekStart = weekStartOf(new Date(`${data.weekStart}T00:00:00`));
    // Лист принадлежит руководителю проекта: менеджер пишет в лист своего
    // руководителя, а не заводит собственный.
    const ownerId = await worksheetOwnerId(session);
    const text = data.text.trim();

    const existing = await prisma.worksheetNote.findFirst({
      where: { weekStart, ownerId, advertiserId: data.advertiserId ?? null },
      select: { id: true },
    });

    if (!text) {
      if (existing) await prisma.worksheetNote.delete({ where: { id: existing.id } });
      return ok({ deleted: true });
    }

    const note = existing
      ? await prisma.worksheetNote.update({
          where: { id: existing.id },
          data: { text, authorId: session.userId },
        })
      : await prisma.worksheetNote.create({
          data: {
            weekStart,
            ownerId,
            advertiserId: data.advertiserId ?? null,
            text,
            authorId: session.userId,
          },
        });
    return ok(note);
  });
}
