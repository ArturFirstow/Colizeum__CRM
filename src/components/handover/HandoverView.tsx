"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Sparkles, Undo2 } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { FormError } from "@/components/ui/Modal";
import { formatDate } from "@/lib/format";

type Adv = { id: string; nameRu: string; _count: { deals: number; documents: number } };
type UserOpt = { id: string; name: string };
type Handover = {
  id: string;
  fromUserId: string;
  status: string;
  reason: string | null;
  note: string | null;
  summary: string | null;
  startsAt: string | Date;
  endsAt: string | Date | null;
  from: { id: string; name: string };
  to: { id: string; name: string };
  items: { id: string; advertiserId: string }[];
};

const REASONS = ["Отпуск", "Больничный", "Командировка", "Другое"] as const;

export function HandoverView({
  advertisers,
  colleagues,
  active,
  history,
  meId,
}: {
  advertisers: Adv[];
  colleagues: UserOpt[];
  active: Handover[];
  history: Handover[];
  meId: string;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [toUserId, setToUserId] = useState("");
  const [reason, setReason] = useState<string>("Отпуск");
  const [endsAt, setEndsAt] = useState("");
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState("");
  const [building, setBuilding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    // Состав изменился — старое саммари больше не про этих клиентов.
    setSummary("");
  }

  async function buildSummary() {
    setError(null);
    setBuilding(true);
    try {
      const d = (await apiFetch("/api/handover/preview", {
        method: "POST",
        body: JSON.stringify({ advertiserIds: picked }),
      })) as { summary: string };
      setSummary(d.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBuilding(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/handover", {
        method: "POST",
        body: JSON.stringify({
          toUserId,
          advertiserIds: picked,
          reason,
          endsAt: endsAt || undefined,
          note: note.trim() || undefined,
          summary: summary.trim() || undefined,
        }),
      });
      setPicked([]);
      setSummary("");
      setNote("");
      setEndsAt("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function giveBack(id: string) {
    await apiFetch(`/api/handover/${id}/return`, { method: "POST" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Активные передачи — сверху, это то, что происходит прямо сейчас */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-ink-50">Сейчас передано</h2>
          {active.map((h) => {
            const mine = h.fromUserId === meId;
            return (
              <div key={h.id} className="card p-5 !border-brand/30">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-ink-50">
                      {h.from.name}
                      <ArrowLeftRight size={15} className="text-brand" />
                      {h.to.name}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-400">
                      {h.reason ?? "Передача"} · {h.items.length} клиентов · с {formatDate(h.startsAt)}
                      {h.endsAt ? ` до ${formatDate(h.endsAt)}` : ""}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => giveBack(h.id)}>
                    <Undo2 size={14} /> Вернуть дела
                  </button>
                </div>
                {h.note && <p className="mt-3 text-sm text-ink-300">{h.note}</p>}
                {h.summary && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-brand hover:underline">
                      Саммари по клиентам
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-ink-900/60 p-3 font-sans text-sm text-ink-200">
                      {h.summary}
                    </pre>
                  </details>
                )}
                {!mine && (
                  <p className="mt-2 text-xs text-ink-500">
                    Эти клиенты сейчас в вашем кабинете — работайте с ними как со своими.
                  </p>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Форма передачи */}
      <form onSubmit={submit} className="card p-5">
        <h2 className="text-lg font-bold text-ink-50">Передать дела</h2>
        <p className="mt-0.5 text-sm text-ink-400">
          Выбранные клиенты со всеми сделками, документами и сроками перейдут в кабинет коллеги.
          Вернуть — одной кнопкой.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Кому *</label>
            <select className="input" value={toUserId} onChange={(e) => setToUserId(e.target.value)} required>
              <option value="">— выбрать —</option>
              {colleagues.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Причина</label>
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Вернуть до</label>
            <input className="input" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <label className="label">Каких клиентов передаём *</label>
          {advertisers.length === 0 ? (
            <p className="text-sm text-ink-500">У вас пока нет клиентов.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {advertisers.map((a) => (
                <label
                  key={a.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition ${
                    picked.includes(a.id)
                      ? "border-brand/50 bg-brand/10"
                      : "border-ink-800 bg-ink-900/40 hover:border-ink-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    checked={picked.includes(a.id)}
                    onChange={() => toggle(a.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-100">{a.nameRu}</span>
                    <span className="block text-xs text-ink-500">
                      {a._count.deals} сделок · {a._count.documents} док.
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Саммари — главное в передаче: коллега должен понять, что происходит */}
        <div className="mt-4">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label className="label !mb-0">Саммари для коллеги</label>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={buildSummary}
              disabled={building || picked.length === 0}
            >
              <Sparkles size={14} /> {building ? "Собираю…" : "Собрать саммари"}
            </button>
          </div>
          <textarea
            className="input min-h-[160px] font-mono text-xs"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Выберите клиентов и нажмите «Собрать саммари» — сервис соберёт, где сейчас работа, что оплачено, что горит и на что обратить внимание. Текст можно поправить перед отправкой."
          />
        </div>

        <div className="mt-4">
          <label className="label">Что важно знать коллеге</label>
          <textarea
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Личные договорённости, с кем созваниваться, чего не делать"
          />
        </div>

        <div className="mt-4">
          <FormError message={error} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-ink-500">
            {picked.length > 0 ? `Выбрано клиентов: ${picked.length}` : "Клиенты не выбраны"}
          </span>
          <button type="submit" className="btn btn-primary" disabled={saving || picked.length === 0 || !toUserId}>
            {saving ? "Передаю…" : "Передать дела"}
          </button>
        </div>
      </form>

      {/* История */}
      {history.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-ink-50">История передач</h2>
          <div className="card divide-y divide-ink-800">
            {history.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="text-ink-200">
                  {h.from.name} → {h.to.name}
                </span>
                <span className="text-xs text-ink-500">
                  {h.reason ?? "передача"} · {h.items.length} клиентов · {formatDate(h.startsAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
