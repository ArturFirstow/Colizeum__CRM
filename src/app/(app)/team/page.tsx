import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { TeamView } from "@/components/team/TeamView";
import { VacationCalendar } from "@/components/team/VacationCalendar";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await requireSession();
  const members = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      sheetUrl: true,
      createdAt: true,
      _count: { select: { ownedAdvertisers: true, ownedTasks: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Календарь отпусков: берём с запасом в год по краям, чтобы при листании
  // года вперёд-назад сетка не оказывалась пустой.
  const absences = await prisma.absence.findMany({
    where: { endDate: { gte: new Date(new Date().getFullYear() - 1, 0, 1) } },
    include: { coverUser: { select: { id: true, name: true } } },
    orderBy: { startDate: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Команда"
        subtitle="У каждого свой кабинет и свои клиенты. Шпаргалки и сетка размещений — общие."
        icon="👥"
      />
      <TeamView members={members} isAdmin={session.role === "Owner"} meId={session.userId} />

      <div className="mt-6">
        <VacationCalendar
          people={members.map((m) => ({ id: m.id, name: m.name }))}
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
    </div>
  );
}
