import { prisma } from "@/lib/prisma";
import { DealsView } from "@/components/deals/DealsView";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  // Сделки архивных проектов не показываются в основном списке (v2, п.1.2).
  const [deals, advertisers] = await Promise.all([
    prisma.deal.findMany({
      where: { advertiser: { archived: false } },
      include: { advertiser: { select: { id: true, nameRu: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.advertiser.findMany({ where: { archived: false }, select: { id: true, nameRu: true }, orderBy: { nameRu: "asc" } }),
  ]);

  return <DealsView deals={deals} advertisers={advertisers} />;
}
