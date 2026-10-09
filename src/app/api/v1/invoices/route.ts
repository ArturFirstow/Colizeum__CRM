import { NextRequest } from "next/server";
import { prisma, serveList, iso } from "@/lib/services/api-v1";

// Счета. ⚠️ Их сумму переписывают с настоящего документа, где она уже С НДС, —
// в отличие от сделок, где сумма чистая. Поле названо так, чтобы на стороне
// принимающей системы это нельзя было перепутать.
export async function GET(req: NextRequest) {
  return serveList(req, {
    scope: "invoices",
    title: "Счета",
    dataKinds: ["номер и основание счёта", "сумма", "дата выставления"],
    find: (args) => prisma.invoice.findMany(args),
    count: (where) => prisma.invoice.count({ where }),
    shape: (i) => ({
      id: i.id,
      asproId: i.asproId,
      dealId: i.dealId,
      number: i.number,
      basis: i.basis,
      service: i.service,
      amountGross: i.amount,
      vatRate: i.vatRate,
      appendixNo: i.appendixNo,
      issuedAt: iso(i.issuedAt),
      createdAt: iso(i.createdAt),
      updatedAt: iso(i.updatedAt),
    }),
  });
}
