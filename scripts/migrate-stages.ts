/**
 * Перевод сделок с девяти стадий на пять (просьба коллег И-6).
 *
 * Было девять шагов, половина из которых описывала не «где сделка», а какую
 * бумагу сейчас готовят. Стало пять. Этот скрипт переводит уже заведённые
 * сделки на новые названия — без него они останутся со старыми, которых в
 * списке больше нет, и будут выглядеть «вне воронки».
 *
 * Запуск:
 *   npm run stages:migrate            — перевести
 *   npm run stages:migrate -- --dry   — только показать, что изменится
 *
 * Прежнее название сохраняется в примечании сделки одной строкой — чтобы при
 * спорном случае было видно, откуда запись приехала. Ничего не удаляется.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Что во что превращается. Слева — как было, справа — как стало. */
const MAP: Record<string, string> = {
  Лид: "Лид",
  "КП / условия": "Лид",
  Договор: "Договор",
  "Приложение / спец.": "Договор",
  Предоплата: "Оплата",
  "Материалы + ОРД": "Размещение",
  Размещение: "Размещение",
  "УПД + отчёт": "Закрытие",
  Закрытие: "Закрытие",
};

const NEW_STAGES = ["Лид", "Договор", "Оплата", "Размещение", "Закрытие"];

async function main() {
  const dry = process.argv.includes("--dry");
  const deals = await prisma.deal.findMany({
    select: { id: true, title: true, stage: true, notes: true },
  });

  const todo = deals.filter((d) => !NEW_STAGES.includes(d.stage));
  console.log(`\nСделок всего: ${deals.length}. Нужно перевести: ${todo.length}.\n`);

  if (todo.length === 0) {
    console.log("Все сделки уже на новых стадиях — делать нечего.\n");
    return;
  }

  const counts = new Map<string, number>();
  for (const d of todo) {
    const to = MAP[d.stage];
    const key = `${d.stage} → ${to ?? "НЕ ЗНАЮ, оставлю как есть"}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [k, n] of counts) console.log(`  ${k.padEnd(44)} ${n}`);

  if (dry) {
    console.log("\nРежим показа: ничего не менялось.\n");
    return;
  }

  let done = 0;
  for (const d of todo) {
    const to = MAP[d.stage];
    if (!to) {
      console.log(`  ⚠ «${d.title}»: стадия «${d.stage}» незнакомая, пропускаю`);
      continue;
    }
    const mark = `[стадия до перевода: ${d.stage}]`;
    await prisma.deal.update({
      where: { id: d.id },
      data: {
        stage: to,
        // Прежнее название дописываем в примечание: если по сделке возникнет
        // спор, будет видно, откуда она приехала. Ничего не затираем.
        notes: d.notes ? `${d.notes}\n${mark}` : mark,
      },
    });
    done++;
  }
  console.log(`\nПереведено сделок: ${done}.\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Перевод не выполнен:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
