"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { apiFetch, ApiError } from "@/lib/client";
import { DEAL_STAGES } from "@/lib/enums";
import { stageStyle } from "@/lib/ui-tokens";
import { celebrate } from "@/lib/celebrate";

export function StageChanger({ dealId, current }: { dealId: string; current: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<{ stage: string; warnings: string[] } | null>(null);
  const [clarifyDate, setClarifyDate] = useState("");

  // «Уточню» — заводим задачу с дедлайном вместо молчаливого согласия.
  async function clarify(warnings: string[]) {
    setSaving(true);
    try {
      await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: `Разобраться: ${warnings[0] ?? "предупреждение по сделке"}`,
          kind: "Менеджер",
          side: "Мы",
          priority: "Высокий",
          dealId,
          dueDate: new Date(clarifyDate).toISOString(),
          notes: warnings.join("\n"),
        }),
      });
      setPending(null);
      setClarifyDate("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function change(stage: string, confirm = false) {
    if (stage === current && !confirm) return;
    setSaving(true);
    try {
      await apiFetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage, confirm }),
      });
      setPending(null);
      // Сделка дошла до конца — маленький праздник.
      if (stage === "Закрытие") celebrate();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const detail = err.detail as { warnings?: string[] } | undefined;
        setPending({ stage, warnings: detail?.warnings ?? [err.message] });
      } else {
        alert(err instanceof Error ? err.message : "Ошибка");
      }
    } finally {
      setSaving(false);
    }
  }

  const currentIdx = DEAL_STAGES.indexOf(current as (typeof DEAL_STAGES)[number]);

  return (
    <div>
      {/* Прогресс по 11 стадиям */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {DEAL_STAGES.map((s, i) => (
          <button
            key={s}
            onClick={() => change(s)}
            disabled={saving}
            title={s}
            className={`h-1.5 flex-1 min-w-[18px] rounded-full transition ${
              i <= currentIdx ? "bg-brand" : "bg-ink-700 hover:bg-ink-600"
            }`}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className={`pill ring-1 ring-inset ${stageStyle(current)}`}>{current}</span>
        <select
          className="input py-2 text-sm"
          value={current}
          onChange={(e) => change(e.target.value)}
          disabled={saving}
        >
          {DEAL_STAGES.map((s, i) => (
            <option key={s} value={s}>
              {i + 1}. {s}
            </option>
          ))}
        </select>
      </div>

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
              Это предупреждения, а не запрет. Либо подтвердите, что шаги пройдены, либо
              поставьте себе задачу разобраться — тогда предупреждение не потеряется.
            </p>

            {/* Второй путь: не «принимаю», а «уточню к дате». Иначе человек жмёт
                «всё равно» и вопрос забывается. */}
            <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-3">
              <label className="label">Уточню — поставить задачу на</label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="input h-9 w-44"
                  type="date"
                  value={clarifyDate}
                  onChange={(e) => setClarifyDate(e.target.value)}
                />
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={saving || !clarifyDate}
                  onClick={() => clarify(pending.warnings)}
                >
                  <CalendarClock size={14} /> Уточню к этой дате
                </button>
              </div>
              <p className="mt-1.5 text-xs text-ink-500">
                Задача «Разобраться: …» появится на доске со сроком. Стадия не изменится.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setPending(null)}>
                Отмена
              </button>
              <button className="btn btn-primary" disabled={saving} onClick={() => change(pending.stage, true)}>
                {saving ? "…" : "Знаю, принимаю"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
