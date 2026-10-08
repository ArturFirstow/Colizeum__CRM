"use client";

import { useState } from "react";
import { Search, Download, Trash2, Check } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";

// ─────────────────────────────────────────────────────────────────────────────
// Ответ на запрос человека о его данных (требования 4.7 и 5.8).
//
// Сценарий: пришло обращение «какие у вас есть мои данные» или «удалите мои
// данные». Администратор вводит имя, почту или телефон, видит всё найденное
// по всем разделам, выгружает справку и при необходимости удаляет.
//
// Срок ответа по закону — 10 рабочих дней, поэтому важно, чтобы это делалось
// за минуту, а не обходом разделов руками.
// ─────────────────────────────────────────────────────────────────────────────

type Found = {
  id: string;
  where: string;
  title: string;
  fields: string[];
  erase: "delete" | "anonymize" | "keep";
  keepReason?: string;
};
type Result = {
  query: string;
  groups: { kind: string; label: string; records: Found[] }[];
  total: number;
};

export function PrivacyView() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 3) {
      setError("Введите хотя бы три символа — иначе найдётся пол-базы");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      setRes(await apiFetch<Result>(`/api/privacy?q=${encodeURIComponent(q.trim())}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  // Справка для человека: что о нём есть. Отдаём текстом — его можно
  // вложить в ответ на обращение как есть.
  function downloadReport() {
    if (!res) return;
    const lines = [
      `Справка о наличии персональных данных`,
      `Запрос: ${res.query}`,
      `Дата: ${new Date().toLocaleString("ru-RU")}`,
      `Сервис: внутренняя CRM отдела рекламы Colizeum Agency`,
      ``,
      res.total === 0
        ? "По указанным данным записей не найдено."
        : `Найдено записей: ${res.total}`,
      ``,
    ];
    for (const g of res.groups) {
      lines.push(`${g.label}:`);
      for (const r of g.records) {
        lines.push(`  — ${r.title}`);
        lines.push(`    где: ${r.where}`);
        if (r.fields.length) lines.push(`    какие данные: ${r.fields.join(", ")}`);
        if (r.erase === "keep" && r.keepReason) lines.push(`    примечание: ${r.keepReason}`);
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Справка о данных — ${res.query} — ${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const erasable = res?.groups.flatMap((g) => g.records.filter((r) => r.erase !== "keep").map((r) => ({ kind: g.kind, id: r.id }))) ?? [];

  return (
    <div>
      <section className="card mb-5 p-5">
        <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
          <input
            className="input flex-1"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Имя, фамилия, почта или телефон человека"
          />
          <button className="btn btn-primary" disabled={busy}>
            <Search size={15} /> {busy ? "Ищем…" : "Найти данные"}
          </button>
        </form>
        <FormError message={error} />
        <p className="mt-3 text-xs text-ink-500">
          Поиск идёт по всем разделам сразу: контакты клиентов, справочник ролей, обращения с сайта,
          сотрудники и участники встреч. Регистр и «ё» значения не имеют.
        </p>
      </section>

      {done && (
        <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-200">
          <Check size={16} className="mr-1 inline" /> {done}
        </div>
      )}

      {res && (
        <section className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink-50">
                {res.total === 0 ? "Ничего не найдено" : `Найдено записей: ${res.total}`}
              </h2>
              <p className="mt-0.5 text-sm text-ink-400">по запросу «{res.query}»</p>
            </div>
            {res.total > 0 && (
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm" onClick={downloadReport}>
                  <Download size={14} /> Скачать справку
                </button>
                {erasable.length > 0 && (
                  <button className="btn btn-ghost btn-sm text-red-300" onClick={() => setEraseOpen(true)}>
                    <Trash2 size={14} /> Удалить по запросу ({erasable.length})
                  </button>
                )}
              </div>
            )}
          </div>

          {res.total === 0 ? (
            <p className="text-sm text-ink-400">
              Данных об этом человеке в сервисе нет. Справку всё равно можно скачать — она подтверждает,
              что проверка проводилась.
            </p>
          ) : (
            <div className="space-y-5">
              {res.groups.map((g) => (
                <div key={g.kind}>
                  <div className="mb-2 flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{g.label}</span>
                    <span className="h-px flex-1 bg-ink-800" />
                    <span className="text-xs text-ink-500">{g.records.length}</span>
                  </div>
                  <div className="space-y-2">
                    {g.records.map((r) => (
                      <div key={r.id} className="rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink-100">{r.title}</span>
                          {r.erase === "delete" && <span className="badge badge-muted">будет удалено</span>}
                          {r.erase === "anonymize" && <span className="badge badge-muted">будет обезличено</span>}
                          {r.erase === "keep" && <span className="badge badge-brand">остаётся</span>}
                        </div>
                        <div className="mt-1 text-xs text-ink-400">{r.where}</div>
                        {r.fields.length > 0 && (
                          <div className="mt-1 text-xs text-ink-500">данные: {r.fields.join(", ")}</div>
                        )}
                        {r.keepReason && (
                          <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                            {r.keepReason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {eraseOpen && res && (
        <EraseModal
          count={erasable.length}
          items={erasable}
          onClose={() => setEraseOpen(false)}
          onDone={(msg) => {
            setDone(msg);
            setRes(null);
            setEraseOpen(false);
          }}
        />
      )}
    </div>
  );
}

function EraseModal({
  count,
  items,
  onClose,
  onDone,
}: {
  count: number;
  items: { kind: string; id: string }[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ deleted: number; anonymized: number }>("/api/privacy", {
        method: "POST",
        body: JSON.stringify({ items, reason }),
      });
      onDone(`Готово: удалено записей — ${r.deleted}, обезличено — ${r.anonymized}. Действие записано в журнал.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Удалить данные по запросу" subtitle="Действие необратимо">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Будет затронуто записей: <b>{count}</b>. Контакты и люди из справочника удаляются полностью,
          обращения с сайта и упоминания во встречах обезличиваются — сам факт обращения остаётся.
          Сотрудники и журнал действий не трогаются.
        </div>
        <div>
          <label className="label">По чьему обращению удаляем *</label>
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            autoFocus
            placeholder="напр. обращение Иванова И.И. от 08.10.2026, вх. № 14"
          />
          <p className="mt-1 text-xs text-ink-500">
            Попадёт в журнал действий — это доказательство, что удаление было законным.
          </p>
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "…" : "Удалить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
