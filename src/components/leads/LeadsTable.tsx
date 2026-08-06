"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Search, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { formatDateTime } from "@/lib/format";
import { leadStatusStyle } from "@/lib/ui-tokens";
import { LEAD_STATUSES } from "@/lib/enums";
import { EmptyState } from "@/components/ui/primitives";

type Lead = {
  id: string;
  name: string | null;
  company: string | null;
  contact: string | null;
  message: string | null;
  referer: string | null;
  sentAt: string | null;
  status: string;
  comment: string | null;
  assignedTo: { id: string; name: string } | null;
};

type Filter = "Все" | "Новые" | "Мои" | "В работе";
const FILTERS: Filter[] = ["Все", "Новые", "Мои", "В работе"];

export function LeadsTable({
  leads,
  users,
  me,
  sheetUrl,
  syncError,
}: {
  leads: Lead[];
  users: { id: string; name: string }[];
  me: { id: string; name: string };
  sheetUrl: string;
  syncError: string | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("Все");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(syncError);
  const [note, setNote] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      Все: leads.length,
      Новые: leads.filter((l) => l.status === "Новая").length,
      Мои: leads.filter((l) => l.assignedTo?.id === me.id).length,
      "В работе": leads.filter((l) => l.status === "В работе").length,
    }),
    [leads, me.id],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (filter === "Новые" && l.status !== "Новая") return false;
      if (filter === "Мои" && l.assignedTo?.id !== me.id) return false;
      if (filter === "В работе" && l.status !== "В работе") return false;
      if (!q) return true;
      return [l.name, l.company, l.contact, l.message].some((v) => v?.toLowerCase().includes(q));
    });
  }, [leads, filter, query, me.id]);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setBusyId(null);
    }
  }

  async function sync() {
    setSyncing(true);
    setError(null);
    setNote(null);
    try {
      const r = await apiFetch<{ added: number; total: number }>("/api/leads/sync", { method: "POST" });
      setNote(r.added > 0 ? `Новых заявок: ${r.added}` : `Новых заявок нет (всего в таблице ${r.total})`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      {/* Панель: фильтры, поиск, обновление */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`pill ring-1 ring-inset transition ${
              filter === f
                ? "bg-brand/15 text-brand-200 ring-brand/30"
                : "bg-ink-800/60 text-ink-300 ring-ink-700 hover:bg-ink-800"
            }`}
          >
            {f} <span className="ml-1 opacity-60">{counts[f]}</span>
          </button>
        ))}

        <div className="relative ml-auto">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            className="input h-9 w-56 pl-8 text-sm"
            placeholder="Поиск по имени, тексту…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={sync} disabled={syncing} title="Подтянуть новые заявки из Google-таблицы">
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> Обновить
        </button>
        <a className="btn btn-ghost btn-sm" href={sheetUrl} target="_blank" rel="noreferrer" title="Открыть исходную Google-таблицу">
          <ExternalLink size={14} /> Таблица
        </a>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      )}
      {note && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {note}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon="⚑"
          title={leads.length === 0 ? "Заявок пока нет" : "Ничего не найдено"}
          hint={
            leads.length === 0
              ? "Заявки приходят из формы на colizeum-agency.ru. Нажмите «Обновить», чтобы подтянуть их из Google-таблицы."
              : "Измените фильтр или поисковый запрос."
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-ink-700/70 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-4 py-3 font-medium">Дата</th>
                <th className="px-4 py-3 font-medium">Кто обратился</th>
                <th className="px-4 py-3 font-medium">Контакт</th>
                <th className="px-4 py-3 font-medium">Суть заявки</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Ответственный</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => {
                const open = openId === l.id;
                return (
                  <tr
                    key={l.id}
                    className={`border-b border-ink-800/70 align-top transition last:border-0 hover:bg-ink-800/30 ${
                      busyId === l.id ? "opacity-50" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-ink-400">
                      {l.sentAt ? formatDateTime(l.sentAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-50">{l.name || "—"}</div>
                      {l.company && <div className="mt-0.5 text-xs text-ink-400">{l.company}</div>}
                    </td>
                    <td className="px-4 py-3 text-ink-200">
                      <span className="break-all">{l.contact || "—"}</span>
                    </td>
                    <td className="max-w-md px-4 py-3 text-ink-200">
                      {l.message ? (
                        <>
                          <div className={open ? "whitespace-pre-wrap" : "line-clamp-2"}>{l.message}</div>
                          {l.message.length > 120 && (
                            <button
                              className="mt-1 text-xs text-brand hover:underline"
                              onClick={() => setOpenId(open ? null : l.id)}
                            >
                              {open ? "свернуть" : "показать полностью"}
                            </button>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                      {!open && l.comment && (
                        <div className="mt-1 truncate text-xs text-ink-500">📝 {l.comment}</div>
                      )}
                      {open && (
                        <div className="mt-3 space-y-2">
                          {l.referer && <div className="text-xs text-ink-500">Источник: {l.referer}</div>}
                          <input
                            className="input h-8 w-full text-xs"
                            placeholder="Заметка по заявке (Enter — сохранить)"
                            defaultValue={l.comment ?? ""}
                            disabled={busyId === l.id}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                patch(l.id, { comment: (e.target as HTMLInputElement).value });
                              }
                            }}
                            onBlur={(e) => {
                              if (e.target.value !== (l.comment ?? "")) patch(l.id, { comment: e.target.value });
                            }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className={`input h-8 w-full min-w-[9rem] py-0 text-xs ring-1 ring-inset ${leadStatusStyle(l.status)}`}
                        value={l.status}
                        disabled={busyId === l.id}
                        onChange={(e) => patch(l.id, { status: e.target.value })}
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s} className="bg-ink-850 text-ink-100">
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="input h-8 w-full min-w-[10rem] py-0 text-xs"
                        value={l.assignedTo?.id ?? ""}
                        disabled={busyId === l.id}
                        onChange={(e) => patch(l.id, { assignedToId: e.target.value || null })}
                      >
                        <option value="">— не назначен —</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      {!l.assignedTo && (
                        <button
                          className="mt-1.5 text-xs text-brand hover:underline"
                          disabled={busyId === l.id}
                          onClick={() => patch(l.id, { assignedToId: me.id, status: "В работе" })}
                        >
                          взять себе
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-500">
        Заявки подтягиваются из Google-таблицы формы автоматически при открытии страницы (не чаще раза в 3 минуты) и по кнопке «Обновить».
        Статус, ответственный и комментарии хранятся в CRM — таблица их не перетирает.
      </p>
    </div>
  );
}
