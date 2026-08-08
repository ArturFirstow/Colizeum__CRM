import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";
import { journalCreateSchema } from "@/lib/validation";
import { durationFromTimes, meetingSheetConfigured, pushMeetingToSheet } from "@/lib/services/meeting-sheet";

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const { meetingDate, durationHours, ...data } = journalCreateSchema.parse(await req.json());

    // Продолжительность считаем сами, если её не прислали: шаг 0,5 часа.
    const hours = durationHours ?? durationFromTimes(data.startTime ?? null, data.endTime ?? null);

    const entry = await prisma.journalEntry.create({
      data: {
        ...data,
        ownerId: session.userId,
        meetingDate: meetingDate ? new Date(meetingDate) : null,
        durationHours: hours,
      },
    });

    // Встреча с заполненной датой уходит строкой в таблицу учёта.
    let exported: { ok: boolean; error?: string } | null = null;
    if (entry.meetingDate && meetingSheetConfigured()) {
      const advertiser = entry.advertiserId
        ? await prisma.advertiser.findUnique({
            where: { id: entry.advertiserId },
            select: { nameRu: true },
          })
        : null;

      const res = await pushMeetingToSheet({
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
      });

      await prisma.journalEntry.update({
        where: { id: entry.id },
        data: {
          exportedAt: res.ok ? new Date() : null,
          exportError: res.ok ? null : res.error,
        },
      });
      exported = res.ok ? { ok: true } : { ok: false, error: res.error };
    }

    return ok({ ...entry, exported }, { status: 201 });
  });
}
