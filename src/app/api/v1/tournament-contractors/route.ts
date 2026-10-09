import { NextRequest } from "next/server";
import { prisma, serveList, iso } from "@/lib/services/api-v1";

// Контрагенты турнирного направления. Контактное лицо — персональные данные,
// поэтому раздел открывается ключу отдельным разрешением.
export async function GET(req: NextRequest) {
  return serveList(req, {
    scope: "tournament-contractors",
    title: "Контрагенты турниров",
    dataKinds: ["название организации", "имя контактного лица", "его контакт", "статус"],
    find: (args) => prisma.tournamentContractor.findMany(args),
    count: (where) => prisma.tournamentContractor.count({ where }),
    shape: (c) => ({
      id: c.id,
      asproId: c.asproId,
      name: c.name,
      brand: c.brand,
      contactPerson: c.contactPerson,
      contact: c.contact,
      status: c.status,
      createdAt: iso(c.createdAt),
      updatedAt: iso(c.updatedAt),
    }),
  });
}
