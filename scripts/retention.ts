/**
 * Ночная уборка просроченных данных (требование 4.7).
 *
 * Трогает ТОЛЬКО согласованные сроки (`confirmed: true` в
 * src/lib/services/retention.ts). Несогласованные показывает списком, но не
 * выполняет: черновая цифра не должна молча стирать настоящие данные.
 *
 * Запуск руками:
 *   npm run retention            — убрать по согласованным срокам
 *   npm run retention -- --dry   — только посчитать, ничего не менять
 *
 * Запускать именно через npm: там подставляется флаг, без которого скрипт не
 * видит служебные модули сервиса (они помечены «только для сервера»).
 *
 * В расписание (раз в сутки, ночью) — см. docs/ДЕПЛОЙ.md:
 *   30 4 * * * cd /var/www/colizeum && npm run retention >> /var/log/colizeum-retention.log 2>&1
 */
import { retentionStatus, sweepRetention } from "../src/lib/services/retention";
import { writeAudit } from "../src/lib/audit";

async function main() {
  const dry = process.argv.includes("--dry");
  const stamp = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
  console.log(`\n[${stamp}] Сроки хранения\n`);

  const rules = await retentionStatus();
  for (const r of rules) {
    const mark = r.confirmed ? "✓" : "…";
    console.log(
      `  ${mark} ${r.title}: храним ${r.months} мес., просрочено ${r.overdue} из ${r.total}` +
        (r.confirmed ? "" : "  (срок не согласован — не трогаем)"),
    );
  }

  if (dry) {
    console.log("\n  Режим подсчёта: ничего не менялось.");
    return;
  }

  const results = await sweepRetention({ onlyConfirmed: true });
  const total = results.reduce((s, x) => s + x.done, 0);
  console.log("");
  for (const x of results) {
    if (x.skipped) continue;
    console.log(`  убрано — ${x.title}: ${x.done}`);
  }
  console.log(`\n  Итого убрано записей: ${total}`);

  if (total > 0) {
    writeAudit({
      action: "retention.sweep",
      userName: "ночная уборка",
      entityType: "security",
      entityId: "по расписанию",
      changedFields: results.filter((x) => x.done > 0).map((x) => `${x.title}: ${x.done}`),
    });
    // writeAudit не ждёт завершения — даём записи дойти до базы.
    await new Promise((r) => setTimeout(r, 500));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Уборка не выполнена:", e);
    process.exit(1);
  });
