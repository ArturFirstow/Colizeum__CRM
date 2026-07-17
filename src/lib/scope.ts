import type { SessionPayload } from "@/lib/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Личные кабинеты: у каждого сотрудника — свои клиенты и всё, что к ним
// привязано (сделки, задачи, финансы, документы, статусы, журнал).
// Общее для всех: база знаний, календарь размещений, справочники.
//
// Owner (администратор сервиса) дополнительно видит записи без владельца —
// это данные, созданные до включения разделения.
// ─────────────────────────────────────────────────────────────────────────────

/** where-фрагмент «записи этого сотрудника» (по полю ownerId). */
export function ownScope(session: SessionPayload) {
  return session.role === "Owner"
    ? { OR: [{ ownerId: session.userId }, { ownerId: null }] }
    : { ownerId: session.userId };
}

/** where-фрагмент «сущности, привязанные к клиентам этого сотрудника». */
export function advertiserScope(session: SessionPayload) {
  return { advertiser: ownScope(session) };
}

/** Можно ли этому сотруднику видеть запись с данным ownerId. */
export function canSeeOwned(session: SessionPayload, ownerId: string | null): boolean {
  if (ownerId === session.userId) return true;
  return session.role === "Owner" && ownerId === null;
}
