import type { Prisma } from "@prisma/client";
import type { SessionPayload } from "@/lib/auth";
import { isLeadership, isSecurity, ownScope } from "@/lib/scope";

/** Одна область видимости для списков задач и проверки права их изменить. */
export function taskScope(session: SessionPayload): Prisma.TaskWhereInput {
  if (isSecurity(session)) return { id: { in: [] } };
  if (isLeadership(session)) return {};
  const ids = session.teamIds?.length ? session.teamIds : [session.userId];
  return {
    OR: [
      { ownerId: { in: ids } },
      { assigneeId: { in: ids } },
      { assignedById: session.userId },
      { dealId: null, advertiser: ownScope(session) },
      { deal: { advertiser: ownScope(session) } },
    ],
  };
}

/** Сделка определяет клиента; старые задачи могут не иметь advertiserId. */
export function tasksForAdvertiser(advertiserId: string): Prisma.TaskWhereInput {
  return {
    OR: [
      { deal: { advertiserId } },
      { dealId: null, advertiserId },
    ],
  };
}

/** Нагрузка сотрудника: текущий исполнитель, а без него — владелец задачи. */
export function tasksForEmployee(userId: string): Prisma.TaskWhereInput {
  return { OR: [{ assigneeId: userId }, { assigneeId: null, ownerId: userId }] };
}

export function taskAdvertiserId(task: {
  advertiserId: string | null;
  deal: { advertiserId: string } | null;
}): string | null {
  return task.deal?.advertiserId ?? task.advertiserId;
}
