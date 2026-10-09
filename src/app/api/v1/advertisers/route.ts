import { NextRequest } from "next/server";
import { prisma, serveList, iso } from "@/lib/services/api-v1";

// Клиенты (в Aspro — контрагенты). Только чтение, см. api-v1.ts.
export async function GET(req: NextRequest) {
  return serveList(req, {
    scope: "advertisers",
    title: "Клиенты",
    dataKinds: ["название и реквизиты организации", "подписант", "адрес"],
    find: (args) => prisma.advertiser.findMany(args),
    count: (where) => prisma.advertiser.count({ where }),
    shape: (a) => ({
      id: a.id,
      asproId: a.asproId,
      nameRu: a.nameRu,
      nameEn: a.nameEn,
      legalEntity: a.legalEntity,
      type: a.type,
      status: a.status,
      archived: a.archived,
      inn: a.inn,
      kpp: a.kpp,
      ogrn: a.ogrn,
      address: a.address,
      signatory: a.signatory,
      bankName: a.bankName,
      bankAccount: a.bankAccount,
      bik: a.bik,
      createdAt: iso(a.createdAt),
      updatedAt: iso(a.updatedAt),
    }),
  });
}
