import "server-only";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { AUDIT_KEEP_DAYS, pruneAudit } from "@/lib/audit";

// ─────────────────────────────────────────────────────────────────────────────
// Сроки хранения данных и уборка просроченного (требование 4.7).
//
// Закон не разрешает хранить данные о людях «просто так, вдруг пригодится»:
// у каждого набора должен быть срок, после которого его удаляют или
// обезличивают. Раньше сроков не было вовсе — всё лежало вечно.
//
// ⚠️ ВАЖНО ПРО ЦИФРЫ. Сам механизм — код, а конкретные сроки — решение
// ответственного за обработку ПДн и юриста. Поэтому у каждого правила есть
// пометка `confirmed`: пока она false, срок считается ПРЕДЛОЖЕНИЕМ, на экране
// так и подписан, и уборка по нему не запускается автоматически. Согласовали —
// меняете `confirmed: true` здесь, и правило начинает работать.
//
// Не выдумывайте сроки «из головы»: единственный, что уже решён, — журнал
// действий (требование 5.3 просит «не меньше года», взяли 18 месяцев).
//
// Что делаем по истечении срока — две разные вещи:
//   удаление      — запись исчезает целиком;
//   обезличивание — остаётся строка без имени, телефона и почты, чтобы не
//                   рассыпалась статистика («сколько заявок было в мае»).
// ─────────────────────────────────────────────────────────────────────────────

export type RetentionAction = "удаление" | "обезличивание";

export type RetentionRule = {
  id: string;
  /** Что это за набор данных — словами, как увидит человек. */
  title: string;
  /** Какие именно сведения о людях тут лежат. */
  personalData: string;
  /** Срок хранения в месяцах. */
  months: number;
  action: RetentionAction;
  /** Откуда взялся срок. Честно: решено или предложено. */
  basis: string;
  /** Согласован ли срок ответственным за ПДн. */
  confirmed: boolean;
};

export const RETENTION_RULES: RetentionRule[] = [
  {
    id: "audit",
    title: "Журнал действий",
    personalData: "Имя сотрудника, адрес, с которого он работал. Содержимого записей в журнале нет.",
    months: Math.round(AUDIT_KEEP_DAYS / 30),
    action: "удаление",
    basis: "Требование 5.3 просит хранить не меньше года; взяли 18 месяцев с запасом. Срок решён.",
    confirmed: true,
  },
  {
    id: "leads-rejected",
    title: "Заявки с сайта, по которым не стали работать",
    personalData: "Имя, телефон или почта обратившегося, текст обращения.",
    months: 12,
    action: "обезличивание",
    basis:
      "Предложение: год — обычный срок, за который к отказному обращению ещё возвращаются. " +
      "Удалять строку целиком нельзя — рассыплется статистика обращений по месяцам, " +
      "поэтому имя и контакты затираются, а запись остаётся.",
    confirmed: false,
  },
  {
    id: "meeting-files",
    title: "Записи и расшифровки встреч",
    personalData: "Голос участников встречи — это тоже персональные данные. Имена в расшифровке.",
    months: 24,
    action: "удаление",
    basis:
      "Предложение: два года. Файл записи нужен, пока по встрече идёт работа и возможны споры " +
      "о договорённостях; итоги встречи остаются в дневнике текстом и после удаления файла.",
    confirmed: false,
  },
  {
    id: "inbox-files",
    title: "Входящие файлы, которые так и не разобрали",
    personalData: "Что угодно: в «Входящие» попадает всё, что прислали напарнику ИИ.",
    months: 6,
    action: "удаление",
    basis:
      "Предложение: полгода. Неразобранный файл не привязан ни к клиенту, ни к сделке — " +
      "значит, никто не знает, что в нём и зачем он лежит. Это худший вид хранения ПДн.",
    confirmed: false,
  },
];

export type RetentionStatus = RetentionRule & {
  /** Сколько записей уже просрочено прямо сейчас. */
  overdue: number;
  /** Сколько всего таких записей. */
  total: number;
};

