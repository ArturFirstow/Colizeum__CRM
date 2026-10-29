"use client";

import { MONTHS_RU_FULL } from "@/lib/month";

// ─────────────────────────────────────────────────────────────────────────────
// Поле «месяц» по-русски — два списка: месяц и год.
//
// ⚠️ Та же беда, что с датой (см. DateInput): `<input type="month">` рисует
// браузер и подписывает месяц на ЕГО языке — в русском сервисе человек видел
// «October 2026». Атрибутом это не чинится, поэтому поле собрано своими
// руками. Наружу уходит прежняя строка «ГГГГ-ММ», формы и API не меняются.
//
// Списки, а не текст с маской: месяцев всего двенадцать, выбрать из списка
// быстрее и ошибиться негде.
// ─────────────────────────────────────────────────────────────────────────────

export function MonthInput({
  value,
  onChange,
  className = "input",
  required,
  disabled,
  compact,
}: {
  /** «ГГГГ-ММ» или пустая строка. */
  value: string;
  onChange: (ym: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  /** Узкий вид для строк таблицы. */
  compact?: boolean;
}) {
  const [y, m] = value.split("-");
  const year = Number(y) || new Date().getFullYear();
  const month = Number(m) || new Date().getMonth() + 1;

  // Год, который уже стоит в записи, должен быть в списке, даже если он
  // далеко позади: иначе правка старого платежа молча сместила бы его.
  const now = new Date().getFullYear();
  const years = new Set<number>([year]);
  for (let i = now - 2; i <= now + 4; i++) years.add(i);

  const cls = compact ? `${className} h-9 px-2 text-xs` : className;

  return (
    <div className="flex gap-1.5">
      <select
        className={`${cls} min-w-0 flex-1`}
        value={month}
        required={required}
        disabled={disabled}
        aria-label="Месяц"
        onChange={(e) => onChange(`${year}-${String(Number(e.target.value)).padStart(2, "0")}`)}
      >
        {MONTHS_RU_FULL.map((name, i) => (
          <option key={name} value={i + 1}>
            {compact ? name.slice(0, 3) : name}
          </option>
        ))}
      </select>
      <select
        className={`${cls} w-[4.5rem] shrink-0`}
        value={year}
        required={required}
        disabled={disabled}
        aria-label="Год"
        onChange={(e) => onChange(`${e.target.value}-${String(month).padStart(2, "0")}`)}
      >
        {[...years]
          .sort((a, b) => a - b)
          .map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
      </select>
    </div>
  );
}
