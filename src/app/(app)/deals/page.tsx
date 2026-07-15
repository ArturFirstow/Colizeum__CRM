import { prisma } from "@/lib/prisma";
import { DealsView } from "@/components/deals/DealsView";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const [deals, advertisers] = await Promise.all([
    prisma.deal.findMany({
      include: { advertiser: { select: { id: true, nameRu: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.advertiser.findMany({ select: { id: true, nameRu: true }, orderBy: { nameRu: "asc" } }),
  ]);

  return <DealsView deals={deals} advertisers={advertisers} />;
}
