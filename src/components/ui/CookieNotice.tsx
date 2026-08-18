"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Плашка про файлы cookie.
//
// ⚠️ Текст намеренно честный. Сервис ставит РОВНО ОДНУ куку — `colizeum_session`,
// она нужна, чтобы вход работал: без неё каждая страница просила бы пароль
// заново. Ни аналитики, ни счётчиков, ни рекламных трекеров в сервисе нет,
// поэтому не пишем шаблонное «используем cookie для персонализации рекламы».
//
// Отсюда и кнопка одна: отказаться от технической куки нельзя — это отказ от
// входа. Плашка информирует, а не спрашивает разрешения, и это соответствует
// тому, что происходит на самом деле.
//
// Отметка о закрытии живёт в localStorage браузера, а не в куке: заводить
// вторую куку ради сообщения про куки — плохая шутка.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "colizeum_cookie_notice";
const VERSION = "1"; // поднять, если текст изменится и его нужно показать снова

export function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Читаем после монтирования: на сервере localStorage нет, а рисовать
    // плашку до проверки — значит мигать ею у тех, кто уже закрыл.
    try {
      if (localStorage.getItem(STORAGE_KEY) !== VERSION) setShow(true);
    } catch {
      // Приватный режим может запрещать localStorage — тогда просто покажем.
      setShow(true);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, VERSION);
    } catch {
      // Не смогли запомнить — не беда, плашка появится снова.
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="Уведомление об использовании файлов cookie"
      // На телефоне поднимаем над нижней панелью навигации, иначе плашка
      // ложится прямо на кнопки разделов.
      className="fixed inset-x-3 bottom-[4.75rem] z-40 mx-auto max-w-2xl md:inset-x-4 md:bottom-4"
    >
      <div className="card flex flex-col gap-3 p-4 shadow-xl sm:flex-row sm:items-center sm:gap-4">
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink-300">
          Сервис использует один файл cookie — он нужен, чтобы вы оставались в системе после
          входа. Аналитики, счётчиков и рекламных трекеров здесь нет. Подробнее —{" "}
          <Link href="/legal/politika" className="text-brand underline-offset-4 hover:underline">
            в политике обработки персональных данных
          </Link>
          .
        </p>
        <button className="btn btn-primary btn-sm shrink-0 self-start sm:self-auto" onClick={accept}>
          Понятно
        </button>
      </div>
    </div>
  );
}
