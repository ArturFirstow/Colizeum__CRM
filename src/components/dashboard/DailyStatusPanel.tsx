"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { apiFetch } from "@/lib/client";

type Adv = { id: string; nameRu: string };
type DealOpt = { id: string; title: string; advertiserId: string };
type DS = {
  id: string;
  text: string;
  date: string | Date;
  advertiser: { nameRu: string };
  deal: { title: string } | null;
};

export function DailyStatusPanel({
  advertisers,
  deals,
  today,
}: {
  advertisers: Adv[];
  deals: DealOpt[];
  today: DS[];
}) {
  const router = useRouter();
  const [advertiserId, setAdvertiserId] = useState("");
  const [dealId, setDealId] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{ markdown: string; filename: string } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const dealsForAdv = useMemo(
    () => deals.filter((d) => d.advertiserId === advertiserId),
    [deals, advertiserId],
  );

  async function addStatus(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/daily-statuses", {
        method: "POST",
        body: JSON.stringify({ advertiserId, dealId: dealId || undefined, text }),
      });
      setText("");
      setDealId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function generateReport() {
    setReportLoading(true);
    try {
      const data = await apiFetch<{ markdown: string; filename: string }>("/api/reports/weekly");
      setReport(data);
    } finally {
      setReportLoading(false);
    }
  }

  async function copyReport() {
    if (!report) return;
    await navigator.clipboard.writeText(report.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-50">Статус дня по проектам</h2>
          <p className="mt-0.5 text-xs text-ink-500">Короткая запись за день — из них собирается недельный отчёт</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={generateReport} disabled={reportLoading}>
          {reportLoading ? "…" : "📄 Недельный отчёт"}
        </button>
      </div>

      <form onSubmit={addStatus} className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <select
          className="input py-2"
          value={advertiserId}
          onChange={(e) => {
            setAdvertiserId(e.target.value);
            setDealId("");
          }}
          required
        >
          <option value="">Проект / рекламодатель…</option>
          {advertisers.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nameRu}
            </option>
          ))}
        </select>
        <select className="input py-2" value={dealId} onChange={(e) => setDealId(e.target.value)} disabled={!advertiserId}>
          <option value="">Сделка (необязательно)</option>
          {dealsForAdv.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        <div className="sm:col-span-3 flex gap-2">
          <input
            className="input py-2"
            placeholder="Что по проекту за сегодня…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
          <button className="btn btn-primary shrink-0" disabled={saving}>
            {saving ? "…" : "Записать"}
          </button>
        </div>
      </form>
      <FormError message={error} />

      {today.length === 0 ? (
        <p className="text-sm text-ink-400">Сегодня статусов ещё нет.</p>
      ) : (
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-ink-500">Сегодня</div>
          {today.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900/50 px-3.5 py-2.5">
              <div className="min-w-0">
                <span className="text-sm font-semibold text-ink-100">{s.advertiser.nameRu}</span>
                {s.deal && <span className="ml-2 text-xs text-ink-500">{s.deal.title}</span>}
                <p className="mt-0.5 text-sm text-ink-300">{s.text}</p>
              </div>
              <DeleteButton endpoint={`/api/daily-statuses/${s.id}`} what="статус" />
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!report}
        onClose={() => setReport(null)}
        title="Недельный отчёт по проектам"
        subtitle={report?.filename}
        size="lg"
      >
        {report && (
          <div className="space-y-3">
            <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-xl border border-ink-800 bg-ink-900/60 p-4 text-xs leading-relaxed text-ink-200">
              {report.markdown}
            </pre>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={copyReport}>
                {copied ? "Скопировано ✓" : "Копировать"}
              </button>
              <a className="btn btn-primary" href="/api/reports/weekly?download=1">
                Скачать .md
              </a>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
