import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ownScope } from "@/lib/scope";
import { AdvertisersView } from "@/components/advertisers/AdvertisersView";

export const dynamic = "force-dynamic";

export default async function AdvertisersPage() {
  // Личный кабинет: сотрудник видит только своих клиентов.
  const session = await requireSession();
  const advertisers = await prisma.advertiser.findMany({
    where: ownScope(session),
    include: { _count: { select: { deals: true, documents: true, contacts: true } } },
    orderBy: { nameRu: "asc" },
  });
  return <AdvertisersView initial={advertisers} />;
}
