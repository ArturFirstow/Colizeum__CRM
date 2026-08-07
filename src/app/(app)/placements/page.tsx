import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ownScope } from "@/lib/scope";
import { PageHeader } from "@/components/ui/primitives";
import { PlacementCalendar } from "@/components/placements/PlacementCalendar";

export const dynamic = "force-dynamic";

export default async function PlacementsPage() {
  // Календарь размещений — ОБЩИЙ для всех (физические слоты клубов одни);
  // в выпадающем списке для брони — только свои клиенты.
  const session = await requireSession();
  const [placements, advertisers] = await Promise.all([
    prisma.placement.findMany({
      include: { advertiser: { select: { id: true, nameRu: true } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.advertiser.findMany({ where: ownScope(session), select: { id: true, nameRu: true }, orderBy: { nameRu: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Календарь размещений"
        subtitle="Что и когда выходит: слоты по неделям"
        icon="▦"
      />
      <PlacementCalendar placements={placements} advertisers={advertisers} />
    </div>
  );
}
