import { prisma } from "@/lib/prisma";
import { withSession, ok } from "@/lib/api";

// Сколько сообщений пришло после того, как сотрудник последний раз открывал
// мессенджер. Свои сообщения не считаем — иначе маячок горел бы от себя самого.
export async function GET() {
  return withSession(async (session) => {
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { chatSeenAt: true },
    });
    const count = await prisma.chatMessage.count({
      where: {
        authorId: { not: session.userId },
        ...(me?.chatSeenAt ? { createdAt: { gt: me.chatSeenAt } } : {}),
        channel: {
          OR: [
            { isDm: false }, // общие каналы видят все
            { members: { some: { userId: session.userId } } }, // личка — только своя
          ],
        },
      },
    });
    return ok({ count });
  });
}
