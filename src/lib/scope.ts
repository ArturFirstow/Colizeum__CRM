import type { SessionPayload } from "@/lib/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Личные кабинеты + роли.
//   Менеджер (Manager)     — видит только свои данные.
//   Руководитель (Director) — видит весь отдел (сводки + каждого сотрудника).
//   Админ (Owner)           — то же, что руководитель, плюс управление доступами;
//                             ведёт своих клиентов как менеджер.
// Общее для всех: база знаний, календарь размещений, справочники.
// ─────────────────────────────────────────────────────────────────────────────

/** Руководитель или админ — видят весь отдел и кабинет руководителя. */
export function isLeadership(session: SessionPayload): boolean {
  return session.role === "Owner" || session.role === "Director";
}

/** where-фрагмент «записи, доступные этому пользователю» (по полю ownerId).
 *  Руководство видит всё (в т.ч. данные без владельца — до разделения). */
export function ownScope(session: SessionPayload) {
  return isLeadership(session)
    ? { OR: [{ ownerId: session.userId }, { ownerId: null }, { NOT: { ownerId: null } }] }
    : { ownerId: session.userId };
}

/** where-фрагмент «сущности, привязанные к клиентам в области видимости». */
export function advertiserScope(session: SessionPayload) {
  return { advertiser: ownScope(session) };
}

/** Можно ли этому пользователю видеть запись с данным ownerId. */
export function canSeeOwned(session: SessionPayload, ownerId: string | null): boolean {
  if (ownerId === session.userId) return true;
  return isLeadership(session);
}
