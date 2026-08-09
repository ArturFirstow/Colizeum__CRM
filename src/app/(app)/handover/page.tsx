import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { HandoverView } from "@/components/handover/HandoverView";

export const dynamic = "force-dynamic";

export default async function HandoverPage() {
  const session = await requireSession();

  const [advertisers, colleagues, active, history] = await Promise.all([
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
  ]);

  return (
    <div>
      <PageHeader
        title="Передача дел"
        subtitle="Уходите в отпуск — клиенты и знание о них уходят к коллеге, а не теряются"
        icon="⇄"
      />
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
