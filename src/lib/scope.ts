import type { SessionPayload } from "@/lib/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Роли и видимость данных.
//   Специалист (Manager)   — видит только своих клиентов/данные.
//   Руководитель (Director) — видит весь отдел (сводки + бюджет + каждый сотрудник).
//   Админ (Owner)           — техническая роль (управление доступами); при этом
//                             сам работает как специалист и видит ТОЛЬКО своих
//                             клиентов. Сводных вкладок у админа нет.
// Общее для всех: база знаний, календарь размещений, справочники.
// ─────────────────────────────────────────────────────────────────────────────

/** Руководитель — единственный, кто видит сводки по отделу и бюджет. */
export function isLeadership(session: SessionPayload): boolean {
  return session.role === "Director";
}

/** Админ (техническая роль) — управление доступами (страница «Команда»). */
export function isAdmin(session: SessionPayload): boolean {
  return session.role === "Owner";
}

/** Безопасность / техническая эксплуатация: журнал, запросы по ПДн, доступы.
 *  Коммерческих данных отдела не видит. */
export function isSecurity(session: SessionPayload): boolean {
  return session.role === "Security";
}

/** Может ли роль работать с данными клиентов (карточки, сделки, деньги). */
export function canSeeClientData(session: SessionPayload): boolean {
  return !isSecurity(session);
}

/**
 * Кому открыт ЖУРНАЛ ДЕЙСТВИЙ: админ, руководитель отдела и безопасность.
 * Руководитель здесь нужен — он смотрит, кто что делал с клиентами отдела.
 */
export function canSeeCompliance(session: SessionPayload): boolean {
  return session.role === "Owner" || session.role === "Director" || isSecurity(session);
}

/**
 * Кому открыты ЗАПРОСЫ ПО ПДн и СРОКИ ХРАНЕНИЯ — только админ и безопасность.
 *
 * Это обязанность оператора персональных данных, а не руководителя отдела:
 * удалять данные человека по его обращению и чистить просроченное — работа
 * ответственного за ПДн. Меню этих пунктов руководителю и так не показывает,
 * проверка здесь закрывает вход по прямой ссылке.
 */
export function canSeePrivacyTools(session: SessionPayload): boolean {
  return session.role === "Owner" || isSecurity(session);
}

/** Турнирный специалист (Артём) — видит турнирный контур вместо рекламного. */
export function isTournaments(session: SessionPayload): boolean {
  return session.track === "Tournaments";
}

/** Доступ к турнирным разделам: сам турнирщик или руководитель (обзор отдела). */
export function canSeeTournaments(session: SessionPayload): boolean {
  return isTournaments(session) || isLeadership(session);
}

/**
 * where-фрагмент «записи в области видимости».
 * Руководитель отдела — весь отдел; остальные — своя пара.
 *
 * «Своя пара» — это сам сотрудник плюс его руководитель проекта и его
 * проектные менеджеры (`teamIds` приходит из `requireSession`). Так Катя видит
 * клиентов Артура и ведёт по ним операционку, но клиенты Марины ей по-прежнему
 * не видны. Пока связка не задана, `teamIds` — это он один, то есть поведение
 * ровно прежнее.
 */
export function ownScope(session: SessionPayload) {
  if (isLeadership(session)) return {};
  const ids = session.teamIds?.length ? session.teamIds : [session.userId];
  return ids.length === 1 ? { ownerId: ids[0] } : { ownerId: { in: ids } };
}

/** where-фрагмент «сущности, привязанные к клиентам в области видимости». */
export function advertiserScope(session: SessionPayload) {
  return { advertiser: ownScope(session) };
}

/** Можно ли этому пользователю видеть запись с данным ownerId. */
export function canSeeOwned(session: SessionPayload, ownerId: string | null): boolean {
  if (isLeadership(session)) return true;
  if (!ownerId) return false;
  const ids = session.teamIds?.length ? session.teamIds : [session.userId];
  return ids.includes(ownerId);
}

/** Есть ли у сотрудника пара «руководитель проекта ↔ менеджер». */
export function hasProjectPair(session: SessionPayload): boolean {
  return (session.teamIds?.length ?? 1) > 1;
}
