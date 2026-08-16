"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatBadge } from "@/components/ui/ChatBadge";

// ─────────────────────────────────────────────────────────────────────────────
// Нижняя панель для телефона.
//
// На телефоне выдвижное меню — это два действия на каждый переход: открыть
// шторку, найти пункт. Разделы, куда заходят по десять раз в день, вынесены
// вниз под большой палец: «Сегодня», «Задачи», главный раздел направления,
// «Мессенджер». Всё остальное — за кнопкой «Ещё», она открывает ту же шторку.
//
// Панель живёт только до планшета: с md появляется обычное боковое меню.
// ─────────────────────────────────────────────────────────────────────────────

type Tab = { href: string; label: string; icon: string; badge?: boolean };

export function MobileTabs({
  user,
}: {
  user: { role: string; track: string };
}) {
  const pathname = usePathname();
  const isDirector = user.role === "Director";

  // Третья вкладка — то, чем человек занят большую часть дня.
  const core: Tab =
    user.track === "Tournaments" && !isDirector
      ? { href: "/tournaments", label: "Турниры", icon: "♛" }
      : { href: "/deals", label: "Сделки", icon: "⑂" };

  const tabs: Tab[] = [
    { href: "/dashboard", label: "Сегодня", icon: "◆" },
    { href: "/tasks", label: "Задачи", icon: "✓" },
    core,
    { href: "/messenger", label: "Чат", icon: "✉", badge: true },
  ];

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-800 bg-ink-950/95 backdrop-blur md:hidden"
      // Запас под «шторку» жестов на айфоне — иначе нижний ряд под неё уезжает.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition ${
              isActive(t.href) ? "text-brand" : "text-ink-400"
            }`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            <span className="truncate">{t.label}</span>
            {t.badge && (
              <span className="absolute right-[22%] top-1.5">
                <ChatBadge />
              </span>
            )}
          </Link>
        ))}

        {/* «Ещё» открывает то же выдвижное меню, что и ☰ в шапке. Состояние
            шторки живёт в Sidebar, поэтому просим его открыться событием. */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("colizeum:open-menu"))}
          className="flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium text-ink-400 transition active:text-brand"
          aria-label="Все разделы"
        >
          <span className="text-lg leading-none">☰</span>
          <span>Ещё</span>
        </button>
      </div>
    </nav>
  );
}
