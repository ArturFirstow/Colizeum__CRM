"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NewDealButton } from "@/components/deals/NewDealButton";
import { Modal } from "@/components/ui/Modal";
import { StageBadge, UrgencyBadge } from "@/components/ui/primitives";
import { apiFetch, ApiError } from "@/lib/client";
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
  blockerActive: boolean;
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
  const router = useRouter();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [q, setQ] = useState("");
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  // Переход с предупреждениями (409): подтверждение перед сменой стадии.
  const [pending, setPending] = useState<{ dealId: string; stage: string; warnings: string[] } | null>(null);
  const dragId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  async function moveTo(stage: string, dealId?: string, confirm = false) {
    const id = dealId ?? dragId.current;
    dragId.current = null;
    setDragOverStage(null);
    if (!id) return;
    const deal = deals.find((d) => d.id === id);
    if (!deal || (deal.stage === stage && !confirm)) return;
    try {
      await apiFetch(`/api/deals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ stage, confirm }),
      });
      setPending(null);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const detail = err.detail as { warnings?: string[] } | undefined;
        setPending({ dealId: id, stage, warnings: detail?.warnings ?? [err.message] });
      } else {
        alert(err instanceof Error ? err.message : "Ошибка");
      }
    }
  }

  function scrollBoard(dir: -1 | 1) {
    scrollRef.current?.scrollBy({ left: dir * 620, behavior: "smooth" });
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800/60 text-xl">
            ⑂
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink-50">Сделки</h1>
            <p className="mt-0.5 text-sm text-ink-300">
              Перетащите карточку на нужную стадию · стрелки листают доску
            </p>
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
        <div className="relative">
          {/* Явные стрелки прокрутки (ТЗ р.2, п.3) */}
          <button
            onClick={() => scrollBoard(-1)}
            aria-label="Прокрутить влево"
            className="absolute -left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ink-600 bg-ink-800 text-ink-100 shadow-card-dark transition hover:border-brand/50 hover:text-brand md:inline-flex"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => scrollBoard(1)}
            aria-label="Прокрутить вправо"
            className="absolute -right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ink-600 bg-ink-800 text-ink-100 shadow-card-dark transition hover:border-brand/50 hover:text-brand md:inline-flex"
          >
            <ChevronRight size={20} />
          </button>

          <div ref={scrollRef} className="kanban-scroll -mx-4 overflow-x-auto px-4 pb-4">
            <div className="flex gap-4" style={{ minWidth: "min-content" }}>
              {DEAL_STAGES.map((stage) => (
                <div
                  key={stage}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverStage !== stage) setDragOverStage(stage);
                  }}
                  onDragLeave={() => setDragOverStage((s) => (s === stage ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    moveTo(stage);
                  }}
                  className={`w-72 shrink-0 rounded-xl transition ${
                    dragOverStage === stage ? "bg-brand/[0.06] outline outline-2 outline-brand/40" : ""
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between px-1 pt-1">
                    <span className="text-sm font-semibold text-ink-200">{stage}</span>
                    <span className="rounded-md bg-ink-800 px-2 py-0.5 text-xs text-ink-400">
                      {byStage[stage].length}
                    </span>
                  </div>
                  <div className="min-h-[80px] space-y-2.5 px-1 pb-1">
                    {byStage[stage].map((d) => (
                      <KanbanCard
                        key={d.id}
                        deal={d}
                        onDragStart={() => {
                          dragId.current = d.id;
                        }}
                      />
                    ))}
                    {byStage[stage].length === 0 && (
                      <div className="rounded-xl border border-dashed border-ink-800 py-6 text-center text-xs text-ink-500">
                        перетащите сюда
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
                    {d.blockerActive && <span className="text-red-400" title="Блокер">⛔</span>}
                  </div>
                  <div className="mt-0.5 text-sm text-ink-400">{d.advertiser.nameRu}</div>
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

      {/* Подтверждение перехода с предупреждениями (инварианты стадий) */}
      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title="Проверьте инварианты"
        subtitle={pending ? `Переход на «${pending.stage}»` : undefined}
        size="md"
      >
        {pending && (
          <div className="space-y-4">
            <div className="space-y-2">
              {pending.warnings.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-100"
                >
                  <span>⚠️</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-ink-400">
              Это предупреждения, а не запрет. Подтвердите, если промежуточные шаги действительно пройдены.
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setPending(null)}>
                Отмена
              </button>
              <button className="btn btn-primary" onClick={() => moveTo(pending.stage, pending.dealId, true)}>
                Всё равно перевести
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function KanbanCard({ deal, onDragStart }: { deal: Deal; onDragStart: () => void }) {
  const dragging = useRef(false);
  return (
    <Link
      href={`/deals/${deal.id}`}
      draggable
      onDragStart={(e) => {
        dragging.current = true;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", deal.id);
        onDragStart();
      }}
      onDragEnd={() => {
        setTimeout(() => (dragging.current = false), 50);
      }}
      onClick={(e) => {
        // после перетаскивания клик не должен открывать сделку
        if (dragging.current) e.preventDefault();
      }}
      className={`block cursor-grab rounded-xl border bg-ink-850 p-3.5 shadow-card-dark transition hover:-translate-y-0.5 hover:border-ink-500 active:cursor-grabbing ${
        deal.decisionPending ? "border-brand/40" : "border-ink-700/70"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-ink-50">{deal.title}</span>
        <UrgencyBadge urgency={deal.urgency} />
      </div>
      <div className="mt-1 text-sm text-ink-400">{deal.advertiser.nameRu}</div>

      <div className={`mt-2.5 inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${stageStyle(deal.stage)}`}>
        {deal.stage}
      </div>

      {deal.decisionPending && (
        <div className="mt-2.5 rounded-lg bg-brand/10 px-2.5 py-1.5 text-xs text-brand-100">
          ◆ {deal.decisionPending}
        </div>
      )}
      {deal.blockerActive && (
        <div className="mt-2 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs text-red-200">
          ⛔ {deal.blocker}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-ink-800 pt-2.5 text-xs text-ink-400">
        <span className="text-sm">{deal.amount != null ? formatMoney(deal.amount) : "—"}</span>
        {deal.nextStep && <span className="truncate pl-2 text-ink-500">→ {deal.nextStep}</span>}
      </div>
    </Link>
  );
}
