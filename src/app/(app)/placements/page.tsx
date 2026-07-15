import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/primitives";
import { PlacementCalendar } from "@/components/placements/PlacementCalendar";

export const dynamic = "force-dynamic";

export default async function PlacementsPage() {
  const [placements, advertisers] = await Promise.all([
    prisma.placement.findMany({
      include: { advertiser: { select: { id: true, nameRu: true } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.advertiser.findMany({ select: { id: true, nameRu: true }, orderBy: { nameRu: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Календарь размещений"
        subtitle="Бронирование слотов по неделям — тайминг-полосы (Gantt)"
        icon="▦"
      />
      <PlacementCalendar placements={placements} advertisers={advertisers} />
    </div>
  );
}
