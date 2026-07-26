import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { ownScope, advertiserScope } from "@/lib/scope";
import { MessengerView } from "@/components/messenger/MessengerView";

export const dynamic = "force-dynamic";

export default async function MessengerPage() {
  const session = await requireSession();

  // Гарантируем наличие канала «Общий».
  let channels = await prisma.channel.findMany({ orderBy: [{ isGeneral: "desc" }, { createdAt: "asc" }] });
  if (channels.length === 0) {
    await prisma.channel.create({ data: { name: "Общий", description: "Общий канал команды", isGeneral: true } });
    channels = await prisma.channel.findMany({ orderBy: [{ isGeneral: "desc" }, { createdAt: "asc" }] });
  }

  // Справочники для привязки сообщения к клиенту/сделке (в своей области видимости).
  const [advertisers, deals] = await Promise.all([
    prisma.advertiser.findMany({ where: ownScope(session), select: { id: true, nameRu: true }, orderBy: { nameRu: "asc" } }),
    prisma.deal.findMany({ where: advertiserScope(session), select: { id: true, title: true }, orderBy: { updatedAt: "desc" } }),
  ]);

  return (
    <MessengerView
      me={{ id: session.userId, name: session.name, role: session.role }}
      channels={channels.map((c) => ({ id: c.id, name: c.name, description: c.description, isGeneral: c.isGeneral }))}
      advertisers={advertisers}
      deals={deals}
    />
  );
}
