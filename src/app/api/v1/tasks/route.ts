import { NextRequest } from "next/server";
import { prisma, serveList, iso } from "@/lib/services/api-v1";

// Задачи. Примечания (notes) намеренно не отдаём: это свободный текст, в
// котором сотрудники пишут что угодно, включая личное о людях.
export async function GET(req: NextRequest) {
  return serveList(req, {
    scope: "tasks",
    title: "Задачи",
    dataKinds: ["название задачи", "срок", "статус", "привязка к клиенту"],
    find: (args) => prisma.task.findMany(args),
    count: (where) => prisma.task.count({ where }),
    shape: (t) => ({
      id: t.id,
      asproId: t.asproId,
      advertiserId: t.advertiserId,
      dealId: t.dealId,
      title: t.title,
      kind: t.kind,
      status: t.status,
      priority: t.priority,
      side: t.side,
      dueDate: iso(t.dueDate),
      createdAt: iso(t.createdAt),
      updatedAt: iso(t.updatedAt),
    }),
  });
}
