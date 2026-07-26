"use client";

import { useState } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";

type AiResult = { markdown: string; html: string };

// Общая модалка результата ИИ: рендер markdown-HTML + копирование.
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
    <Modal open onClose={onClose} title={title} subtitle="Черновик от ИИ — проверьте перед использованием" size="lg">
      <div className="space-y-4">
        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-ink-400">
            <Sparkles size={16} className="animate-pulse text-brand" /> ИИ думает…
          </div>
        )}
        <FormError message={error} />
        {result && (
          <>
            <div className="prose-kb max-h-[55vh] overflow-y-auto rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3 text-sm" dangerouslySetInnerHTML={{ __html: result.html }} />
            <div className="flex justify-end">
              <button className="btn btn-ghost btn-sm" onClick={copy}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Скопировано" : "Копировать текст"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// Кнопка «Саммари клиента за месяц».
export function AiSummaryButton({ advertiserId }: { advertiserId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);

  async function run() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await apiFetch<AiResult>("/api/ai/client-summary", { method: "POST", body: JSON.stringify({ advertiserId }) });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка ИИ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={run} title="ИИ-саммари клиента за месяц">
        <Sparkles size={14} className="text-brand" /> Саммари ИИ
      </button>
      {open && <AiResultModal title="Саммари клиента за месяц" loading={loading} error={error} result={result} onClose={() => setOpen(false)} />}
    </>
  );
}

// Кнопка «Драфт ДС по шаблону»: сначала спрашиваем, что меняем.
export function AiDraftDsButton({ dealId }: { dealId: string }) {
  const [formOpen, setFormOpen] = useState(false);
  const [changes, setChanges] = useState("");
  const [resOpen, setResOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setFormOpen(false);
    setResOpen(true);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await apiFetch<AiResult>("/api/ai/draft-ds", { method: "POST", body: JSON.stringify({ dealId, changes }) });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка ИИ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setFormOpen(true)} title="ИИ-черновик допсоглашения по шаблону">
        <Sparkles size={14} className="text-brand" /> Драфт ДС
      </button>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Драфт допсоглашения (ИИ)" subtitle="Опишите, что меняем — сроки, даты, бюджет">
        <form onSubmit={run} className="space-y-4">
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
          <p className="text-xs text-ink-500">ИИ соберёт черновик по реквизитам сделки и правилам документооборота из базы знаний.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setFormOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary">
              <Sparkles size={14} /> Сформировать
            </button>
          </div>
        </form>
      </Modal>

      {resOpen && <AiResultModal title="Черновик ДС" loading={loading} error={error} result={result} onClose={() => setResOpen(false)} />}
    </>
  );
}
