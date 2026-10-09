"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Modal, FormError } from "@/components/ui/Modal";

// ─────────────────────────────────────────────────────────────────────────────
// Служебные ключи доступа к API (требование 9.2).
//
// Экран устроен как список доступов, а не как настройка: у каждого ключа видно
// состояние, срок, разделы и когда им пользовались в последний раз. Забытый
// ключ — это открытая дверь, про которую никто не помнит, поэтому «последний
// раз» стоит прямо в строке.
//
// Выпущенный ключ показывается ОДИН раз. Это не каприз: в базе лежит только
// отпечаток, показать значение второй раз физически неоткуда.
// ─────────────────────────────────────────────────────────────────────────────

const SCOPES: { id: string; label: string }[] = [
  { id: "advertisers", label: "Клиенты" },
  { id: "deals", label: "Сделки" },
  { id: "documents", label: "Документы" },
  { id: "tasks", label: "Задачи" },
  { id: "invoices", label: "Счета" },
  { id: "tournament-contractors", label: "Контрагенты турниров" },
];

type Key = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  useCount: number;
  note: string | null;
  createdAt: string;
  authorName: string | null;
  state: "живой" | "отозван" | "просрочен";
};

function date(s: string | null): string {
  return s ? new Date(s).toLocaleDateString("ru-RU") : "—";
}

export function ApiKeys() {
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [open, setOpen] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [days, setDays] = useState(365);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const r = await apiFetch<{ keys: Key[] }>("/api/api-keys");
      setKeys(r.keys);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const scopes = SCOPES.filter((s) => picked[s.id]).map((s) => s.id);
      const r = await apiFetch<{ key: string; keys: Key[] }>("/api/api-keys", {
        method: "POST",
        body: JSON.stringify({ name, scopes, days, note: note || undefined }),
      });
      setKeys(r.keys);
      setIssued(r.key);
      setOpen(false);
      setName("");
      setNote("");
      setPicked({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function revoke(k: Key) {
    if (!confirm(`Отозвать ключ «${k.name}»?\n\nСистема, которая им пользуется, сразу перестанет получать данные.`))
      return;
    try {
      const r = await apiFetch<{ keys: Key[] }>("/api/api-keys", {
        method: "DELETE",
        body: JSON.stringify({ id: k.id }),
      });
      setKeys(r.keys);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  return (
    <section className="card mt-6 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink-50">Ключи для внешних систем</h2>
          <p className="mt-1 text-sm text-ink-400">
            Ключ выдаётся программе, а не человеку: по нему сторонний сервис забирает данные сам,
            без входа. У каждого свой срок, свои разделы и отзыв одним нажатием.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
          Выпустить ключ
        </button>
      </div>

      {issued && (
        <div className="mt-4 rounded-xl border border-brand/40 bg-brand/10 p-4">
          <div className="text-sm font-semibold text-brand">Ключ выпущен — сохраните его сейчас</div>
          <p className="mt-1 text-xs text-ink-300">
            Второй раз он не покажется: в сервисе хранится только его отпечаток, как у пароля.
            Передавайте отдельно от писем и документов.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="break-all rounded-lg bg-ink-950/60 px-3 py-2 font-mono text-xs text-ink-100">
              {issued}
            </code>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(issued);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Скопировано" : "Копировать"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setIssued(null)}>
              Я сохранил
            </button>
          </div>
        </div>
      )}

      {error && <FormError message={error} />}

      <div className="mt-4 space-y-2">
        {keys === null ? (
          <p className="text-sm text-ink-400">Загружаем…</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-ink-400">
            Ключей пока нет. Пока их нет, внешние системы данные не получают.
          </p>
        ) : (
          keys.map((k) => (
            <div
              key={k.id}
              className={`rounded-xl border px-4 py-3 ${
                k.state === "живой"
                  ? "border-ink-800 bg-ink-900/50"
                  : "border-ink-800/60 bg-ink-900/20 opacity-70"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="min-w-0">
                  <b className="text-ink-100">{k.name}</b>
                  <code className="ml-2 font-mono text-xs text-ink-500">colz_{k.prefix}…</code>
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${
                      k.state === "живой"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-ink-700 text-ink-500"
                    }`}
                  >
                    {k.state}
                  </span>
                  {k.state === "живой" && (
                    <button className="text-xs text-red-300 hover:underline" onClick={() => revoke(k)}>
                      Отозвать
                    </button>
                  )}
                </span>
              </div>
              <div className="mt-1 text-xs text-ink-400">
                Разделы: {k.scopes.map((s) => SCOPES.find((x) => x.id === s)?.label ?? s).join(", ")}
              </div>
              <div className="mt-1 text-xs text-ink-500">
                действует до {date(k.expiresAt)} · выпустил {k.authorName ?? "—"} {date(k.createdAt)} ·{" "}
                {k.lastUsedAt
                  ? `пользовались ${date(k.lastUsedAt)}, обращений ${k.useCount}`
                  : "ещё ни разу не пользовались"}
                {k.revokedAt && ` · отозван ${date(k.revokedAt)}`}
              </div>
              {k.note && <div className="mt-1 text-xs text-ink-500">{k.note}</div>}
            </div>
          ))
        )}
      </div>

      <p className="mt-4 border-t border-ink-800 pt-3 text-xs text-ink-500">
        <b>Замена без простоя:</b> выпустите новый ключ, переключите на него внешнюю систему,
        убедитесь, что данные идут, и только потом отзовите старый. Живых ключей может быть
        несколько одновременно. Каждое обращение по ключу видно в журнале действий.
      </p>

      <Modal open={open} onClose={() => setOpen(false)} title="Новый ключ" size="sm">
        <form onSubmit={issue} className="space-y-4">
          <div>
            <label className="label">Для кого *</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Коннектор Aspro"
              required
            />
            <p className="mt-1 text-xs text-ink-500">
              Название увидите только вы — по нему потом понятно, какой ключ отзывать.
            </p>
          </div>

          <div>
            <label className="label">Что открываем *</label>
            <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
              {SCOPES.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-ink-200">
                  <input
                    type="checkbox"
                    checked={!!picked[s.id]}
                    onChange={(e) => setPicked((p) => ({ ...p, [s.id]: e.target.checked }))}
                  />
                  {s.label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Отмечайте только нужное: ключ открывает ровно то, что отмечено, и ничего больше.
            </p>
          </div>

          <div>
            <label className="label">Срок действия</label>
            <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={90}>3 месяца</option>
              <option value={180}>полгода</option>
              <option value={365}>год</option>
              <option value={730}>два года</option>
            </select>
            <p className="mt-1 text-xs text-ink-500">
              Бессрочных ключей нет намеренно: забытый вечный ключ — это открытая дверь,
              про которую все забыли.
            </p>
          </div>

          <div>
            <label className="label">Заметка</label>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="кому передан, где лежит"
            />
          </div>

          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "…" : "Выпустить"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
