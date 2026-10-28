"use client";

import { useId } from "react";
import { formatMoney } from "@/lib/format";
import { toGross } from "@/components/ui/Money";
import { compactMoney, currentMonth, monthLabel } from "@/lib/month";

// ─────────────────────────────────────────────────────────────────────────────
// График оплат по месяцам — «общая картина» над календарём платежей.
//
// Зачем он нужен. Таблица календаря отвечает на вопрос «кто и когда платит»,
// но не отвечает на «ровно ли лежат деньги по месяцам» — а именно это видно
// глазами и именно это спрашивают на планёрке. Один столбик = один месяц,
// внутри столбика видно, что уже оплачено, что ждём и что просрочено.
//
// Почему без библиотеки. Столбики — это div'ы с процентной высотой; recharts
// или chart.js утянули бы в сборку сотни килобайт ради одной картинки.
//
// ⚠️ Суммы приходят ЧИСТЫМИ (как они лежат в базе), а подписываются С НДС —
// общее правило сервиса «вводим чистую, показываем с НДС».
//
// ⚠️ Цвета статусов проверены на различимость при дальтонизме (ΔE 13 protan,
// 19,8 при обычном зрении, контраст с фоном выше 3:1). Цвет при этом НЕ
// единственный ключ: у каждого ряда есть подпись в легенде и во всплывающей
// подсказке, а под графиком лежит та же таблица цифрами.
// ─────────────────────────────────────────────────────────────────────────────

/** Один месяц графика. Все суммы — ЧИСТЫЕ (без НДС). */
export type PaymentBar = { month: string; paid: number; planned: number; overdue: number };

const SERIES = [
  { key: "paid", label: "Оплачено", color: "#059669" },
  { key: "planned", label: "Ждём оплату", color: "#F59E0B" },
  { key: "overdue", label: "Просрочено", color: "#EF4444" },
] as const;

