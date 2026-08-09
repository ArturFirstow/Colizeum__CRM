"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, Check, X, Paperclip } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";
import { FileCell } from "@/components/ui/FileCell";
import { formatDate } from "@/lib/format";

export type DecisionItem = {
  id: string;
  title: string;
  details: string | null;
  kind: string;
  status: string;
  answer: string | null;
  createdAt: string;
  attachmentsKey: string | null;
  requester: { id: string; name: string };
  advertiser: { id: string; nameRu: string } | null;
  deal: { id: string; title: string } | null;
};

const KINDS = ["Согласование", "Доступ", "Деньги", "Другое"] as const;

// Ключ группы вложений для ещё не отправленного вопроса.
function newKey(): string {
  return `dr_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

// Кнопка сотрудника: отправить вопрос руководителю.
export function AskLeaderButton({
  advertisers,
  deals,
}: {
  advertisers: { id: string; nameRu: string }[];
  deals: { id: string; title: string; advertiserId: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ title: "", details: "", kind: "Согласование", advertiserId: "", dealId: "" });
  // Ключ группы вложений заводим ДО отправки — тогда файлы можно приложить
  // прямо в форме, а не «сначала создай, потом прикрепи».
  const [attachmentsKey, setAttachmentsKey] = useState(() => newKey());

  const dealsForAdv = f.advertiserId ? deals.filter((d) => d.advertiserId === f.advertiserId) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/decisions", {
        method: "POST",
        body: JSON.stringify({
          title: f.title,
          details: f.details || undefined,
          kind: f.kind,
          advertiserId: f.advertiserId || undefined,
          dealId: f.dealId || undefined,
          attachmentsKey,
        }),
      });
      setF({ title: "", details: "", kind: "Согласование", advertiserId: "", dealId: "" });
      setAttachmentsKey(newKey());
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="card card-hover flex w-full items-center gap-3 p-4 text-left !border-brand/40"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
          <HelpCircle size={18} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink-50">Саша, окни пожалуйста</span>
          <span className="block text-xs text-ink-400">
            Вопрос, согласование, доступ — можно приложить файл
          </span>
        </span>
        <span className="ml-auto shrink-0 text-xs font-medium text-brand">Задать →</span>
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Саша, окни пожалуйста"
        subtitle="Запрос появится у руководителя в блоке «Решения, которые ждут вас»"
      >
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Что нужно решить *</label>
            <input
              className="input"
              value={f.title}
              onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))}
              placeholder="Например: согласовать макет для размещения МТС"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Тип вопроса</label>
            <select className="input" value={f.kind} onChange={(e) => setF((s) => ({ ...s, kind: e.target.value }))}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">По какому клиенту</label>
              <select
                className="input"
                value={f.advertiserId}
                onChange={(e) => setF((s) => ({ ...s, advertiserId: e.target.value, dealId: "" }))}
              >
                <option value="">— не важно —</option>
                {advertisers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nameRu}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">По какой сделке</label>
              <select
                className="input"
                value={f.dealId}
                onChange={(e) => setF((s) => ({ ...s, dealId: e.target.value }))}
                disabled={!f.advertiserId}
              >
                <option value="">— не важно —</option>
                {dealsForAdv.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Подробности</label>
            <textarea
              className="input"
              value={f.details}
              onChange={(e) => setF((s) => ({ ...s, details: e.target.value }))}
              placeholder="Что уже сделано, что мешает, к какому сроку нужен ответ"
            />
          </div>
          <div>
            <label className="label">Файлы к вопросу</label>
            <FileCell
              ownerType="decision"
              ownerId={attachmentsKey}
              kind="Прочее"
              advertiserId={f.advertiserId || undefined}
              dealId={f.dealId || undefined}
              label="Приложить файл (макет, счёт, переписка)"
              compact
            />
          </div>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Отправляю…" : "Отправить"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// Карточка запроса в блоке руководителя: видно, кто спрашивает и по чему.
export function DecisionRequestCard({ item, canDecide }: { item: DecisionItem; canDecide: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState("");

  async function resolve(status: "Решён" | "Отклонён") {
    setBusy(true);
    try {
      await apiFetch(`/api/decisions/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, answer: answer || undefined }),
      });
      setAnswering(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`card p-4 !border-brand/30 ${busy ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-ink-50">{item.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-400">
            <span className="badge badge-brand">{item.kind}</span>
            <span>от {item.requester.name}</span>
            {item.advertiser && <span>· {item.advertiser.nameRu}</span>}
            {item.deal && <span>· {item.deal.title}</span>}
            <span>· {formatDate(item.createdAt)}</span>
          </div>
        </div>
      </div>

      {item.details && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-300">{item.details}</p>}

      {item.attachmentsKey && (
        <div className="mt-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-ink-500">
            <Paperclip size={12} /> Файлы к вопросу
          </div>
          <FileCell ownerType="decision" ownerId={item.attachmentsKey} label="Добавить файл" compact />
        </div>
      )}

      {canDecide && (
        <div className="mt-3">
          {answering ? (
            <div className="space-y-2">
              <textarea
                className="input min-h-[64px]"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Ответ сотруднику (необязательно)"
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => resolve("Решён")}>
                  <Check size={14} /> Решено
                </button>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => resolve("Отклонён")}>
                  <X size={14} /> Отклонить
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setAnswering(false)}>
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => resolve("Решён")}>
                <Check size={14} /> Решено
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAnswering(true)}>
                Ответить и закрыть
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Мои отправленные вопросы — сотрудник видит статус и ответ.
export function MyDecisionRequests({ items }: { items: DecisionItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((r) => (
        <div key={r.id} className="surface px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink-100">{r.title}</span>
            <span
              className={`badge ${
                r.status === "Открыт" ? "badge-brand" : r.status === "Решён" ? "bg-emerald-500/15 text-emerald-300" : "badge-muted"
              }`}
            >
              {r.status === "Открыт" ? "ждёт ответа" : r.status.toLowerCase()}
            </span>
          </div>
          {r.answer && <div className="mt-1 text-xs text-ink-400">Ответ: {r.answer}</div>}
        </div>
      ))}
    </div>
  );
}
