import "server-only";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Журнал передач данных во внешние системы (требование 4.12, у Влада — «все
// передачи ПДн фиксируются в журнале»).
//
// Сервис не живёт в вакууме: часть данных уходит наружу — в ИИ-помощник, в
// Telegram, в рабочие Google-таблицы. Пока это нигде не записывалось, ответить
// на вопрос «что и куда мы отдаём» было нечем, а это первый вопрос любой
// проверки.
//
// Записываем КАТЕГОРИИ, а не содержимое: «ушли имена контактных лиц и суммы
// сделок», но не сами имена и суммы. Иначе журнал передач сам стал бы
// хранилищем персональных данных — ровно то, чего требование избегает.
//
// Четыре канала, и у каждого честно указано, пересекают ли данные границу:
// в политике обработки ПДн это отдельный раздел, скрывать нельзя.
// ─────────────────────────────────────────────────────────────────────────────

export type TransferTarget = "ai" | "telegram" | "sheet-out" | "sheet-in";

export type TransferChannel = {
  target: TransferTarget;
  /** Как называется канал на экране. */
  title: string;
  /** Что именно туда уходит. */
  what: string;
  /** Где находится принимающая сторона. */
  where: string;
  /** Пересекают ли данные границу РФ. */
  crossBorder: boolean;
  /** На каком основании передаём. */
  basis: string;
};

export const TRANSFER_CHANNELS: TransferChannel[] = [
  {
    target: "ai",
    title: "ИИ-помощник",
    what:
      "Текст запроса сотрудника и выдержки из карточек, которые он просил разобрать: " +
      "названия клиентов, имена контактных лиц, суммы и сроки сделок, расшифровки встреч.",
    where: "Сервер провайдера ИИ, выбранного в настройках.",
    crossBorder: true,
    basis:
      "Исполнение трудовых обязанностей работника. ⚠️ Передача трансграничная — " +
      "описана в разделе 5 политики обработки ПДн. Отключается удалением ключа из настроек.",
  },
  {
    target: "telegram",
    title: "Уведомления в Telegram",
    what:
      "Имя отправителя, короткий текст уведомления, название клиента или сделки. " +
      "Реквизитов, телефонов и сумм договоров в уведомлениях нет.",
    where: "Серверы Telegram.",
    crossBorder: true,
    basis:
      "Исполнение трудовых обязанностей. ⚠️ Передача трансграничная. " +
      "Отключается удалением токена бота из настроек.",
  },
  {
    target: "sheet-out",
    title: "Отчётность по встречам в Google-таблицу",
    what: "Строка отчёта: дата, участники встречи, клиент, продолжительность, ссылки, итоги.",
    where: "Google-таблица отдела.",
    crossBorder: true,
    basis:
      "Отчётность отдела перед руководством. ⚠️ Передача трансграничная. " +
      "Отключается удалением адреса таблицы из настроек.",
  },
  {
    target: "sheet-in",
    title: "Заявки с сайта из Google-таблицы",
    what:
      "Обратное направление: сервис ЧИТАЕТ обращения с формы сайта — " +
      "имя, компания, контакт, текст обращения.",
    where: "Google-таблица, куда пишет форма сайта.",
    crossBorder: true,
    basis:
      "Обращение человека по собственной инициативе через форму на сайте. " +
      "⚠️ Сами данные при этом хранятся в Google — см. требование 4.4.",
  },
];

export function channelOf(target: string): TransferChannel | undefined {
  return TRANSFER_CHANNELS.find((c) => c.target === target);
}

export type TransferMeta = {
  userId?: string | null;
  userName?: string | null;
  /** Зачем передавали: «Саммари клиента», «Разбор транскрипта встречи». */
  purpose: string;
  /** Категории данных — названиями, без значений. */
  dataKinds: string[];
};

/**
 * Записывает факт передачи. Как и журнал действий, ничего не ломает: передача
 * важнее записи о ней, поэтому ошибку глотаем в консоль.
 */
export function logTransfer(target: TransferTarget, meta: TransferMeta): void {
  prisma.auditLog
    .create({
      data: {
        action: `transfer.${target}`,
        userId: meta.userId ?? null,
        userName: meta.userName ?? null,
        entityType: "transfer",
        entityId: target,
        changedFields: [meta.purpose, ...meta.dataKinds].join(", "),
        ip: null,
        ok: true,
      },
    })
    .catch((e) => console.error("[transfers] не удалось записать передачу:", e));
}

export type TransferSummary = TransferChannel & { count: number; lastAt: Date | null };

/** Сводка «куда уходили данные» за период — для экрана журнала. */
export async function transferSummary(since: Date): Promise<TransferSummary[]> {
  return Promise.all(
    TRANSFER_CHANNELS.map(async (c) => {
      const where = { action: `transfer.${c.target}`, createdAt: { gt: since } };
      const [count, last] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findFirst({
          where: { action: `transfer.${c.target}` },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ]);
      return { ...c, count, lastAt: last?.createdAt ?? null };
    }),
  );
}
