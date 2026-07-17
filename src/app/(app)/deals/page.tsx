import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ownScope } from "@/lib/scope";
import { DealsView } from "@/components/deals/DealsView";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  // Личный кабинет: только сделки своих клиентов; архивные скрыты (v2, п.1.2).
  const session = await requireSession();
  const myClients = { archived: false, ...ownScope(session) };
  const [deals, advertisers] = await Promise.all([
    prisma.deal.findMany({
      where: { advertiser: myClients },
      include: { advertiser: { select: { id: true, nameRu: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.advertiser.findMany({ where: myClients, select: { id: true, nameRu: true }, orderBy: { nameRu: "asc" } }),
  ]);

  return <DealsView deals={deals} advertisers={advertisers} />;
}
