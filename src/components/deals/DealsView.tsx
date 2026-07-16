"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { NewDealButton } from "@/components/deals/NewDealButton";
import { StageBadge, UrgencyBadge } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/format";
import { DEAL_STAGES } from "@/lib/enums";
import { stageStyle } from "@/lib/ui-tokens";

type Deal = {
  id: string;
  title: string;
  stage: string;
  urgency: string | null;
  amount: number | null;
  vatIncluded: boolean;
  blocker: string | null;
  decisionPending: string | null;
  nextStep: string | null;
  advertiser: { id: string; nameRu: string };
};

export function DealsView({
  deals,
  advertisers,
}: {
  deals: Deal[];
  advertisers: { id: string; nameRu: string }[];
}) {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return deals;
    return deals.filter((d) =>
      [d.title, d.advertiser.nameRu].some((v) => v.toLowerCase().includes(query)),
    );
  }, [deals, q]);

  const byStage = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const s of DEAL_STAGES) map[s] = [];
    for (const d of filtered) {
      (map[d.stage] ??= []).push(d);
    }
    return map;
  }, [filtered]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800/60 text-xl">
            ⑂
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink-50">Сделки</h1>
            <p className="mt-0.5 text-sm text-ink-300">Трекер по 11 стадиям · канбан по 9 группам</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-ink-700 bg-ink-800/50 p-0.5">
            <button
              onClick={() => setView("kanban")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${view === "kanban" ? "bg-brand text-ink-950" : "text-ink-300"}`}
            >
              Канбан
            </button>
            <button
              onClick={() => setView("list")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${view === "list" ? "bg-brand text-ink-950" : "text-ink-300"}`}
            >
              Список
            </button>
          </div>
          <NewDealButton advertisers={advertisers} />
        </div>
      </div>

      <input
        className="input mb-5 sm:max-w-xs"
        placeholder="Поиск по сделкам…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {view === "kanban" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-4">
          <div className="flex gap-4" style={{ minWidth: "min-content" }}>
            {DEAL_STAGES.map((stage) => (
              <div key={stage} className="w-72 shrink-0">
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-ink-200">{stage}</span>
                  <span className="rounded-md bg-ink-800 px-2 py-0.5 text-xs text-ink-400">
                    {byStage[stage].length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {byStage[stage].map((d) => (
                    <KanbanCard key={d.id} deal={d} />
                  ))}
                  {byStage[stage].length === 0 && (
                    <div className="rounded-xl border border-dashed border-ink-800 py-6 text-center text-xs text-ink-600">
                      пусто
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-ink-800">
            {filtered.map((d) => (
              <Link
                key={d.id}
                href={`/deals/${d.id}`}
                className="flex flex-col gap-2 px-4 py-3.5 transition hover:bg-ink-800/60 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink-100">{d.title}</span>
                    {d.blocker && <span className="text-red-400" title="Блокер">⛔</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-400">{d.advertiser.nameRu}</div>
                </div>
                <div className="flex items-center gap-3">
                  {d.amount != null && (
                    <span className="text-sm text-ink-300">{formatMoney(d.amount)}</span>
                  )}
                  <UrgencyBadge urgency={d.urgency} />
                  <StageBadge stage={d.stage} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanCard({ deal }: { deal: Deal }) {
  return (
    <Link
      href={`/deals/${deal.id}`}
      className={`block rounded-xl border bg-ink-850 p-3.5 shadow-card-dark transition hover:-translate-y-0.5 hover:border-ink-500 ${
        deal.decisionPending ? "border-brand/40" : "border-ink-700/70"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-ink-100">{deal.title}</span>
        <UrgencyBadge urgency={deal.urgency} />
      </div>
      <div className="mt-1 text-xs text-ink-400">{deal.advertiser.nameRu}</div>

      <div className={`mt-2.5 inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${stageStyle(deal.stage)}`}>
        {deal.stage}
      </div>

      {deal.decisionPending && (
        <div className="mt-2.5 rounded-lg bg-brand/10 px-2.5 py-1.5 text-xs text-brand-100">
          ◆ {deal.decisionPending}
        </div>
      )}
      {deal.blocker && (
        <div className="mt-2 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs text-red-200">
          ⛔ {deal.blocker}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-ink-800 pt-2.5 text-xs text-ink-400">
        <span>{deal.amount != null ? formatMoney(deal.amount) : "—"}</span>
        {deal.nextStep && <span className="truncate pl-2 text-ink-500">→ {deal.nextStep}</span>}
      </div>
    </Link>
  );
}
