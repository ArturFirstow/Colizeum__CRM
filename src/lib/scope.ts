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

/** where-фрагмент «записи в области видимости».
 *  Руководитель — весь отдел; остальные — только свои. */
export function ownScope(session: SessionPayload) {
  return isLeadership(session) ? {} : { ownerId: session.userId };
}

/** where-фрагмент «сущности, привязанные к клиентам в области видимости». */
export function advertiserScope(session: SessionPayload) {
  return { advertiser: ownScope(session) };
}

/** Можно ли этому пользователю видеть запись с данным ownerId. */
export function canSeeOwned(session: SessionPayload, ownerId: string | null): boolean {
  if (isLeadership(session)) return true;
  return ownerId === session.userId;
}
