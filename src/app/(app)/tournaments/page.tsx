import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canSeeTournaments, ownScope } from "@/lib/scope";
import { PageHeader } from "@/components/ui/primitives";
import { TournamentsView } from "@/components/tournaments/TournamentsView";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const session = await requireSession();
  if (!canSeeTournaments(session)) redirect("/dashboard");

  const [tournaments, contractors] = await Promise.all([
    prisma.tournament.findMany({
      where: ownScope(session),
      include: {
        contractor: { select: { id: true, name: true } },
        budgetLines: { select: { amountPlanned: true, amountActual: true } },
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.tournamentContractor.findMany({
      where: ownScope(session),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows = tournaments.map((t) => ({
    id: t.id,
    title: t.title,
    discipline: t.discipline,
    format: t.format,
    arena: t.arena,
    status: t.status,
    startDate: t.startDate ? t.startDate.toISOString() : null,
    endDate: t.endDate ? t.endDate.toISOString() : null,
    contractor: t.contractor,
    clientLabel: t.clientLabel,
    budgetPlanned: t.budgetLines.reduce((s, l) => s + l.amountPlanned, 0),
    budgetActual: t.budgetLines.reduce((s, l) => s + (l.amountActual ?? 0), 0),
    lineCount: t.budgetLines.length,
  }));

  return (
    <div>
      <PageHeader
        title="Турниры и сметы"
        subtitle="Корпоративные турниры для заказчиков — планировка бюджета внутри карточки"
        icon="♛"
      />
      <TournamentsView tournaments={rows} contractors={contractors} />
    </div>
  );
}
