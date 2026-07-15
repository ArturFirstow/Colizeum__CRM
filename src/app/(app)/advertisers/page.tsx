import { prisma } from "@/lib/prisma";
import { AdvertisersView } from "@/components/advertisers/AdvertisersView";

export const dynamic = "force-dynamic";

export default async function AdvertisersPage() {
  const advertisers = await prisma.advertiser.findMany({
    include: { _count: { select: { deals: true, documents: true, contacts: true } } },
    orderBy: { nameRu: "asc" },
  });
  return <AdvertisersView initial={advertisers} />;
}
