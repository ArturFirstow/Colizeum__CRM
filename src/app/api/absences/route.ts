import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSession, ok, fail } from "@/lib/api";
import { absenceCreateSchema } from "@/lib/validation";
import { dayStart } from "@/lib/absence";

// Календарь отпусков (страница «Команда»).
//
// Кто может ставить отсутствие: себе — каждый; кому угодно — руководитель и
// администратор. Отсутствие сотрудника видно всей команде: это же и есть смысл
// календаря — понимать, кого не будет и кто подхватывает дела.

export async function POST(req: NextRequest) {
  return withSession(async (session) => {
    const data = absenceCreateSchema.parse(await req.json());
    const canPlanForOthers = session.role === "Director" || session.role === "Owner";
    if (data.userId !== session.userId && !canPlanForOthers) {
      return fail("forbidden", "Ставить отсутствие другому сотруднику может руководитель или админ", 403);
    }

    const created = await prisma.absence.create({
      data: {
        userId: data.userId,
        kind: data.kind ?? "Отпуск",
        // Дата приходит как «ГГГГ-ММ-ДД» из поля ввода — читаем её как местную,
        // иначе отпуск с 1-го числа уезжает на 30-е предыдущего месяца.
        startDate: dayStart(data.startDate),
        endDate: dayStart(data.endDate),
        coverUserId: data.coverUserId || null,
        note: data.note || null,
      },
    });
    return ok(created);
  });
}
