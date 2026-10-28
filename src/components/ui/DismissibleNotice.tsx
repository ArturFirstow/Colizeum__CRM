"use client";

import { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Полоса-напоминание, которую можно закрыть.
//
// ЗАЧЕМ. Напоминание про вход по коду висело на КАЖДОЙ странице и закрыть его
// было нельзя. Человек, который всё понял и отложил настройку на вечер, видел
// его сто раз за день — и переставал замечать вместе с ним всё остальное.
// Напоминание, которое нельзя убрать, перестаёт быть напоминанием.
//
// Отметка о закрытии живёт в браузере (localStorage), а не на сервере: это
// предпочтение показа, а не данные. Поэтому на новом устройстве напоминание
// появится снова — и это правильно, там его ещё не видели.
//
// ⚠️ Закрыть — не значит «сделано». Пока второй фактор не включён, у аватарки
// в меню горит точка (см. UserMenu): дело остаётся на виду, но не занимает
// верх каждой страницы.
// ─────────────────────────────────────────────────────────────────────────────

export function DismissibleNotice({
  id,
  tone = "warn",
  children,
}: {
  /** Ключ хранения. Меняется — напоминание показывается заново. */
  id: string;
  tone?: "warn" | "info";
  children: React.ReactNode;
}) {
  const key = `colizeum_notice_${id}`;
  // Сначала не показываем ничего: иначе полоса мигнёт у тех, кто её закрыл.
  const [state, setState] = useState<"unknown" | "show" | "hidden">("unknown");

  useEffect(() => {
    try {
      setState(localStorage.getItem(key) ? "hidden" : "show");
    } catch {
      // Приватный режим или запрет хранилища — показываем как обычно.
      setState("show");
    }
  }, [key]);

  if (state !== "show") return null;

  const skin =
    tone === "warn"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
      : "border-ink-700 bg-ink-900/70 text-ink-200";

  return (
    <div className={`mb-5 flex items-start gap-3 rounded-2xl border px-5 py-4 text-sm ${skin}`}>
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        aria-label="Скрыть напоминание"
        title="Скрыть. Останется точкой у вашей аватарки"
        className="-mr-1 -mt-1 shrink-0 rounded-lg px-2 py-1 text-base leading-none opacity-60 transition hover:bg-white/10 hover:opacity-100"
        onClick={() => {
          try {
            localStorage.setItem(key, String(Date.now()));
          } catch {
            // не сохранилось — просто спрячем до перезагрузки
          }
          setState("hidden");
        }}
      >
        ✕
      </button>
    </div>
  );
}
