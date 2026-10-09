"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { apiFetch, ApiError } from "@/lib/client";
import { DEAL_STAGES } from "@/lib/enums";
import { stageStyle } from "@/lib/ui-tokens";
import { celebrate } from "@/lib/celebrate";

export function StageChanger({
  dealId,
  current,
  skipped = [],
}: {
  dealId: string;
  current: string;
  /** Стадии, которые к этой сделке не относятся (просьба коллег И-7). */
  skipped?: string[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [editingSkips, setEditingSkips] = useState(false);
  const [skipDraft, setSkipDraft] = useState<string[]>(skipped);
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

  // Сохранить список неактуальных стадий.
  async function saveSkips() {
    setSaving(true);
    try {
      await apiFetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({ skippedStages: skipDraft }),
      });
      setEditingSkips(false);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* ── Путь сделки по стадиям ────────────────────────────────────────────
          Раньше здесь была просто полоска из девяти безымянных отрезков:
          кликается, а что под каким — видно только при наведении мышью
          (с телефона не видно вовсе). Коллеги про это и написали: «подписать
          блоки стадий» (И-7). Теперь у каждого шага номер и название.

          Вторая половина их просьбы — пометка «стадия не актуальна». У
          технической сделки нет предоплаты, у бартера — УПД; раньше такая
          стадия висела в ряду наравне с остальными, и было непонятно, забыли
          про неё или она не нужна. Отмеченные шаги показаны зачёркнуто. */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-1.5">
          {DEAL_STAGES.map((s, i) => {
            const isSkipped = skipped.includes(s);
            const done = i <= currentIdx && !isSkipped;
            const isCurrent = s === current;
            return (
              <button
                key={s}
                onClick={() => change(s)}
                disabled={saving}
                title={isSkipped ? `${s} — к этой сделке не относится` : `Перевести на «${s}»`}
                className={`min-w-[84px] flex-1 rounded-lg border px-2 py-1.5 text-left transition ${
                  isCurrent
                    ? "border-brand bg-brand/15"
                    : done
                      ? "border-brand/30 bg-brand/5 hover:border-brand/60"
                      : isSkipped
                        ? "border-dashed border-ink-800 bg-transparent"
                        : "border-ink-800 bg-ink-900/40 hover:border-ink-600"
                }`}
              >
                <span
                  className={`block text-[10px] font-semibold ${
                    isSkipped ? "text-ink-600" : done || isCurrent ? "text-brand" : "text-ink-500"
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={`block truncate text-[11px] leading-tight ${
                    isSkipped
                      ? "text-ink-600 line-through"
                      : isCurrent
                        ? "font-semibold text-ink-50"
                        : done
                          ? "text-ink-200"
                          : "text-ink-400"
                  }`}
                >
                  {s}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <button
            className="text-ink-500 underline underline-offset-2 transition hover:text-brand"
            onClick={() => {
              setSkipDraft(skipped);
              setEditingSkips((v) => !v);
            }}
          >
            {editingSkips ? "Свернуть" : "Какие стадии к этой сделке не относятся"}
          </button>
          {skipped.length > 0 && !editingSkips && (
            <span className="text-ink-600">не применяются: {skipped.length}</span>
          )}
        </div>

        {editingSkips && (
          <div className="mt-2 rounded-xl border border-ink-800 bg-ink-900/60 p-3">
            <p className="mb-2 text-xs text-ink-400">
              Отметьте шаги, которых у этой сделки не будет, — они перестанут выглядеть
              забытыми. Например, у технической сделки нет предоплаты, у бартера — УПД.
            </p>
            <div className="grid gap-1 sm:grid-cols-3">
              {DEAL_STAGES.map((s) => (
                <label key={s} className="flex items-center gap-2 text-xs text-ink-200">
                  <input
                    type="checkbox"
                    checked={skipDraft.includes(s)}
                    onChange={(e) =>
                      setSkipDraft((d) => (e.target.checked ? [...d, s] : d.filter((x) => x !== s)))
                    }
                  />
                  {s}
                </label>
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingSkips(false)}>
                Отмена
              </button>
              <button className="btn btn-primary btn-sm" onClick={saveSkips} disabled={saving}>
                {saving ? "…" : "Сохранить"}
              </button>
            </div>
          </div>
        )}
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
