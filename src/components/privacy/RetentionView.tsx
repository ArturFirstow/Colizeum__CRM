"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";

// ─────────────────────────────────────────────────────────────────────────────
// Экран сроков хранения (требование 4.7).
//
// Читается сверху вниз как ответ на три вопроса: что у нас лежит, сколько
// положено хранить, сколько уже просрочено. Кнопка уборки — у каждого правила
// своя, потому что согласовывать сроки будут по одному.
//
// Несогласованные сроки нарочно подписаны «предложение» и убираются только
// отдельной кнопкой с предупреждением: иначе черновая цифра молча стёрла бы
// настоящие данные.
// ─────────────────────────────────────────────────────────────────────────────

type Rule = {
  id: string;
  title: string;
  personalData: string;
  months: number;
  action: "удаление" | "обезличивание";
  basis: string;
  confirmed: boolean;
  overdue: number;
  total: number;
};

type SweepResult = { id: string; title: string; done: number; skipped?: string };

/** «1 запись», «3 записи», «12 записей» — иначе в отчёте «1 записей». */
function records(n: number): string {
  const last = n % 10;
  const two = n % 100;
  if (two >= 11 && two <= 14) return `${n} записей`;
  if (last === 1) return `${n} запись`;
  if (last >= 2 && last <= 4) return `${n} записи`;
  return `${n} записей`;
}

function months(n: number): string {
  if (n % 12 === 0) {
    const y = n / 12;
    return y === 1 ? "1 год" : y < 5 ? `${y} года` : `${y} лет`;
  }
  return `${n} мес.`;
}

export function RetentionView() {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SweepResult[] | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch<{ rules: Rule[] }>("/api/privacy/retention");
      setRules(r.rules);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function sweep(rule: Rule) {
    if (rule.overdue === 0) return;
    const what =
      rule.action === "удаление"
        ? `Будет удалено: ${records(rule.overdue)}. Вернуть их будет нельзя.`
        : `Будет обезличено: ${records(rule.overdue)}. Имя и контакты сотрутся, сами записи останутся.`;
    if (!confirm(`${rule.title}\n\n${what}\n\nПродолжить?`)) return;

    setBusy(rule.id);
    setError(null);
    try {
      const r = await apiFetch<{ results: SweepResult[]; rules: Rule[] }>("/api/privacy/retention", {
        method: "POST",
        body: JSON.stringify({ ruleId: rule.id, includeUnconfirmed: !rule.confirmed }),
      });
      setRules(r.rules);
      setDone(r.results.filter((x) => x.done > 0 || x.id === rule.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  if (error && !rules) {
    return <div className="card p-5 text-sm text-red-300">{error}</div>;
  }
  if (!rules) return <div className="card p-5 text-sm text-ink-400">Считаем…</div>;

  const unconfirmed = rules.filter((r) => !r.confirmed).length;
  const overdueTotal = rules.reduce((s, r) => s + r.overdue, 0);

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-2xl font-bold text-ink-50">{rules.length}</div>
            <div className="text-xs text-ink-400">наборов данных со сроком</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${overdueTotal > 0 ? "text-amber-300" : "text-ink-50"}`}>
              {overdueTotal}
            </div>
            <div className="text-xs text-ink-400">записей уже просрочено</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${unconfirmed > 0 ? "text-amber-300" : "text-emerald-300"}`}>
              {unconfirmed}
            </div>
            <div className="text-xs text-ink-400">сроков ждут согласования</div>
          </div>
        </div>
        <p className="mt-4 border-t border-ink-800 pt-3 text-xs text-ink-500">
          Закон не разрешает хранить данные о людях бессрочно: у каждого набора должен быть срок,
          после которого его удаляют или обезличивают. Сам механизм уборки готов, а конкретные сроки
          утверждает ответственный за обработку персональных данных — пока он этого не сделал, они
          подписаны «предложение» и сами не срабатывают.
        </p>
      </section>

      {done && (
        <section className="card border-emerald-500/30 bg-emerald-500/5 p-5">
          <h3 className="font-semibold text-emerald-200">Убрано</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-200">
            {done.map((d) => (
              <li key={d.id}>
                {d.title}: {d.skipped ? `пропущено — ${d.skipped}` : records(d.done)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <div className="card border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>
      )}

      {rules.map((r) => (
        <section key={r.id} className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-ink-50">{r.title}</h3>
              <p className="mt-1 text-sm text-ink-400">{r.personalData}</p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                r.confirmed
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-300"
              }`}
            >
              {r.confirmed ? "срок согласован" : "предложение"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3">
              <div className="text-xs text-ink-500">Храним</div>
              <div className="mt-0.5 font-semibold text-ink-100">{months(r.months)}</div>
            </div>
            <div className="rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3">
              <div className="text-xs text-ink-500">По истечении</div>
              <div className="mt-0.5 font-semibold text-ink-100">{r.action}</div>
            </div>
            <div className="rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3">
              <div className="text-xs text-ink-500">Просрочено сейчас</div>
              <div
                className={`mt-0.5 font-semibold ${r.overdue > 0 ? "text-amber-300" : "text-ink-100"}`}
              >
                {r.overdue} <span className="text-xs font-normal text-ink-500">из {r.total}</span>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-ink-500">{r.basis}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              className="btn btn-ghost btn-sm"
              disabled={r.overdue === 0 || busy === r.id}
              onClick={() => sweep(r)}
            >
              {busy === r.id
                ? "Убираем…"
                : r.overdue === 0
                  ? "Убирать нечего"
                  : r.action === "удаление"
                    ? `Удалить просроченное (${r.overdue})`
                    : `Обезличить просроченное (${r.overdue})`}
            </button>
            {!r.confirmed && r.overdue > 0 && (
              <span className="text-xs text-amber-300">
                Срок ещё не согласован — запускайте, только если решение принято.
              </span>
            )}
          </div>
        </section>
      ))}

      <p className="text-xs text-ink-500">
        Чтобы уборка шла сама, на сервере ставится ночной запуск:{" "}
        <code className="text-ink-300">npm run retention</code> — он трогает только
        согласованные сроки. Как поставить в расписание — в <code className="text-ink-300">docs/ДЕПЛОЙ.md</code>.
      </p>
    </div>
  );
}
