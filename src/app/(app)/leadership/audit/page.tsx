import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { describeAction, describeEntity, pruneAudit, AUDIT_KEEP_DAYS } from "@/lib/audit";
import { canSeeCompliance } from "@/lib/scope";
import { recentAlerts } from "@/lib/services/security-alerts";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

// ─────────────────────────────────────────────────────────────────────────────
// Журнал действий с персональными данными (требование 5.3).
//
// Только чтение: правят журнал не люди, а сервис. Видят руководитель и
// администратор — обычному сотруднику журнал коллег не нужен.
// ─────────────────────────────────────────────────────────────────────────────

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  const session = await requireSession();
  // Журнал — не для рядового сотрудника.
  if (!canSeeCompliance(session)) notFound();

  const { page, action } = await searchParams;
  const pageNo = Math.max(1, Number(page) || 1);

  // Чистку по сроку хранения делаем при открытии журнала: отдельного
  // планировщика в сервисе нет, а журнал открывают регулярно.
  await pruneAudit();

  const where = action ? { action } : {};
  const [rows, total, kinds] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pageNo - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["action"], _count: { action: true } }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const failed = rows.filter((r) => !r.ok).length;

  // Тревоги за две недели — наверх страницы. В общей таблице они теряются
  // среди тысяч обычных строк, а смотреть надо именно их.
  const alerts = await recentAlerts(new Date(Date.now() - 14 * 86400000), 20);

  return (
    <div>
      <PageHeader
        title="Журнал действий"
        subtitle="Кто, когда и что делал с данными клиентов и сотрудников"
        icon="📋"
      />

      <section className="card mb-5 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-2xl font-bold text-ink-50">{total.toLocaleString("ru-RU")}</div>
            <div className="text-xs text-ink-400">записей в журнале</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${failed > 0 ? "text-red-300" : "text-ink-50"}`}>{failed}</div>
            <div className="text-xs text-ink-400">неудачных попыток на этой странице</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-ink-50">{Math.round(AUDIT_KEEP_DAYS / 30)} мес.</div>
            <div className="text-xs text-ink-400">срок хранения (требование — не меньше года)</div>
          </div>
        </div>
        <p className="mt-4 border-t border-ink-800 pt-3 text-xs text-ink-500">
          В журнал намеренно не попадает содержимое записей — только названия изменённых полей.
          Из него видно, кто открывал карточку клиента, но не видно телефона из этой карточки.
        </p>
      </section>

      {/* Тревоги: подбор пароля, вход с нового адреса, выгрузка отдела и прочее,
          о чём сервис сам пишет в Telegram ответственному за безопасность. */}
      <section className="card mb-5 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold text-ink-50">Подозрительная активность</h2>
          <span className="text-xs text-ink-500">за последние 14 дней</span>
        </div>
        {alerts.length === 0 ? (
          <p className="mt-3 text-sm text-ink-400">
            Тревог нет. Сервис сам следит за подбором пароля, входами с незнакомых адресов и
            в нерабочее время, отключением входа по коду, сменой роли и паролей, выгрузкой данных
            всего отдела — и шлёт их в Telegram, как только они появляются.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {alerts.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <b className="text-red-200">{a.label}</b>
                  <span className="text-xs text-ink-500">
                    {a.at.toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="mt-1 text-ink-300">{a.detail}</div>
                <div className="mt-1 text-xs text-ink-500">
                  {a.userName ?? "сотрудник неизвестен"}
                  {a.ip && <span className="ml-2 font-mono">{a.ip}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Фильтр по виду действия */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterLink label="Все" count={total} active={!action} href="/leadership/audit" />
        {kinds
          .sort((a, b) => b._count.action - a._count.action)
          .map((k) => (
            <FilterLink
              key={k.action}
              label={describeAction(k.action)}
              count={k._count.action}
              active={action === k.action}
              href={`/leadership/audit?action=${encodeURIComponent(k.action)}`}
            />
          ))}
      </div>

      <section className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-800 bg-ink-900/60 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-4 py-3 font-medium">Когда</th>
                <th className="px-4 py-3 font-medium">Кто</th>
                <th className="px-4 py-3 font-medium">Что сделал</th>
                <th className="px-4 py-3 font-medium">Над чем</th>
                <th className="px-4 py-3 font-medium">Поля / подробности</th>
                <th className="px-4 py-3 font-medium">Адрес</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-ink-400">
                    Записей пока нет.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className={`border-b border-ink-800/60 ${r.ok ? "" : "bg-red-500/5"}`}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-400">
                      {r.createdAt.toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-200">{r.userName ?? "—"}</td>
                    <td className={`px-4 py-2.5 ${r.ok ? "text-ink-100" : "text-red-300"}`}>
                      {describeAction(r.action)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-400">
                      {describeEntity(r.entityType)}
                      {r.entityId && <span className="ml-1 font-mono opacity-60">{r.entityId.slice(-6)}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-ink-400">{r.changedFields ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-ink-500">{r.ip ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {pages > 1 && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          {pageNo > 1 && (
            <a
              className="btn btn-ghost btn-sm"
              href={`/leadership/audit?page=${pageNo - 1}${action ? `&action=${encodeURIComponent(action)}` : ""}`}
            >
              ← Раньше
            </a>
          )}
          <span className="text-ink-400">
            Страница {pageNo} из {pages}
          </span>
          {pageNo < pages && (
            <a
              className="btn btn-ghost btn-sm"
              href={`/leadership/audit?page=${pageNo + 1}${action ? `&action=${encodeURIComponent(action)}` : ""}`}
            >
              Позже →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function FilterLink({
  label,
  count,
  active,
  href,
}: {
  label: string;
  count: number;
  active: boolean;
  href: string;
}) {
  return (
    <a
      href={href}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "border-brand bg-brand/15 text-brand"
          : "border-ink-800 text-ink-400 hover:border-ink-600 hover:text-ink-200"
      }`}
    >
      {label} <span className="opacity-60">{count}</span>
    </a>
  );
}
