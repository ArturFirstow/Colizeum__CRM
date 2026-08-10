import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { HandoverView } from "@/components/handover/HandoverView";
import { VacationCalendar } from "@/components/handover/VacationCalendar";

export const dynamic = "force-dynamic";

export default async function HandoverPage() {
  const session = await requireSession();

  const [advertisers, colleagues, active, history, team, absences] = await Promise.all([
    // Передать можно только своих клиентов.
    prisma.advertiser.findMany({
      where: { ownerId: session.userId, archived: false },
      select: { id: true, nameRu: true, _count: { select: { deals: true, documents: true } } },
      orderBy: { nameRu: "asc" },
    }),
    prisma.user.findMany({
      where: { id: { not: session.userId } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Активные передачи, где я участник — с любой стороны.
    prisma.handover.findMany({
      where: { status: "Активна", OR: [{ fromUserId: session.userId }, { toUserId: session.userId }] },
      include: { from: true, to: true, items: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.handover.findMany({
      where: { status: "Завершена", OR: [{ fromUserId: session.userId }, { toUserId: session.userId }] },
      include: { from: true, to: true, items: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    // Календарь отпусков — про всю команду, включая себя: он отвечает на
    // вопрос «кого не будет», а передача дел ниже — «кто вместо него».
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    // С запасом в год назад, чтобы при листании сетка не оказывалась пустой.
    prisma.absence.findMany({
      where: { endDate: { gte: new Date(new Date().getFullYear() - 1, 0, 1) } },
      include: { coverUser: { select: { id: true, name: true } } },
      orderBy: { startDate: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Передача дел"
        subtitle="Уходите в отпуск — клиенты и знание о них уходят к коллеге, а не теряются"
        icon="⇄"
      />
      {/* Сначала «кого и когда не будет», потом «кому уходят клиенты»:
          отпуск планируют раньше, чем передают дела. */}
      <div className="mb-6">
        <VacationCalendar
          people={team}
          absences={absences.map((a) => ({
            id: a.id,
            userId: a.userId,
            kind: a.kind,
            startDate: a.startDate.toISOString(),
            endDate: a.endDate.toISOString(),
            note: a.note,
            coverUser: a.coverUser,
          }))}
          meId={session.userId}
          canPlanForOthers={session.role === "Director" || session.role === "Owner"}
        />
      </div>

      <HandoverView
        advertisers={advertisers}
        colleagues={colleagues}
        active={active}
        history={history}
        meId={session.userId}
      />
    </div>
  );
}
