import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ownScope, advertiserScope } from "@/lib/scope";
import { MessengerView } from "@/components/messenger/MessengerView";

export const dynamic = "force-dynamic";

export default async function MessengerPage() {
  const session = await requireSession();

  // Зашли в мессенджер — значит увидели. Маячок непрочитанного гаснет.
  await prisma.user.update({ where: { id: session.userId }, data: { chatSeenAt: new Date() } });

  // Гарантируем наличие общего канала «Общий» (не-DM).
  let general = await prisma.channel.findMany({ where: { isDm: false }, orderBy: [{ isGeneral: "desc" }, { createdAt: "asc" }] });
  if (general.length === 0) {
    await prisma.channel.create({ data: { name: "Общий", description: "Общий канал команды", isGeneral: true } });
    general = await prisma.channel.findMany({ where: { isDm: false }, orderBy: [{ isGeneral: "desc" }, { createdAt: "asc" }] });
  }

  // Личка: диалоги, где текущий сотрудник — участник (показываем имя собеседника).
  const dms = await prisma.channel.findMany({
    where: { isDm: true, members: { some: { userId: session.userId } } },
    include: { members: { include: { user: { select: { id: true, name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const [advertisers, deals, users] = await Promise.all([
    prisma.advertiser.findMany({ where: ownScope(session), select: { id: true, nameRu: true }, orderBy: { nameRu: "asc" } }),
    prisma.deal.findMany({ where: advertiserScope(session), select: { id: true, title: true }, orderBy: { updatedAt: "desc" } }),
    prisma.user.findMany({ where: { id: { not: session.userId } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const channels = [
    ...general.map((c) => ({ id: c.id, name: c.name, description: c.description, isGeneral: c.isGeneral, isDm: false })),
    ...dms.map((c) => ({
      id: c.id,
      name: c.members.find((m) => m.userId !== session.userId)?.user.name ?? "Личка",
      description: null,
      isGeneral: false,
      isDm: true,
    })),
  ];

  return (
    <MessengerView
      me={{ id: session.userId, name: session.name, role: session.role }}
      channels={channels}
      users={users}
      advertisers={advertisers}
      deals={deals}
    />
  );
}
