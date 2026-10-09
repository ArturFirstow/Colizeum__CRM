import { NextRequest } from "next/server";
import { prisma, serveList, iso } from "@/lib/services/api-v1";

// Документы. Отдаются КАРТОЧКИ, а не файлы: содержимое документов за пределы
// сервиса не уходит, передаётся только факт «такой документ есть».
export async function GET(req: NextRequest) {
  return serveList(req, {
    scope: "documents",
    title: "Документы",
    dataKinds: ["вид и название документа", "привязка к клиенту и сделке"],
    find: (args) => prisma.document.findMany(args),
    count: (where) => prisma.document.count({ where }),
    shape: (d) => ({
      id: d.id,
      asproId: d.asproId,
      advertiserId: d.advertiserId,
      dealId: d.dealId,
      type: d.type,
      title: d.title,
      createdAt: iso(d.createdAt),
      updatedAt: iso(d.updatedAt),
    }),
  });
}
