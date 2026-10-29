"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Copy, Check, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";

// ─────────────────────────────────────────────────────────────────────────────
// Одна кнопка ИИ на экран.
//
// КАК БЫЛО. Шесть разных входов в одну и ту же способность, у каждого своё имя
// и своё место: «Саммари ИИ» в шапке клиента, «Пересказать историю» внутри
// хронологии, «Драфт ДС» под «Ещё» в сделке, «Собрать саммари» в передаче дел,
// «Недельное саммари» в дневнике, «Разобрать расшифровку» в окне записи. Для
// человека это ОДНА вещь — «попросить ИИ», — а выглядело как шесть разных
// функций, которые ещё надо запомнить, где лежат.
//
// КАК СТАЛО. Кнопка «✦ ИИ» с контекстным списком: в карточке клиента — два
// пункта, в сделке — свои. Что умеет ИИ на этом экране, видно одним нажатием.
// Кнопки внутри своих рабочих окон («Разобрать расшифровку», «Собрать
// саммари») остались на месте: они часть сценария, а не отдельная способность.
//
// ⚠️ Последним пунктом всегда стоит переход к ассистенту с готовым вопросом:
// если нужного действия в списке нет, спрашивают словами.
// ─────────────────────────────────────────────────────────────────────────────

type AiResult = { markdown: string; html: string };

/** Что умеет ИИ в этом месте сервиса. */
export type AiActionKey = "client-summary" | "client-timeline" | "draft-ds";

const ACTIONS: Record<AiActionKey, { label: string; hint: string }> = {
  "client-summary": {
    label: "Саммари за месяц",
    hint: "что происходило по клиенту и где мы сейчас",
  },
  "client-timeline": {
    label: "Пересказать историю",
    hint: "вся лента событий словами, от первого контакта",
  },
  "draft-ds": {
    label: "Черновик допсоглашения",
    hint: "по реквизитам сделки и правилам из базы знаний",
  },
};

export function AiMenu({
  actions,
  advertiserId,
  dealId,
  askContext,
  size = "sm",
}: {
  actions: AiActionKey[];
  advertiserId?: string;
  dealId?: string;
  /** Текст, который подставится в вопрос ассистенту («по клиенту МТС»). */
  askContext?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [dsForm, setDsForm] = useState(false);
  const [changes, setChanges] = useState("");
  const [resultOpen, setResultOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function run(endpoint: string, body: Record<string, unknown>, modalTitle: string) {
    setOpen(false);
    setTitle(modalTitle);
    setResultOpen(true);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await apiFetch<AiResult>(endpoint, { method: "POST", body: JSON.stringify(body) });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка ИИ");
    } finally {
      setLoading(false);
    }
  }

  function pick(key: AiActionKey) {
    if (key === "client-summary" && advertiserId) {
      run("/api/ai/client-summary", { advertiserId }, "Саммари клиента за месяц");
    } else if (key === "client-timeline" && advertiserId) {
      run("/api/ai/timeline-summary", { advertiserId }, "История отношений с клиентом");
    } else if (key === "draft-ds") {
      setOpen(false);
      setDsForm(true);
    }
  }

  async function submitDs(e: React.FormEvent) {
    e.preventDefault();
    setDsForm(false);
    await run("/api/ai/draft-ds", { dealId, changes }, "Черновик допсоглашения");
  }

  const askHref = `/assistant?q=${encodeURIComponent(askContext ? `Что важно знать ${askContext}?` : "Что сегодня в приоритете?")}`;

  return (
    <>
      <div ref={boxRef} className="relative">
        <button
          type="button"
          className={`btn btn-ghost ${size === "sm" ? "btn-sm" : ""}`}
          onClick={() => setOpen((v) => !v)}
          title="Что умеет ИИ на этом экране"
        >
          <Sparkles size={14} className="text-brand" /> ИИ
        </button>
        {open && (
          <div className="absolute right-0 z-40 mt-1 w-72 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-xl">
            {actions.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => pick(key)}
                className="block w-full px-3.5 py-2.5 text-left transition hover:bg-ink-800"
              >
                <div className="text-sm font-medium text-ink-100">{ACTIONS[key].label}</div>
                <div className="mt-0.5 text-xs text-ink-500">{ACTIONS[key].hint}</div>
              </button>
            ))}
            <Link
              href={askHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 border-t border-ink-800 px-3.5 py-2.5 text-sm text-ink-300 transition hover:bg-ink-800 hover:text-brand"
            >
              <MessageSquare size={14} /> Спросить своими словами
            </Link>
          </div>
        )}
      </div>

      <Modal
        open={dsForm}
        onClose={() => setDsForm(false)}
        title="Черновик допсоглашения"
        subtitle="Опишите, что меняем — сроки, даты, бюджет"
      >
        <form onSubmit={submitDs} className="space-y-4">
          <div>
            <label className="label">Что меняем? *</label>
            <textarea
              className="input min-h-[100px]"
              value={changes}
              onChange={(e) => setChanges(e.target.value)}
              required
              autoFocus
              placeholder="напр. перенести срок размещения с 1 августа на 15 августа; уменьшить бюджет с 9 955 200 до 8 500 000 ₽"
            />
          </div>
          <p className="text-xs text-ink-500">
            ИИ соберёт черновик по реквизитам сделки и правилам документооборота из базы знаний.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setDsForm(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary">
              <Sparkles size={14} /> Сформировать
            </button>
          </div>
        </form>
      </Modal>

      {resultOpen && (
        <AiResultModal
          title={title}
          loading={loading}
          error={error}
          result={result}
          onClose={() => setResultOpen(false)}
        />
      )}
    </>
  );
}

/** Общее окно результата: текст от ИИ + копирование. */
function AiResultModal({
  title,
  loading,
  error,
  result,
  onClose,
}: {
  title: string;
  loading: boolean;
  error: string | null;
  result: AiResult | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      subtitle="Черновик от ИИ — проверьте перед использованием"
      size="lg"
    >
      <div className="space-y-4">
        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-ink-400">
            <Sparkles size={16} className="animate-pulse text-brand" /> ИИ думает…
          </div>
        )}
        <FormError message={error} />
        {result && (
          <>
            <div
              className="prose-kb max-h-[55vh] overflow-y-auto rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3 text-sm"
              dangerouslySetInnerHTML={{ __html: result.html }}
            />
            <div className="flex justify-end">
              <button className="btn btn-ghost btn-sm" onClick={copy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
                {copied ? "Скопировано" : "Копировать текст"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
