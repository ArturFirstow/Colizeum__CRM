import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canSeeTournaments, isLeadership } from "@/lib/scope";
import { TournamentDetail } from "@/components/tournaments/TournamentDetail";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export default async function TournamentPage({ params }: Ctx) {
  const session = await requireSession();
  if (!canSeeTournaments(session)) redirect("/dashboard");
  const { id } = await params;

  const t = await prisma.tournament.findUnique({
    where: { id },
    include: {
      contractor: { select: { id: true, name: true } },
      budgetLines: { orderBy: [{ sort: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!t) notFound();
  // Специалист видит только свои турниры; руководитель — любые.
  if (!isLeadership(session) && t.ownerId && t.ownerId !== session.userId) redirect("/tournaments");

  const contractors = await prisma.tournamentContractor.findMany({
    where: isLeadership(session) ? {} : { ownerId: session.userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <TournamentDetail
      tournament={{
        id: t.id,
        title: t.title,
        contractorId: t.contractorId,
        contractor: t.contractor,
        clientLabel: t.clientLabel,
        discipline: t.discipline,
        format: t.format,
        arena: t.arena,
        status: t.status,
        budgetNote: t.budgetNote,
        startDate: t.startDate ? t.startDate.toISOString() : null,
        endDate: t.endDate ? t.endDate.toISOString() : null,
      }}
      lines={t.budgetLines.map((l) => ({
        id: l.id,
        category: l.category,
        title: l.title,
        amountPlanned: l.amountPlanned,
        amountActual: l.amountActual,
        notes: l.notes,
      }))}
      contractors={contractors}
    />
  );
}
