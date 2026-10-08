import "server-only";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Журнал действий с персональными данными.
//
// Требование: кто, когда вошёл, что открыл, изменил, удалил, выгрузил.
// Хранить не меньше года, обычному пользователю не править, и — отдельно
// важное — САМИ ПДн в журнал не попадают.
//
// Поэтому пишем только: кто, когда, что за действие, над какой записью и
// какие ПОЛЯ менялись (названия, без значений). Из такой записи видно
// «Марина открыла карточку клиента 342», но не видно телефона из этой карточки.
//
// Запись в журнал никогда не ломает основное действие: если журнал почему-то
// недоступен, сотрудник всё равно сохранит свою сделку, а сбой уйдёт в консоль
// сервера. Журнал — наблюдатель, а не препятствие.
// ─────────────────────────────────────────────────────────────────────────────

/** Сколько храним. Требование — «не меньше года»; берём 18 месяцев с запасом. */
export const AUDIT_KEEP_DAYS = 550;

export type AuditEntry = {
  userId?: string | null;
  userName?: string | null;
  /** Что произошло: «login.ok», «advertiser.view», «export.clients» и т.п. */
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  /** Названия изменённых полей — без значений. */
  changedFields?: string[] | null;
  ip?: string | null;
  /** false — попытка не удалась (неверный пароль, отказ в доступе). */
  ok?: boolean;
};

/** Пишет строку журнала. Не ждёт и не бросает — вызывающий код не страдает. */
export function writeAudit(entry: AuditEntry): void {
  const fields = entry.changedFields?.length ? entry.changedFields.join(", ") : null;
  prisma.auditLog
    .create({
      data: {
        userId: entry.userId ?? null,
        userName: entry.userName ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        changedFields: fields,
        ip: entry.ip ?? null,
        ok: entry.ok ?? true,
      },
    })
    .catch((e) => {
      // Падение журнала не должно отменять действие сотрудника.
      console.error("[audit] не удалось записать строку журнала:", e);
    });
}

/**
 * Адрес обратившегося. За nginx настоящий адрес приходит заголовком, прямое
 * соединение его не ставит — тогда пишем «неизвестен», а не выдумываем.
 */
export function clientIp(req: NextRequest | Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "неизвестен";
}

/**
 * Какие поля реально меняются. Сравниваем присланное с тем, что уже лежит,
 * чтобы в журнале не было строк «изменил 20 полей», когда поправили одно.
 */
export function changedFieldNames(
  incoming: Record<string, unknown>,
  current: Record<string, unknown> | null,
): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    if (!current) {
      out.push(key);
      continue;
    }
    const was = current[key];
    const nowIso = value instanceof Date ? value.toISOString() : value;
    const wasIso = was instanceof Date ? was.toISOString() : was;
    if (nowIso !== wasIso) out.push(key);
  }
  return out;
}

/** Удаляет записи старше срока хранения. Вызывается при просмотре журнала. */
export async function pruneAudit(): Promise<number> {
  const edge = new Date(Date.now() - AUDIT_KEEP_DAYS * 86400000);
  const res = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: edge } } });
  return res.count;
}

// ── Человеческие названия действий ──────────────────────────────────────────
// Журнал читают люди, а не программисты: «Вход в сервис», а не «login.ok».

const ACTION_LABELS: Record<string, string> = {
  "login.ok": "Вход в сервис",
  "login.fail": "Неудачная попытка входа",
  "login.blocked": "Вход заблокирован: много попыток",
  "logout": "Выход из сервиса",
  "password.change": "Смена пароля",
  "advertiser.view": "Открыл карточку клиента",
  "advertiser.create": "Завёл клиента",
  "advertiser.update": "Изменил клиента",
  "advertiser.delete": "Удалил клиента",
  "contact.create": "Добавил контактное лицо",
  "deal.view": "Открыл сделку",
  "deal.create": "Завёл сделку",
  "deal.update": "Изменил сделку",
  "deal.delete": "Удалил сделку",
  "document.upload": "Загрузил документ",
  "file.upload": "Загрузил файл",
  "file.download": "Скачал файл",
  "export.clients": "Выгрузил клиентов в Excel",
  "handover.send": "Передал дела коллеге",
  "handover.return": "Вернул дела обратно",
  "user.create": "Создал доступ сотруднику",
  "user.update": "Изменил сотрудника",
  "lead.update": "Изменил заявку с сайта",
  "ai.request": "Запрос к ИИ-помощнику",
};

export function describeAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

const ENTITY_LABELS: Record<string, string> = {
  advertiser: "клиент",
  deal: "сделка",
  contact: "контакт",
  document: "документ",
  file: "файл",
  user: "сотрудник",
  lead: "заявка",
  handover: "передача дел",
};

export function describeEntity(entityType: string | null): string {
  if (!entityType) return "";
  return ENTITY_LABELS[entityType] ?? entityType;
}
