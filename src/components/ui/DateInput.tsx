"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Поле даты в русском виде — дд.мм.гггг.
//
// ⚠️ Зачем свой компонент. Обычное `<input type="date">` рисует браузер, и
// формат он берёт из НАСТРОЕК БРАУЗЕРА, а не из языка страницы. У половины
// сотрудников это «mm/dd/yyyy» — американский порядок в русском сервисе, из-за
// которого 05.11 легко прочитать как 11 мая. Атрибутом это не чинится.
//
// Как сделано: человек видит и правит обычный текст «дд.мм.гггг» (точки
// расставляются сами), а рядом кнопка-календарик открывает тот же системный
// выбор даты — он удобен мышкой. Наружу компонент отдаёт ISO-строку
// «ГГГГ-ММ-ДД», как и прежнее поле, поэтому формы и API не меняются.
// ─────────────────────────────────────────────────────────────────────────────

/** «2026-10-28» → «28.10.2026» (пусто → пусто). */
function isoToRu(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

/** «28.10.2026» → «2026-10-28». Неполная или несуществующая дата → пусто. */
function ruToIso(text: string): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text.trim());
  if (!m) return "";
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  // Проверка существования: 31.02 Date молча превратит в 3 марта.
  if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) {
    return "";
  }
  return `${yyyy}-${mm}-${dd}`;
}

/** Точки расставляются сами, пока человек набирает цифры. */
function maskRu(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join(".");
}

export function DateInput({
  value,
  onChange,
  className = "input",
  required,
  disabled,
  min,
  max,
  id,
  title,
}: {
  /** ISO «ГГГГ-ММ-ДД» или пустая строка. */
  value: string;
  /** Отдаёт ISO-строку (пустую, пока дата не дописана). */
  onChange: (iso: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  id?: string;
  title?: string;
}) {
  const [text, setText] = useState(() => isoToRu(value));
  const pickerRef = useRef<HTMLInputElement>(null);

  // Значение могли поменять снаружи (сброс формы, подстановка из сделки).
  useEffect(() => {
    setText(isoToRu(value));
  }, [value]);

  function handleText(raw: string) {
    const masked = maskRu(raw);
    setText(masked);
    const iso = ruToIso(masked);
    // Пустое поле — это осознанная очистка даты; недописанная дата наружу не
    // уходит, иначе в базу попадал бы «2026-01-00» на полпути набора.
    if (iso || masked === "") onChange(iso);
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        className={`${className} pr-11`}
        placeholder="дд.мм.гггг"
        pattern="\d{2}\.\d{2}\.\d{4}"
        maxLength={10}
        value={text}
        required={required}
        disabled={disabled}
        title={title}
        onChange={(e) => handleText(e.target.value)}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Выбрать дату в календаре"
        title="Выбрать дату в календаре"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-500 transition hover:text-brand disabled:opacity-40"
        onClick={() => {
          const el = pickerRef.current;
          if (!el) return;
          // showPicker() есть в свежих браузерах; где нет — обычный клик по
          // скрытому полю тоже открывает календарь.
          if (typeof el.showPicker === "function") el.showPicker();
          else el.click();
        }}
      >
        <Calendar size={16} />
      </button>
      {/* Системный выбор даты — только ради календаря мышкой. */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-2 h-0 w-0 opacity-0"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          setText(isoToRu(e.target.value));
          onChange(e.target.value);
        }}
      />
    </div>
  );
}
