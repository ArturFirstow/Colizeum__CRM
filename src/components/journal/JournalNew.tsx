"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Mic, NotebookPen } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Modal, FormError } from "@/components/ui/Modal";

// ─────────────────────────────────────────────────────────────────────────────
// Новая запись дневника — окно вместо формы, открытой всегда.
//
// КАК БЫЛО. Половину экрана занимала анкета: «Что за запись», «Маршрут»,
// «С кем встреча», «По какому клиенту», «Показатели встречи для таблицы».
// Человек, впервые открывший раздел, видел девять полей и два технических
// слова («Транскрипт», «Трекер») — и не понимал, с чего начать. При этом
// большинство заходов в раздел — ПОЧИТАТЬ, а не записать.
//
// КАК СТАЛО. Сначала вопрос «что записываем» двумя крупными вариантами, и
// только потом — поля под выбранный случай:
//   • Встреча — вставил расшифровку, нажал «Разобрать», проверил, сохранил;
//   • Итог дня — одно поле текста.
// «Маршрут» из формы убран совсем: он всегда «Трекер», выбирать было нечего.
// ─────────────────────────────────────────────────────────────────────────────

type AdvOpt = { id: string; nameRu: string };
type Kind = "meeting" | "note";

/** Продолжительность с шагом 0,5 часа — как требует таблица учёта. */
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

export function JournalNew({
  advertisers = [],
  sheetConfigured = false,
}: {
  advertisers?: AdvOpt[];
  sheetConfigured?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind | null>(null);

  const [rawText, setRawText] = useState("");
  const [meetingWith, setMeetingWith] = useState("");
  const [advertiserId, setAdvertiserId] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [participants, setParticipants] = useState("");
  const [protocolUrl, setProtocolUrl] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [summary, setSummary] = useState("");

  const [parsed, setParsed] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const duration = durationFromTimes(startTime, endTime);

  function reset() {
    setKind(null);
    setRawText("");
    setMeetingWith("");
    setAdvertiserId("");
    setMeetingDate("");
    setStartTime("");
    setEndTime("");
    setParticipants("");
    setProtocolUrl("");
    setMeetingUrl("");
    setSummary("");
    setParsed(false);
    setError(null);
    setNotice(null);
  }

  function close() {
    setOpen(false);
    // Сбрасываем не сразу: окно закрывается с анимацией, и поля на глазах
    // опустели бы.
    setTimeout(reset, 200);
  }

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
      setParsed(true);
      setNotice("Готово — проверьте, что ИИ понял правильно, и сохраняйте");
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
          // «Маршрут» всегда один и тот же — в форме его больше не спрашиваем.
          source: kind === "meeting" ? "Транскрипт" : "EOD",
          routedTo: "Трекер",
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
      router.refresh();
      close();
      // Сообщение о выгрузке в таблицу показываем уже после закрытия окна —
      // в ленте у самой записи видно её состояние.
      if (res.exported && !res.exported.ok) {
        window.setTimeout(
          () => alert(`Запись сохранена, но строка в таблицу не ушла: ${res.exported?.error ?? "ошибка"}`),
          300,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + Новая запись
      </button>

      <Modal
        open={open}
        onClose={close}
        title={kind === "meeting" ? "Запись встречи" : kind === "note" ? "Итог дня" : "Новая запись"}
        subtitle={
          kind === "meeting"
            ? "Вставьте расшифровку — остальное заполнит ИИ"
            : kind === "note"
              ? "Пара строк о том, что сегодня было важного"
              : "Что записываем?"
        }
        size="lg"
      >
        {/* Шаг 1. Выбор сценария. Два варианта вместо списка «Что за запись». */}
        {!kind && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setKind("meeting")}
              className="card card-hover p-5 text-left"
            >
              <Mic size={20} className="text-brand" />
              <div className="mt-3 text-base font-semibold text-ink-50">Встреча</div>
              <p className="mt-1 text-sm text-ink-400">
                Есть расшифровка разговора. ИИ достанет дату, время, участников и договорённости,
                а строка уйдёт в таблицу отчётности.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setKind("note")}
              className="card card-hover p-5 text-left"
            >
              <NotebookPen size={20} className="text-ink-300" />
              <div className="mt-3 text-base font-semibold text-ink-50">Итог дня</div>
              <p className="mt-1 text-sm text-ink-400">
                Короткая заметка без встречи. Попадёт в недельный отчёт и в историю клиента.
              </p>
            </button>
          </div>
        )}

        {/* Шаг 2. Поля под выбранный случай. */}
        {kind && (
          <form onSubmit={submit}>
            <button
              type="button"
              className="mb-3 text-xs text-ink-500 transition hover:text-brand"
              onClick={() => setKind(null)}
            >
              ← другой тип записи
            </button>

            <textarea
              className="input min-h-[160px]"
              autoFocus
              placeholder={
                kind === "meeting"
                  ? "Вставьте расшифровку встречи целиком — договорённости, сроки, кто что обещал…"
                  : "Что сегодня было важного…"
              }
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              required
            />

            {kind === "meeting" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={parseTranscript}
                  disabled={parsing || rawText.trim().length < 20}
                  title="ИИ достанет дату, время, участников и ссылки из расшифровки"
                >
                  <Wand2 size={14} /> {parsing ? "Разбираю…" : "Разобрать расшифровку"}
                </button>
                {!parsed && (
                  <button
                    type="button"
                    className="text-xs text-ink-500 transition hover:text-brand"
                    onClick={() => setParsed(true)}
                  >
                    или заполнить руками
                  </button>
                )}
              </div>
            )}

            {/* Поля показываем ПОСЛЕ разбора: до него заполнять нечего, а
                пустая анкета пугает больше, чем помогает. */}
            {kind === "meeting" && parsed && (
              <div className="mt-4 rounded-xl border border-ink-800 bg-ink-900/40 p-4">
                <div className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-500">
                  Проверьте перед сохранением
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
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
                    <label className="label">Клиент</label>
                    <select
                      className="input"
                      value={advertiserId}
                      onChange={(e) => setAdvertiserId(e.target.value)}
                    >
                      <option value="">— не важно —</option>
                      {advertisers.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nameRu}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="label">Дата</label>
                    <input className="input" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Начало</label>
                    <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">
                      Окончание{duration != null ? ` · ${duration.toFixed(1).replace(".", ",")} ч` : ""}
                    </label>
                    <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="label">Участники</label>
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

            {kind === "note" && (
              <div className="mt-3">
                <label className="label">Клиент (необязательно)</label>
                <select className="input" value={advertiserId} onChange={(e) => setAdvertiserId(e.target.value)}>
                  <option value="">— не важно —</option>
                  {advertisers.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nameRu}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-3">
              <FormError message={error} />
            </div>
            {notice && (
              <p className="mt-2 rounded-lg bg-ink-900/60 px-3 py-2 text-xs text-brand-100">{notice}</p>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={close}>
                Отмена
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Сохраняю…" : "Сохранить"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
