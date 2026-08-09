"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Wand2, CheckCircle2, AlertTriangle, Copy, Send } from "lucide-react";
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
  meetingDate?: string | Date | null;
  startTime?: string | null;
  endTime?: string | null;
  durationHours?: number | null;
  participants?: string | null;
  protocolUrl?: string | null;
  meetingUrl?: string | null;
  exportedAt?: string | Date | null;
  exportError?: string | null;
};

// Продолжительность с шагом 0,5 часа — как требует таблица учёта.
function durationFromTimes(start: string, end: string): number | null {
  if (!start || !end) return null;
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let minutes = toMin(end) - toMin(start);
  if (Number.isNaN(minutes)) return null;
  if (minutes < 0) minutes += 24 * 60;
  if (minutes <= 0) return null;
  return Math.max(0.5, Math.round(minutes / 30) / 2);
}

type AdvOpt = { id: string; nameRu: string };

export function JournalView({
  entries,
  advertisers = [],
  sheetConfigured = false,
}: {
  entries: Entry[];
  advertisers?: AdvOpt[];
  sheetConfigured?: boolean;
}) {
  const router = useRouter();
  const [source, setSource] = useState<string>("Транскрипт");
  const [routedTo, setRoutedTo] = useState<string>("Трекер");
  const [rawText, setRawText] = useState("");
  const [meetingWith, setMeetingWith] = useState("");
  const [advertiserId, setAdvertiserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Показатели встречи — то, что уходит строкой в таблицу учёта.
  const [meetingDate, setMeetingDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [participants, setParticipants] = useState("");
  const [protocolUrl, setProtocolUrl] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [parsing, setParsing] = useState(false);
  // Блок показателей свёрнут: новичок видит два поля и кнопку, а не анкету.
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const duration = durationFromTimes(startTime, endTime);
  // Сколько показателей уже заполнено — короткая сводка на свёрнутом блоке.
  const filledCount = [meetingDate, startTime, endTime, participants, protocolUrl, summary].filter(
    (v) => v.trim() !== "",
  ).length;

  // Кнопка «Разобрать транскрипт»: ИИ достаёт дату, время, участников и ссылки.
  async function parseTranscript() {
    setError(null);
    setNotice(null);
    setParsing(true);
    try {
      const d = (await apiFetch("/api/journal/parse-meeting", {
        method: "POST",
        body: JSON.stringify({ transcript: rawText }),
      })) as Record<string, string | null>;
      if (d.meetingDate) setMeetingDate(d.meetingDate);
      if (d.startTime) setStartTime(d.startTime);
      if (d.endTime) setEndTime(d.endTime);
      if (d.participants) setParticipants(d.participants);
      if (d.meetingWith && !meetingWith) setMeetingWith(d.meetingWith);
      if (d.protocolUrl) setProtocolUrl(d.protocolUrl);
      if (d.meetingUrl) setMeetingUrl(d.meetingUrl);
      if (d.summary) setSummary(d.summary);
      setDetailsOpen(true);
      setNotice("Поля заполнены — проверьте и сохраните");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setParsing(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = (await apiFetch("/api/journal", {
        method: "POST",
        body: JSON.stringify({
          source,
          routedTo,
          rawText,
          meetingWith: meetingWith.trim() || undefined,
          advertiserId: advertiserId || undefined,
          parsedSummary: summary.trim() || undefined,
          meetingDate: meetingDate || undefined,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          durationHours: duration ?? undefined,
          participants: participants.trim() || undefined,
          protocolUrl: protocolUrl.trim() || undefined,
          meetingUrl: meetingUrl.trim() || undefined,
        }),
      })) as { exported?: { ok: boolean; error?: string } | null };
      setNotice(
        res.exported?.ok
          ? "Запись сохранена и строка ушла в таблицу отчётности"
          : res.exported
            ? `Запись сохранена, но в таблицу не ушла: ${res.exported.error ?? "ошибка"}`
            : null,
      );
      setRawText("");
      setMeetingWith("");
      setMeetingDate("");
      setStartTime("");
      setEndTime("");
      setParticipants("");
      setProtocolUrl("");
      setMeetingUrl("");
      setSummary("");
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
            <>
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

              {/* Показатели для таблицы учёта. Свёрнуты по умолчанию: заполняет их
                  кнопка «Разобрать транскрипт», руками лезут только на проверку. */}
              <div className="mb-3 rounded-xl border border-ink-800 bg-ink-900/40">
                <button
                  type="button"
                  onClick={() => setDetailsOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-medium uppercase tracking-wide text-ink-500">
                      Показатели встречи для таблицы
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-400">
                      {filledCount === 0
                        ? "Заполнит кнопка «Разобрать транскрипт» — трогать не обязательно"
                        : `заполнено ${filledCount} из 6${duration != null ? ` · ${duration.toFixed(1).replace(".", ",")} ч` : ""}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-500">{detailsOpen ? "свернуть ▲" : "проверить ▼"}</span>
                </button>
                {detailsOpen && (
                <div className="border-t border-ink-800 p-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="label">Дата встречи</label>
                    <input className="input" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Начало</label>
                    <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Окончание</label>
                    <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="label">Участники встречи</label>
                  <input
                    className="input"
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    placeholder="через запятую"
                  />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Ссылка на протокол</label>
                    <input className="input" value={protocolUrl} onChange={(e) => setProtocolUrl(e.target.value)} placeholder="https://…" />
                  </div>
                  <div>
                    <label className="label">Ссылка на встречу</label>
                    <input className="input" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://…" />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="label">Итоги встречи</label>
                  <textarea
                    className="input min-h-[56px]"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Договорённости в 1–3 предложениях"
                  />
                </div>
                <p className="mt-2 text-xs text-ink-500">
                  {sheetConfigured
                    ? "При сохранении строка уйдёт в таблицу отчётности автоматически."
                    : "Выгрузка в таблицу пока не настроена — строку можно будет скопировать из ленты."}
                </p>
                </div>
                )}
              </div>
            </>
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
          {source === "Транскрипт" && (
            <p className="mt-2 text-xs text-ink-500">
              Достаточно вставить расшифровку и нажать «Разобрать транскрипт» — дату, время,
              участников и ссылки ИИ вытащит сам.
            </p>
          )}
          <div className="mt-3">
            <FormError message={error} />
          </div>
          {notice && (
            <p className="mt-2 rounded-lg bg-ink-900/60 px-3 py-2 text-xs text-brand-100">{notice}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {source === "Транскрипт" ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={parseTranscript}
                disabled={parsing || rawText.trim().length < 20}
                title="ИИ достанет дату, время, участников и ссылки из расшифровки"
              >
                <Wand2 size={14} /> {parsing ? "Разбираю…" : "Разобрать транскрипт"}
              </button>
            ) : (
              <span className="text-xs text-ink-500">Итоги дня попадут в недельный отчёт</span>
            )}
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
                {e.meetingDate && <MeetingRow entry={e} />}
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

// Показатели встречи в ленте + состояние выгрузки в таблицу отчётности.
function MeetingRow({ entry }: { entry: Entry }) {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(
    entry.exportedAt
      ? { ok: true, text: "строка в таблице" }
      : entry.exportError
        ? { ok: false, text: entry.exportError }
        : null,
  );
  const [copied, setCopied] = useState(false);

  const date = entry.meetingDate ? new Date(entry.meetingDate) : null;
  const dateText = date
    ? `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`
    : "";
  const hours = entry.durationHours ?? null;

  async function send() {
    setBusy(true);
    setCopied(false);
    try {
      const r = (await apiFetch(`/api/journal/${entry.id}/export`, { method: "POST" })) as {
        ok: boolean;
        configured: boolean;
        error?: string;
        tsv?: string;
      };
      if (r.ok) {
        setState({ ok: true, text: "строка в таблице" });
      } else if (!r.configured) {
        if (r.tsv) await navigator.clipboard.writeText(r.tsv);
        setCopied(true);
        setState({ ok: false, text: "выгрузка не настроена — строка скопирована в буфер" });
      } else {
        setState({ ok: false, text: r.error ?? "не удалось отправить" });
      }
    } catch (err) {
      setState({ ok: false, text: err instanceof Error ? err.message : "ошибка" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-2 rounded-lg border border-ink-800 bg-ink-900/40 px-3 py-2 text-xs text-ink-300">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium text-ink-100">{dateText}</span>
        {entry.startTime && (
          <span>
            {entry.startTime}
            {entry.endTime ? `–${entry.endTime}` : ""}
          </span>
        )}
        {hours != null && <span className="badge badge-muted">{hours.toFixed(1).replace(".", ",")} ч</span>}
        {entry.participants && <span className="text-ink-400">{entry.participants}</span>}
        {entry.protocolUrl && (
          <a href={entry.protocolUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
            протокол ↗
          </a>
        )}
        {entry.meetingUrl && (
          <a href={entry.meetingUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
            встреча ↗
          </a>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {state?.ok ? (
          <span className="flex items-center gap-1 text-emerald-300">
            <CheckCircle2 size={12} /> {state.text}
          </span>
        ) : state ? (
          <span className="flex items-center gap-1 text-amber-300">
            {copied ? <Copy size={12} /> : <AlertTriangle size={12} />} {state.text}
          </span>
        ) : (
          <span className="text-ink-500">в таблицу не отправлялась</span>
        )}
        <button className="btn btn-ghost btn-sm" onClick={send} disabled={busy}>
          <Send size={12} /> {busy ? "…" : state?.ok ? "Отправить ещё раз" : "Отправить в таблицу"}
        </button>
      </div>
    </div>
  );
}
