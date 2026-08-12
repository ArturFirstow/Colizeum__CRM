"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/format";
import { NetHint } from "@/components/ui/Money";

export type FunnelDeal = {
  id: string;
  title: string;
  stage: string;
  amount: number | null;
  periodText: string | null;
  updatedAt: string;
  advertiserName: string;
  managerName: string | null;
  blocker: string | null;
  blockerActive: boolean;
};

// Руководителю важны шесть крупных шагов, а не все девять стадий.
// Детальная стадия видна внутри группы, когда её раскрыли.
const GROUPS: { label: string; stages: string[] }[] = [
  { label: "Лид", stages: ["Лид"] },
  { label: "КП", stages: ["КП / условия"] },
  { label: "Договор", stages: ["Договор"] },
  { label: "Подписание", stages: ["Приложение / спец.", "Предоплата"] },
  { label: "Размещение", stages: ["Материалы + ОРД", "Размещение"] },
  { label: "Закрытие", stages: ["УПД + отчёт", "Закрытие"] },
];

export function DeptFunnel({ deals }: { deals: FunnelDeal[] }) {
  const [open, setOpen] = useState<string | null>(null);

  const rows = GROUPS.map((g) => {
    const items = deals.filter((d) => g.stages.includes(d.stage));
    return { ...g, items, sum: items.reduce((s, d) => s + (d.amount ?? 0), 0) };
  });
  const max = Math.max(1, ...rows.map((r) => r.items.length));

  return (
    <div className="card divide-y divide-ink-800 p-0">
      {rows.map((r) => {
        const expanded = open === r.label;
        return (
          <div key={r.label}>
            <button
              onClick={() => setOpen(expanded ? null : r.label)}
              className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-ink-800/40"
              title="Показать контрагентов на этой стадии"
            >
              <ChevronDown
                size={15}
                className={`shrink-0 text-ink-500 transition-transform duration-200 ${expanded ? "rotate-180 text-brand" : ""}`}
              />
              <div className="w-28 shrink-0 text-sm font-medium text-ink-100">{r.label}</div>
              <div className="h-5 flex-1 overflow-hidden rounded bg-ink-800">
                <div
                  className="h-full rounded bg-brand/70 transition-[width] duration-700"
                  style={{ width: `${(r.items.length / max) * 100}%` }}
                />
              </div>
              <div className="w-10 shrink-0 text-right text-sm tabular-nums text-ink-200">{r.items.length}</div>
              <div className="w-32 shrink-0 text-right text-xs tabular-nums text-ink-400">
                {formatMoney(r.sum)}
                <NetHint amount={r.sum} />
              </div>
            </button>

            {expanded && (
              <div className="animate-lift space-y-1.5 bg-ink-900/40 px-5 py-3">
                {r.items.length === 0 ? (
                  <div className="text-xs text-ink-500">На этой стадии никого нет.</div>
                ) : (
                  r.items.map((d) => (
                    <Link
                      key={d.id}
                      href={`/deals/${d.id}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-ink-900/60 px-3 py-2 text-sm ring-1 ring-inset ring-ink-800 transition hover:ring-brand/30"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink-50">{d.advertiserName}</span>
                        <span className="block truncate text-xs text-ink-500">
                          {d.title} · {d.stage}
                          {d.blockerActive ? ` · ⛔ ${d.blocker ?? ""}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-ink-300">{d.managerName ?? "без менеджера"}</span>
                      <span className="shrink-0 text-xs text-ink-400">{d.periodText ?? formatDate(d.updatedAt)}</span>
                      <span className="w-28 shrink-0 text-right font-mono text-sm text-ink-100">
                        {formatMoney(d.amount)}
                        <NetHint amount={d.amount} />
                      </span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Виджеты «требует внимания»: клик раскрывает, кто именно ──────────────────
export type AttentionItem = { id: string; href: string; title: string; sub: string };

export function AttentionWidget({
  label,
  items,
  tone,
}: {
  label: string;
  items: AttentionItem[];
  tone: "red" | "amber";
}) {
  const [open, setOpen] = useState(false);
  const c =
    tone === "red"
      ? "border-red-500/25 bg-red-500/[0.07] text-red-200"
      : "border-amber-500/25 bg-amber-500/[0.07] text-amber-100";

  return (
    <div className={`rounded-xl border ${c}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        disabled={items.length === 0}
      >
        <div>
          <div className="text-2xl font-bold tabular-nums">{items.length}</div>
          <div className="text-xs">{label}</div>
        </div>
        {items.length > 0 && (
          <ChevronDown size={16} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {open && items.length > 0 && (
        <div className="animate-lift space-y-1 border-t border-white/10 px-3 py-2">
          {items.map((i) => (
            <Link
              key={i.id}
              href={i.href}
              className="block rounded-lg px-2 py-1.5 text-xs transition hover:bg-black/20"
            >
              <span className="block truncate font-medium text-ink-50">{i.title}</span>
              <span className="block truncate opacity-80">{i.sub}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