/** Ровная верхняя граница шкалы: 1 / 2 / 2,5 / 5 / 10 × 10^n. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(value));
  for (const k of [1, 2, 2.5, 5, 10]) {
    if (value <= k * step) return k * step;
  }
  return 10 * step;
}

export function PaymentChart({
  bars,
  summary = true,
  height = 168,
  emptyText = "Платежей пока нет",
}: {
  bars: PaymentBar[];
  /** Строка-итог над графиком: сколько всего и сколько уже оплачено. */
  summary?: boolean;
  /** Высота области столбиков в пикселях (в окне график ниже). */
  height?: number;
  emptyText?: string;
}) {
  const uid = useId();
  const today = currentMonth();

  const totals = bars.map((b) => b.paid + b.planned + b.overdue);
  const peak = Math.max(0, ...totals);
  const scale = niceMax(toGross(peak));
  const all = bars.reduce(
    (acc, b) => ({
      paid: acc.paid + b.paid,
      planned: acc.planned + b.planned,
      overdue: acc.overdue + b.overdue,
    }),
    { paid: 0, planned: 0, overdue: 0 },
  );
  const grand = all.paid + all.planned + all.overdue;
  const paidShare = grand > 0 ? Math.round((all.paid / grand) * 100) : 0;
  // Ряды, которых в данных нет, не попадают ни в легенду, ни в подсказку:
  // пустая строка «Просрочено — 0 ₽» только отвлекает.
  const shown = SERIES.filter((s) => all[s.key] > 0);
  const peakIndex = totals.indexOf(peak);

  if (bars.length === 0 || grand <= 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-700 py-8 text-center text-sm text-ink-400">
        {emptyText}
      </div>
    );
  }

  return (
    <div>
      {summary && (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <div className="font-display text-xl font-bold text-ink-50">
            {formatMoney(toGross(grand))}
          </div>
          <div className="text-xs text-ink-500">
            разложено по месяцам · оплачено{" "}
            <span className="font-semibold text-emerald-300">{formatMoney(toGross(all.paid))}</span>{" "}
            ({paidShare} %)
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {/* Левая шкала: три отметки, дальше читается по подсказке и таблице. */}
        <div
          className="relative w-12 shrink-0 text-right text-[10px] tabular-nums text-ink-600"
          style={{ height }}
          aria-hidden
        >
          <span className="absolute right-0 top-0 -translate-y-1/2">{compactMoney(scale)}</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">
            {compactMoney(scale / 2)}
          </span>
          <span className="absolute bottom-0 right-0 translate-y-1/2">0</span>
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto pb-1">
          <div className="relative" style={{ height }}>
            {/* Сетка — волосяная и без пунктира, чтобы не спорить с данными. */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-x-0 top-0 border-t border-ink-800" />
              <div className="absolute inset-x-0 top-1/2 border-t border-ink-800" />
              <div className="absolute inset-x-0 bottom-0 border-t border-ink-700" />
            </div>

            <div className="flex h-full items-end gap-1">
              {bars.map((b, i) => {
                const total = b.paid + b.planned + b.overdue;
                const isToday = b.month === today;
                // Подсказку у крайних столбиков прижимаем к краю, иначе она
                // уезжает за пределы прокручиваемой области и обрезается.
                const tipPos =
                  i === 0
                    ? "left-0"
                    : i === bars.length - 1
                      ? "right-0"
                      : "left-1/2 -translate-x-1/2";
                return (
                  <div
                    key={b.month}
                    tabIndex={0}
                    aria-describedby={`${uid}-${i}`}
                    className="group relative flex h-full min-w-[46px] flex-1 flex-col justify-end rounded-md outline-none focus-visible:ring-1 focus-visible:ring-brand/60"
                  >
                    {/* Текущий месяц — чёрточкой на оси и жёлтой подписью
                        внизу. Заливка всей колонки читалась как «здесь что-то
                        выделено», а не как «мы сейчас здесь». */}
                    {isToday && (
                      <div className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" />
                    )}

                    {/* Подпись значения — только у самого высокого месяца:
                        цифра над каждым столбиком превращается в шум. */}
                    {i === peakIndex && total > 0 && (
                      <div
                        className="pointer-events-none absolute inset-x-0 text-center text-[10px] tabular-nums text-ink-400"
                        style={{ bottom: `calc(${(toGross(total) / scale) * 100}% + 4px)` }}
                      >
                        {compactMoney(toGross(total))}
                      </div>
                    )}

                    <div
                      className="mx-auto flex w-6 flex-col justify-end gap-[2px] transition group-hover:brightness-110"
                      style={{ height: `${(toGross(total) / scale) * 100}%` }}
                    >
                      {/* Сверху вниз: просрочено → ждём → оплачено. Разделяет
                          ряды зазор в 2 px цветом фона, а не обводка. */}
                      {["overdue", "planned", "paid"].map((key, idx, arr) => {
                        const v = b[key as keyof PaymentBar] as number;
                        if (v <= 0) return null;
                        const s = SERIES.find((x) => x.key === key)!;
                        const topMost =
                          arr.slice(0, idx).every((k) => (b[k as keyof PaymentBar] as number) <= 0);
                        return (
                          <div
                            key={key}
                            style={{
                              flexGrow: v,
                              flexBasis: 0,
                              minHeight: 3,
                              background: s.color,
                              borderRadius: topMost ? "4px 4px 0 0" : 0,
                            }}
                          />
                        );
                      })}
                    </div>

                    <div
                      id={`${uid}-${i}`}
                      role="tooltip"
                      className={`pointer-events-none absolute bottom-full z-20 mb-1 hidden w-max rounded-lg border border-ink-700 bg-ink-950/95 px-3 py-2 text-left shadow-card-dark group-hover:block group-focus-within:block ${tipPos}`}
                    >
                      <div className="text-xs font-semibold text-ink-100">
                        {monthLabel(b.month)}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {SERIES.filter((s) => (b[s.key] as number) > 0).map((s) => (
                          <div key={s.key} className="flex items-center gap-2 text-xs">
                            <i
                              className="h-2 w-2 shrink-0 rounded-sm"
                              style={{ background: s.color }}
                            />
                            <span className="text-ink-400">{s.label}</span>
                            <span className="ml-auto tabular-nums text-ink-100">
                              {formatMoney(toGross(b[s.key] as number))}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-1 border-t border-ink-800 pt-1 text-xs text-ink-500">
                        всего {formatMoney(toGross(total))} с НДС
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Месяцы — в той же прокручиваемой области, иначе разъедутся со столбиками */}
          <div className="mt-1.5 flex gap-1">
            {bars.map((b) => (
              <div
                key={b.month}
                className={`min-w-[46px] flex-1 text-center text-[10px] ${
                  b.month === today ? "font-semibold text-brand" : "text-ink-500"
                }`}
              >
                {monthLabel(b.month)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Легенда обязательна, когда рядов больше одного: цвет не должен быть
          единственным способом понять, что перед тобой. */}
      {shown.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
          {shown.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
              <span className="tabular-nums text-ink-500">{formatMoney(toGross(all[s.key]))}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
