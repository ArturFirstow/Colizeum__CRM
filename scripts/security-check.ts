/**
 * Ежемесячная проверка обновлений и уязвимостей (требование 5.9).
 *
 * Требование просит две вещи: раз в месяц проверять зависимости — и
 * ФИКСИРОВАТЬ результат. Без второй половины проверка бесполезна: через
 * полгода никто не вспомнит, делали её или нет.
 *
 * Поэтому скрипт не только запускает проверку, но и дописывает строку в
 * `docs/ЖУРНАЛ_ОБНОВЛЕНИЙ.md` — дата, что нашлось, что устарело. Файл лежит
 * в репозитории, значит история сохраняется и видна проверяющему.
 *
 * Запуск:
 *   npm run security:check          — проверить и записать в журнал
 *   npm run security:check -- --dry — только показать, не записывать
 *
 * В расписание (первое число каждого месяца) — см. docs/ДЕПЛОЙ.md.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const LOG = path.join(process.cwd(), "docs", "ЖУРНАЛ_ОБНОВЛЕНИЙ.md");

type AuditCounts = { critical: number; high: number; moderate: number; low: number };

function runJson(args: string[]): unknown {
  try {
    const out = execFileSync("npm", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    return JSON.parse(out);
  } catch (e) {
    // npm audit выходит с ненулевым кодом, когда уязвимости найдены, —
    // это не ошибка запуска, вывод в таком случае всё равно корректный JSON.
    const err = e as { stdout?: string };
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout);
      } catch {
        /* ниже */
      }
    }
    return null;
  }
}

function audit(): { counts: AuditCounts; names: string[] } | null {
  const data = runJson(["audit", "--json"]) as
    | { metadata?: { vulnerabilities?: Partial<AuditCounts> }; vulnerabilities?: Record<string, unknown> }
    | null;
  if (!data) return null;
  const v = data.metadata?.vulnerabilities ?? {};
  return {
    counts: {
      critical: v.critical ?? 0,
      high: v.high ?? 0,
      moderate: v.moderate ?? 0,
      low: v.low ?? 0,
    },
    names: Object.keys(data.vulnerabilities ?? {}).sort(),
  };
}

function outdated(): { name: string; current: string; latest: string }[] {
  const data = runJson(["outdated", "--json"]) as Record<
    string,
    { current?: string; latest?: string }
  > | null;
  if (!data) return [];
  return Object.entries(data)
    .map(([name, v]) => ({ name, current: v.current ?? "—", latest: v.latest ?? "—" }))
    .filter((p) => p.current !== p.latest);
}

function main() {
  const dry = process.argv.includes("--dry");
  const today = new Date().toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });

  console.log("Проверяем зависимости — это занимает полминуты…\n");
  const a = audit();
  const old = outdated();

  if (!a) {
    console.log("Проверка уязвимостей не отработала (нет сети или npm недоступен).");
    return;
  }

  const { critical, high, moderate, low } = a.counts;
  const bad = critical + high;
  const verdict =
    bad > 0
      ? `⚠️ ТРЕБУЕТ ДЕЙСТВИЙ: критических ${critical}, высоких ${high}`
      : moderate + low > 0
        ? `в порядке: критических и высоких нет, умеренных ${moderate}, низких ${low}`
        : "в порядке: уязвимостей не найдено";

  console.log(verdict);
  if (a.names.length) console.log("Пакеты с замечаниями: " + a.names.join(", "));
  console.log(
    old.length
      ? `Устарело пакетов: ${old.length}` +
          (old.length <= 8
            ? " — " + old.map((p) => `${p.name} ${p.current}→${p.latest}`).join(", ")
            : "")
      : "Все пакеты на свежих версиях.",
  );

  if (dry) {
    console.log("\nРежим показа: в журнал ничего не записано.");
    return;
  }

  const line =
    `\n## ${today}\n\n` +
    `- Уязвимости: ${verdict}\n` +
    (a.names.length ? `- Пакеты с замечаниями: ${a.names.join(", ")}\n` : "") +
    `- Устарело пакетов: ${old.length}` +
    (old.length && old.length <= 15
      ? ` (${old.map((p) => `${p.name} ${p.current}→${p.latest}`).join(", ")})`
      : "") +
    `\n- Что сделано по итогам: _заполнить_\n`;

  const head =
    "# Журнал проверок обновлений\n\n" +
    "Требование 5.9: раз в месяц проверять зависимости и фиксировать результат.\n" +
    "Записи добавляет `npm run security:check`. Строку «что сделано по итогам»\n" +
    "заполняет человек — скрипт не знает, обновили пакет или решили подождать.\n";

  if (!fs.existsSync(LOG)) fs.writeFileSync(LOG, head, "utf8");
  fs.appendFileSync(LOG, line, "utf8");
  console.log(`\nЗапись добавлена в docs/ЖУРНАЛ_ОБНОВЛЕНИЙ.md — допишите, что сделали по итогам.`);
  if (bad > 0) process.exitCode = 1;
}

main();
