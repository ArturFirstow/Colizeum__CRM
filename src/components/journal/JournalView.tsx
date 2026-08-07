"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { JOURNAL_SOURCES, JOURNAL_ROUTES } from "@/lib/enums";
import { FileCell } from "@/components/ui/FileCell";
import { formatDateTime } from "@/lib/format";

// Недельное ИИ-саммари: собирает прогресс по каждому партнёру за 7 дней.
function WeeklyAiSummary() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setHtml(null);
    try {
      const data = (await apiFetch("/api/reports/weekly-ai", { method: "POST" })) as { html: string };
      setHtml(data.html);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="btn btn-primary" onClick={generate}>
        <Sparkles size={15} /> Недельное ИИ-саммари
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Недельное саммари" subtitle="ИИ собрал прогресс по партнёрам за 7 дней" size="lg">
        {loading && (
          <div className="space-y-3">
            <div className="skeleton h-5 w-2/5" />
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton h-3.5 w-4/5" />
            <div className="skeleton h-5 w-1/3" />
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton h-3.5 w-3/5" />
            <p className="pt-1 text-xs text-ink-500">Собираю статусы, журнал и сделки, пишу саммари…</p>
          </div>
        )}
        {error && <FormError message={error} />}
        {html && <div className="prose-kb" dangerouslySetInnerHTML={{ __html: html }} />}
      </Modal>
    </>
  );
}

type Entry = {
  id: string;
  date: string | Date;
  source: string;
  rawText: string;
  parsedSummary: string | null;
  routedTo: string | null;
  meetingWith?: string | null;
  advertiserId?: string | null;
};

type AdvOpt = { id: string; nameRu: string };

export function JournalView({ entries, advertisers = [] }: { entries: Entry[]; advertisers?: AdvOpt[] }) {
  const router = useRouter();
  const [source, setSource] = useState<string>("Транскрипт");
  const [routedTo, setRoutedTo] = useState<string>("Трекер");
  const [rawText, setRawText] = useState("");
  const [meetingWith, setMeetingWith] = useState("");
  const [advertiserId, setAdvertiserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/journal", {
        method: "POST",
        body: JSON.stringify({
          source,
          routedTo,
          rawText,
          meetingWith: meetingWith.trim() || undefined,
          advertiserId: advertiserId || undefined,
        }),
      });
      setRawText("");
      setMeetingWith("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800/60 text-xl">
            ✎
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink-50">Дневник</h1>
            <p className="mt-0.5 text-sm text-ink-300">
              Транскрипты встреч и итоги дня. Всё, что прозвучало голосом, фиксируется здесь и не теряется.
            </p>
          </div>
        </div>
        <WeeklyAiSummary />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* Новая запись */}
        <form onSubmit={submit} className="card h-fit p-5">
          <h2 className="mb-1 text-lg font-bold text-ink-50">Новая запись</h2>
          <p className="mb-4 text-xs text-ink-500">
            Вставьте текст расшифровки встречи или прикрепите файл — запись останется в вашем кабинете.
          </p>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="label">Что за запись</label>
              <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
                {JOURNAL_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Маршрут</label>
              <select className="input" value={routedTo} onChange={(e) => setRoutedTo(e.target.value)}>
                {JOURNAL_ROUTES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {source === "Транскрипт" && (
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">С кем встреча</label>
                <input
                  className="input"
                  value={meetingWith}
                  onChange={(e) => setMeetingWith(e.target.value)}
                  placeholder="Например: Мария, МТС Оплата"
                />
              </div>
              <div>
                <label className="label">По какому клиенту</label>
                <select className="input" value={advertiserId} onChange={(e) => setAdvertiserId(e.target.value)}>
                  <option value="">— не важно —</option>
                  {advertisers.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nameRu}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <textarea
            className="input min-h-[180px]"
            placeholder={
              source === "Транскрипт"
                ? "Вставьте расшифровку встречи целиком — договорённости, сроки, кто что обещал…"
                : "Что важного за сегодня…"
            }
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            required
          />
          <div className="mt-3">
            <FormError message={error} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-ink-500">
              Напарник ИИ разберёт запись, когда будет подключён ключ
            </span>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "…" : "Добавить"}
            </button>
          </div>
        </form>

        {/* Лента */}
        <div className="space-y-3">
          {entries.length === 0 ? (
            <div className="card p-10 text-center text-ink-400">Записей пока нет</div>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="card p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-ink-500">
                  <span className="badge badge-muted">{e.source}</span>
                  {e.routedTo && <span className="badge badge-brand">→ {e.routedTo}</span>}
                  <span className="ml-auto">{formatDateTime(e.date)}</span>
                  <DeleteButton endpoint={`/api/journal/${e.id}`} what="запись журнала" />
                </div>
                {e.meetingWith && (
                  <div className="mb-1.5 text-xs text-ink-400">🎙 встреча с {e.meetingWith}</div>
                )}
                {e.parsedSummary && (
                  <p className="mb-2 rounded-lg bg-ink-900/60 px-3 py-2 text-sm text-brand-100">
                    {e.parsedSummary}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-sm text-ink-300">{e.rawText}</p>
                <div className="mt-3">
                  <FileCell
                    ownerType="journal"
                    ownerId={e.id}
                    kind="Запись встречи"
                    advertiserId={e.advertiserId ?? undefined}
                    label="Прикрепить запись или расшифровку"
                    compact
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
