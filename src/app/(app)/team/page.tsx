import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { TeamView } from "@/components/team/TeamView";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await requireSession();
  const members = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      telegramChatId: true,
      createdAt: true,
      _count: { select: { ownedAdvertisers: true, ownedTasks: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Команда"
        subtitle="У каждого свой кабинет и свои клиенты. Шпаргалки и сетка размещений — общие."
        icon="👥"
      />
      <TeamView members={members} isAdmin={session.role === "Owner"} />
    </div>
  );
}
