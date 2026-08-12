"use client";

import { formatMoney } from "@/lib/format";
import { vatRateForDate } from "@/lib/enums";

// ─────────────────────────────────────────────────────────────────────────────
// Поле «сумма» с автосчётчиком НДС.
//
// Правило одно на весь сервис: человек вносит ЧИСТУЮ сумму — ту, что стоит
// в медиаплане и звучит в разговоре с клиентом. Сумму с НДС сервис считает
// сам и показывает прямо под полем, пока её печатают: видно, что уйдёт
// юристу и бухгалтеру, и не надо держать в голове «а сколько это с НДС».
//
// Ставка берётся по дате документа: 2025 — 20 %, 2026 — 22 %.
// ─────────────────────────────────────────────────────────────────────────────

export function NetAmountInput({
  label,
  value,
  onChange,
  date,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Дата документа — по ней ставка НДС. Пусто — по сегодняшней. */
  date?: Date | string | null;
  placeholder?: string;
  required?: boolean;
}) {
  const d = date ? new Date(date) : new Date();
  const rate = vatRateForDate(Number.isNaN(d.getTime()) ? new Date() : d);
  const net = Number(String(value).replace(/\s/g, "").replace(",", "."));
  const ok = String(value).trim() !== "" && Number.isFinite(net) && net > 0;
  const gross = net * (1 + rate / 100);

  return (
    <div>
      <label className="label">
        {label} <span className="text-ink-500">без НДС</span>
        {required ? " *" : ""}
      </label>
      <input
        className="input"
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
      <p className="mt-1 text-xs text-ink-500">
        {ok ? (
          <>
            С НДС {rate}% — <b className="text-ink-300">{formatMoney(Math.round(gross))}</b> (в том числе
            НДС {formatMoney(Math.round(gross - net))})
          </>
        ) : (
          <>Впишите чистую сумму — НДС {rate}% сервис досчитает сам</>
        )}
      </p>
    </div>
  );
}
