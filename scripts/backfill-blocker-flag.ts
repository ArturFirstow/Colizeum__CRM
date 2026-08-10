// ─────────────────────────────────────────────────────────────────────────────
// Разовая миграция: блокер стал «флажок + комментарий».
// Поднимаем флажок там, где раньше был непустой текст блокера, и заодно чистим
// пустые строки (из-за них сделки висели в блокерах, хотя причины уже не было).
//
// Запуск:  npx tsx scripts/backfill-blocker-flag.ts
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const cleared = await prisma.deal.updateMany({
    where: { blocker: "" },
    data: { blocker: null, blockerActive: false },
  });

  const raised = await prisma.deal.updateMany({
    where: { blocker: { not: null }, blockerActive: false },
    data: { blockerActive: true },
  });

  console.log(`Пустых блокеров очищено: ${cleared.count}`);
  console.log(`Флажок поднят у сделок с причиной: ${raised.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