function edgeFor(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

// ── Подсчёт просроченного ────────────────────────────────────────────────────

async function countFor(rule: RetentionRule): Promise<{ overdue: number; total: number }> {
  const edge = edgeFor(rule.months);
  switch (rule.id) {
    case "audit": {
      const [overdue, total] = await Promise.all([
        prisma.auditLog.count({ where: { createdAt: { lt: edge } } }),
        prisma.auditLog.count(),
      ]);
      return { overdue, total };
    }
    case "leads-rejected": {
      const where = {
        status: "Отказ",
        updatedAt: { lt: edge },
        // Уже обезличенные второй раз не считаем.
        NOT: { AND: [{ name: null }, { contact: null }, { message: null }] },
      };
      const [overdue, total] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.count({ where: { status: "Отказ" } }),
      ]);
      return { overdue, total };
    }
    case "meeting-files": {
      const [overdue, total] = await Promise.all([
        prisma.fileAsset.count({ where: { ownerType: "journal", uploadedAt: { lt: edge } } }),
        prisma.fileAsset.count({ where: { ownerType: "journal" } }),
      ]);
      return { overdue, total };
    }
    case "inbox-files": {
      const [overdue, total] = await Promise.all([
        prisma.fileAsset.count({ where: { ownerType: "inbox", uploadedAt: { lt: edge } } }),
        prisma.fileAsset.count({ where: { ownerType: "inbox" } }),
      ]);
      return { overdue, total };
    }
    default:
      return { overdue: 0, total: 0 };
  }
}

/** Таблица сроков с текущими цифрами — для экрана и для отчёта. */
export async function retentionStatus(): Promise<RetentionStatus[]> {
  return Promise.all(
    RETENTION_RULES.map(async (r) => ({ ...r, ...(await countFor(r)) })),
  );
}

// ── Уборка ───────────────────────────────────────────────────────────────────

export type SweepResult = { id: string; title: string; done: number; skipped?: string };

/**
 * Убирает просроченное.
 *
 * `onlyConfirmed` по умолчанию true: несогласованные сроки не трогаем, иначе
 * чьё-то предложение «полгода» молча стёрло бы настоящие данные. Экран даёт
 * запустить и несогласованные — но отдельной кнопкой и с предупреждением.
 */
export async function sweepRetention(opts?: {
  onlyConfirmed?: boolean;
  ruleId?: string;
}): Promise<SweepResult[]> {
  const onlyConfirmed = opts?.onlyConfirmed ?? true;
  const out: SweepResult[] = [];

  for (const rule of RETENTION_RULES) {
    if (opts?.ruleId && rule.id !== opts.ruleId) continue;
    if (onlyConfirmed && !rule.confirmed) {
      out.push({ id: rule.id, title: rule.title, done: 0, skipped: "срок не согласован" });
      continue;
    }
    const edge = edgeFor(rule.months);
    let done = 0;

    switch (rule.id) {
      case "audit":
        done = await pruneAudit();
        break;

      case "leads-rejected": {
        // Обезличиваем: строка остаётся, человек в ней больше не узнаётся.
        const res = await prisma.lead.updateMany({
          where: {
            status: "Отказ",
            updatedAt: { lt: edge },
            NOT: { AND: [{ name: null }, { contact: null }, { message: null }] },
          },
          data: { name: null, contact: null, message: null, company: null, comment: null },
        });
        done = res.count;
        break;
      }

      case "meeting-files":
      case "inbox-files": {
        const ownerType = rule.id === "meeting-files" ? "journal" : "inbox";
        const files = await prisma.fileAsset.findMany({
          where: { ownerType, uploadedAt: { lt: edge } },
          select: { id: true, storageKey: true },
        });
        const storage = getStorage();
        for (const f of files) {
          // Сначала файл с диска, потом запись: если упадём между ними, в базе
          // останется строка на отсутствующий файл — это видно и чинится, а
          // наоборот получился бы файл-сирота, про который никто не знает.
          try {
            await storage.delete(f.storageKey);
          } catch {
            // Файла уже нет — считаем, что цель достигнута.
          }
          await prisma.fileAsset.delete({ where: { id: f.id } });
          done += 1;
        }
        break;
      }
    }

    out.push({ id: rule.id, title: rule.title, done });
  }

  return out;
}
