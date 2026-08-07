import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canSeeTournaments, ownScope } from "@/lib/scope";
import { PageHeader } from "@/components/ui/primitives";
import { ContractorsView } from "@/components/tournaments/ContractorsView";

export const dynamic = "force-dynamic";

export default async function ContractorsPage() {
  const session = await requireSession();
  if (!canSeeTournaments(session)) redirect("/dashboard");

  const contractors = await prisma.tournamentContractor.findMany({
    where: ownScope(session),
    include: { _count: { select: { tournaments: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Контрагенты"
        subtitle="Заказчики турниров — от первого касания до проведённого"
        icon="◈"
      />
      <ContractorsView contractors={contractors.map((c) => ({ ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() }))} />
    </div>
  );
}
