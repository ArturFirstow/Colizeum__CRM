import { PrismaClient } from "@prisma/client";
import { vatRateForDate } from "../src/lib/enums";

// ─────────────────────────────────────────────────────────────────────────────
// Приведение старых сделок к правилу «в базе лежит ЧИСТАЯ сумма».
//
// Раньше в форме сделки стоял флажок «Сумма с НДС», включённый по умолчанию,
// и было непонятно, какую сумму от вас ждут. Теперь правило одно: вносим
// чистую, НДС считает сервис. У старых записей надо разобраться, что там
// на самом деле лежит.
//
// Запуск (ничего не меняет, только показывает):
//     npx tsx scripts/money-net-rule.ts
//
// Если суммы вносились ЧИСТЫМИ (как в медиаплане) — цифры верные, неверна
// только пометка. Поправить пометку, не трогая цифры:
//     npx tsx scripts/money-net-rule.ts --fix-flag
//
// Если суммы вносились С НДС — цифры надо пересчитать в чистые:
//     npx tsx scripts/money-net-rule.ts --convert
//
// Перед --convert сделайте копию базы: bash deploy/backup.sh
// ─────────────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

const rub = (v: number | null | undefined) =>
  v == null ? "—" : `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(v))} ₽`;

async function main() {
  const mode = process.argv.includes("--convert")
    ? "convert"
    : process.argv.includes("--fix-flag")
      ? "fix-flag"
      : "show";

  const deals = await prisma.deal.findMany({
    where: { vatIncluded: true },
    select: {
      id: true,
      title: true,
      amount: true,
      contractTotal: true,
      contractDate: true,
      advertiser: { select: { nameRu: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (deals.length === 0) {
    console.log("Все сделки уже помечены как «сумма без НДС». Делать нечего.");
    return;
  }

  console.log(`Сделок со старой пометкой «сумма с НДС»: ${deals.length}\n`);

  for (const d of deals) {
    const rate = vatRateForDate(d.contractDate ?? new Date());
    const k = 1 + rate / 100;
    console.log(`• ${d.advertiser.nameRu} — ${d.title}`);
    if (d.amount != null) {
      console.log(
        `    сумма ${rub(d.amount)}:  если это чистая → с НДС ${rub(d.amount * k)}` +
          `  |  если это с НДС → чистая ${rub(d.amount / k)}`,
      );
    }
    if (d.contractTotal != null) {
      console.log(
        `    по договору ${rub(d.contractTotal)}:  если чистая → с НДС ${rub(d.contractTotal * k)}` +
          `  |  если с НДС → чистая ${rub(d.contractTotal / k)}`,
      );
    }
  }

  if (mode === "show") {
    console.log("\nНичего не изменено — это только показ.");
    console.log("Дальше выберите одно:");
    console.log("  --fix-flag   цифры верные (вносили чистые), поправить только пометку");
    console.log("  --convert    цифры с НДС, пересчитать их в чистые");
    return;
  }

  if (mode === "fix-flag") {
    const res = await prisma.deal.updateMany({
      where: { vatIncluded: true },
      data: { vatIncluded: false },
    });
    console.log(`\nГотово: у ${res.count} сделок поправлена пометка. Цифры не тронуты.`);
    return;
  }

  // --convert: пересчитываем суммы в чистые по ставке из даты договора.
  let done = 0;
  for (const d of deals) {
    const rate = vatRateForDate(d.contractDate ?? new Date());
    const k = 1 + rate / 100;
    await prisma.deal.update({
      where: { id: d.id },
      data: {
        amount: d.amount == null ? null : Math.round(d.amount / k),
        contractTotal: d.contractTotal == null ? null : Math.round(d.contractTotal / k),
        vatIncluded: false,
      },
    });
    done++;
  }
  console.log(`\nГотово: пересчитано сделок — ${done}. Суммы теперь чистые, без НДС.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
