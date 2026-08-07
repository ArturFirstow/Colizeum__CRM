import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canSeeTournaments, isLeadership } from "@/lib/scope";
import { PageHeader } from "@/components/ui/primitives";
import { ArenaCalendar } from "@/components/tournaments/ArenaCalendar";

export const dynamic = "force-dynamic";

export default async function ArenaPage() {
  const session = await requireSession();
  if (!canSeeTournaments(session)) redirect("/dashboard");

  const scope = isLeadership(session) ? {} : { ownerId: session.userId };
  const [bookings, tournaments, contractors] = await Promise.all([
    prisma.arenaBooking.findMany({
      include: {
        tournament: { select: { id: true, title: true } },
        contractor: { select: { id: true, name: true } },
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.tournament.findMany({ where: scope, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.tournamentContractor.findMany({ where: scope, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Бронь арены"
        subtitle="Шелепиха: кто и когда занимает площадку"
        icon="▦"
      />
      <ArenaCalendar
        bookings={bookings.map((b) => ({
          id: b.id,
          zone: b.zone,
          timeSlot: b.timeSlot,
          status: b.status,
          clientLabel: b.clientLabel,
          notes: b.notes,
          startDate: b.startDate.toISOString(),
          endDate: b.endDate.toISOString(),
          tournament: b.tournament,
          contractor: b.contractor,
          tournamentId: b.tournamentId,
          contractorId: b.contractorId,
        }))}
        tournaments={tournaments}
        contractors={contractors}
      />
    </div>
  );
}
