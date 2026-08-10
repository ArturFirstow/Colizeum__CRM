import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { meetingSheetConfigured, pushMeetingToSheet, rowAsTsv } from "@/lib/services/meeting-sheet";

type Ctx = { params: Promise<{ id: string }> };

// Повторная отправка встречи в таблицу отчётности («Отправить ещё раз»).
export async function POST(_req: NextRequest, ctx: Ctx) {
  return withSession(async (session) => {
    const { id } = await ctx.params;
    const entry = await prisma.journalEntry.findUnique({ where: { id } });
    if (!entry) return fail("not_found", "Запись не найдена", 404);
    if (entry.ownerId && entry.ownerId !== session.userId) {
      return fail("forbidden", "Это запись другого сотрудника", 403);
    }
    if (!entry.meetingDate) return fail("no_meeting", "У записи не заполнена дата встречи", 400);

    const advertiser = entry.advertiserId
      ? await prisma.advertiser.findUnique({ where: { id: entry.advertiserId }, select: { nameRu: true } })
      : null;

    const row = {
      meetingDate: entry.meetingDate,
      startTime: entry.startTime,
      endTime: entry.endTime,
      durationHours: entry.durationHours,
      participants: entry.participants,
      meetingWith: entry.meetingWith,
      protocolUrl: entry.protocolUrl,
      meetingUrl: entry.meetingUrl,
      clientName: advertiser?.nameRu ?? null,
      employeeName: session.name,
      summary: entry.parsedSummary,
    };

    // Выгрузка не настроена — отдаём готовую строку, её можно вставить руками.
    if (!meetingSheetConfigured()) {
      return ok({ ok: false, configured: false, tsv: rowAsTsv(row) });
    }

    const res = await pushMeetingToSheet(row);
    await prisma.journalEntry.update({
      where: { id },
      data: { exportedAt: res.ok ? new Date() : null, exportError: res.ok ? null : res.error },
    });
    return ok(res.ok ? { ok: true, configured: true } : { ok: false, configured: true, error: res.error, tsv: rowAsTsv(row) });
  });
}
