import "server-only";
import type { z } from "zod";
import type { SessionPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PublicError } from "@/lib/errors";
import { guardAdvertiser, guardDeal, guardTask } from "@/lib/guard";
import { isSecurity } from "@/lib/scope";
import type { taskCreateSchema, taskUpdateSchema } from "@/lib/validation";

type CreateInput = z.infer<typeof taskCreateSchema>;
type UpdateInput = z.infer<typeof taskUpdateSchema>;
type CurrentTask = Awaited<ReturnType<typeof guardTask>>;

async function taskLinks(session: SessionPayload, data: UpdateInput, current?: CurrentTask) {
  // Исполнитель может обновлять порученную задачу, не владея всем клиентом.
  // Повторно проверяем доступ именно при смене связи, а не при смене статуса.
  const deal = data.dealId && data.dealId !== current?.dealId
    ? await guardDeal(session, data.dealId)
    : current?.deal;
  if (data.advertiserId && data.advertiserId !== current?.advertiserId) {
    await guardAdvertiser(session, data.advertiserId);
  }
  if (deal && data.advertiserId && data.advertiserId !== deal.advertiserId) {
    throw new PublicError("Выбранная сделка относится к другому клиенту", { code: "task_client_mismatch", status: 422 });
  }
  return { dealId: data.dealId, advertiserId: deal?.advertiserId ?? data.advertiserId };
}

async function checkAssignee(assigneeId?: string) {
  if (!assigneeId) return;
  const user = await prisma.user.findUnique({ where: { id: assigneeId }, select: { role: true } });
  if (!user || user.role === "Security") {
    throw new PublicError("Выберите сотрудника, который работает с проектами", { code: "invalid_assignee", status: 422 });
  }
}

export async function createTask(session: SessionPayload, data: CreateInput) {
  if (isSecurity(session)) {
    throw new PublicError("Нет доступа к задачам проектов", { code: "forbidden", status: 403 });
  }
  const links = await taskLinks(session, data);
  await checkAssignee(data.assigneeId);
  return prisma.task.create({
    data: {
      ...data,
      ...links,
      ownerId: session.userId,
      assignedById: data.assigneeId && data.assigneeId !== session.userId ? session.userId : undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    },
  });
}

export async function updateTask(session: SessionPayload, id: string, data: UpdateInput) {
  const current = await guardTask(session, id);
  const links = await taskLinks(session, data, current);
  await checkAssignee(data.assigneeId);
  const reassigned = data.assigneeId !== undefined && data.assigneeId !== current.assigneeId;
  return prisma.task.update({
    where: { id },
    data: {
      ...data,
      ...links,
      // Первоначальный постановщик сохраняет своё поручение в обзоре даже
      // после передачи младшему. Нового отправителя содержит уведомление.
      ...(reassigned && !current.assignedById && data.assigneeId !== session.userId ? { assignedById: session.userId } : {}),
      ...(data.status !== undefined || data.side !== undefined ? { movedAt: new Date() } : {}),
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    },
  });
}
