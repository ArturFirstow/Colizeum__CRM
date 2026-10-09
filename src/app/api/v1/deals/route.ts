import { NextRequest } from "next/server";
import { prisma, serveList, iso } from "@/lib/services/api-v1";

// Сделки. Суммы отдаются как введены — ЧИСТЫМИ, без НДС: правило сервиса одно
// на всех (см. CLAUDE.md, «Единый вид денег»). Пересчитывать на стороне
// принимающей системы — её решение, но знать об этом она должна.
export async function GET(req: NextRequest) {
  return serveList(req, {
    scope: "deals",
    title: "Сделки",
    dataKinds: ["название сделки", "стадия", "суммы", "сроки", "номер договора"],
    find: (args) => prisma.deal.findMany(args),
    count: (where) => prisma.deal.count({ where }),
    shape: (d) => ({
      id: d.id,
      asproId: d.asproId,
      advertiserId: d.advertiserId,
      title: d.title,
      dealType: d.dealType,
      finalBrand: d.finalBrand,
      stage: d.stage,
      urgency: d.urgency,
      amountNet: d.amount,
      contractTotalNet: d.contractTotal,
      currency: d.currency,
      periodText: d.periodText,
      launchDate: iso(d.launchDate),
      paymentTerms: d.paymentTerms,
      contractNumber: d.contractNumber,
      contractDate: iso(d.contractDate),
      blockerActive: d.blockerActive,
      createdAt: iso(d.createdAt),
      updatedAt: iso(d.updatedAt),
    }),
  });
}
