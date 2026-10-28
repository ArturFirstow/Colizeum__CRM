"use client";

import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// «Ещё» — редкие действия под одной кнопкой.
//
// ЗАЧЕМ. В шапке карточки сделки стояло шесть равнозначных кнопок в два ряда:
// два конструктора запросов, драфт ДС, ссылка в Aspro, правка и удаление.
// Когда всё одинаково важное, глазу не за что зацепиться, а «Удалить» стоит
// рядом с тем, чем пользуются каждый день.
//
// Правило простое: на виду — то, что делают часто; в «Ещё» — остальное и всё
// опасное. Меню закрывается кликом мимо и клавишей Esc.
// ─────────────────────────────────────────────────────────────────────────────

export function MoreMenu({
  children,
  label = "Ещё",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
      >
        ⋯ {label}
      </button>
      {open && (
        // Клик по любому действию закрывает меню: почти все они открывают
        // своё окно, и список поверх него только мешал бы.
        <div
          className="absolute right-0 z-40 mt-2 flex min-w-[230px] flex-col items-stretch gap-1.5 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-xl animate-fade-in [&_.btn]:w-full [&_.btn]:justify-start"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}
