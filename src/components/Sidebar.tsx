"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { NAV_GROUPS, SECURITY_NAV } from "@/lib/nav";
import { ChatBadge } from "@/components/ui/ChatBadge";
import { ROLE_LABELS, type Role } from "@/lib/enums";
import { initials } from "@/lib/format";
import { apiFetch } from "@/lib/client";
import { ChangePassword } from "@/components/ChangePassword";
import { UserMenu } from "@/components/UserMenu";
import { TwoFactorPanel } from "@/components/security/TwoFactorButton";
import { LEGAL_DOCS } from "@/lib/legal";

// Группы меню, свёрнутые при первом входе.
const DEFAULT_COLLAPSED = ["Соответствие"];

// Короткие подписи правовых документов для низа меню. Полные названия
// («Какие данные обрабатываются и как защищены») писались в три строки.
const LEGAL_TINY: Record<string, string> = {
  polzovatelskoe: "Соглашение",
  politika: "Политика ПДн",
  soglasie: "Согласие",
};

export function Sidebar({
  user,
  twoFactorPending,
}: {
  user: { id: string; name: string; email: string; role: string; track: string; avatarUrl?: string | null; totpEnabled?: boolean; position?: string | null };
  /** Второй фактор ОБЯЗАТЕЛЕН этой роли и ещё не включён — точка у аватарки. */
  twoFactorPending?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Счётчик-сигнал: увеличиваем — открывается окно смены пароля из меню.
  const [passwordSignal, setPasswordSignal] = useState(0);
  const [twoFactorSignal, setTwoFactorSignal] = useState(0);
  // Свёрнутые группы меню. «Соответствие» (журнал действий, запросы по ПДн,
  // сроки хранения) рядовому менеджеру не нужно каждый день — три пункта
  // висели в меню постоянно. Теперь группа свёрнута, а разворачивается
  // кликом по заголовку; выбор запоминается в браузере.
  const [collapsed, setCollapsed] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("colizeum_nav_collapsed");
      setCollapsed(saved ? (JSON.parse(saved) as string[]) : DEFAULT_COLLAPSED);
    } catch {
      setCollapsed(DEFAULT_COLLAPSED);
    }
  }, []);
  function toggleGroup(title: string) {
    setCollapsed((prev) => {
      const next = prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title];
      try {
        localStorage.setItem("colizeum_nav_collapsed", JSON.stringify(next));
      } catch {
        // приватный режим — свернём только до перезагрузки
      }
      return next;
    });
  }

  // Кнопка «Ещё» в нижней панели просит открыть эту же шторку.
  useEffect(() => {
    const open = () => setOpen(true);
    window.addEventListener("colizeum:open-menu", open);
    return () => window.removeEventListener("colizeum:open-menu", open);
  }, []);

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  // Раздел «Руководителю» видит только директор (не админ и не специалисты).
  // Руководитель видит оба контура (реклама + турниры); специалист — только свой
  // (пункты с track показываются лишь сотрудникам этого направления).
  const isDirector = user.role === "Director";
  const isSecurity = user.role === "Security";
  const groups = NAV_GROUPS
    .filter((g) => !g.leadershipOnly || isDirector)
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          (!it.track || isDirector || it.track === user.track) &&
          // roles сильнее track: журнал действий и запросы по ПДн не зависят
          // от направления работы, только от роли.
          (!it.roles || it.roles.includes(user.role as "Owner" | "Director" | "Manager" | "Security")) &&
          // Роль «Безопасность» работает по белому списку (см. src/middleware.ts):
          // всё остальное её и так не пустит. Раньше меню показывало ей клиентов,
          // сделки и оплаты — клик по ним выбрасывал обратно в журнал, и выглядело
          // это как поломка, а не как ограничение прав.
          (!isSecurity || SECURITY_NAV.some((h) => it.href === h || it.href.startsWith(h + "/"))),
      ),
    }))
    .filter((g) => g.items.length > 0);

  const current = groups
    .flatMap((g) => g.items)
    .filter((it) => isActive(it.href))
    .sort((a, b) => b.href.length - a.href.length)[0];

  const nav = (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {groups.map((group) => {
        // Группу с открытой страницей не сворачиваем: иначе человек не видит,
        // где он находится.
        const hasActive = group.items.some((it) => isActive(it.href));
        const isCollapsed = collapsed.includes(group.title) && !hasActive;
        return (
        <div key={group.title}>
          <button
            type="button"
            onClick={() => toggleGroup(group.title)}
            className="mb-1.5 flex w-full items-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 transition hover:text-ink-300"
            title={isCollapsed ? "Показать раздел" : "Свернуть раздел"}
          >
            <span>{group.title}</span>
            <span className="text-[9px] opacity-70">{isCollapsed ? "▸" : "▾"}</span>
          </button>
          <div className={`space-y-0.5 ${isCollapsed ? "hidden" : ""}`}>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`nav-link ${isActive(item.href) ? "nav-link-active" : ""}`}
              >
                <span className="nav-icon w-5 text-center text-base opacity-90">{item.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.label}</span>
                </span>
                {item.href === "/messenger" && <ChatBadge />}
              </Link>
            ))}
          </div>
        </div>
        );
      })}
    </nav>
  );

  // ⚠️ shrink-0: низ меню (профиль, строка про утечку, правовые ссылки) не
  // должен сжиматься, когда разделов много. Иначе при увеличенном масштабе
  // интерфейса он обрезался нижним краем экрана — список разделов для этого
  // и сделан прокручиваемым.
  const userBox = (
    <div className="shrink-0 border-t border-ink-800 p-3">
      {/* Всё про себя — под аватаркой: фото, пароль, выход */}
      <UserMenu
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          // Под именем показываем ДОЛЖНОСТЬ, если она задана: человеку важнее
          // «Руководитель проекта», чем техническая роль «Админ». Роли без
          // должности подписываются по-старому.
          roleLabel: user.position ?? ROLE_LABELS[user.role as Role] ?? user.role,
          avatarUrl: user.avatarUrl,
          totpEnabled: user.totpEnabled,
          twoFactorPending: twoFactorPending,
        }}
        onChangePassword={() => setPasswordSignal((n) => n + 1)}
        onTwoFactor={() => setTwoFactorSignal((n) => n + 1)}
      />
      <ChangePassword userId={user.id} hideTrigger openSignal={passwordSignal} />
      <TwoFactorPanel userId={user.id} enabled={!!user.totpEnabled} openSignal={twoFactorSignal} />

      {/* ⚠️ «Что делать при утечке» (требование 4.9) переехала в меню профиля:
          здесь красная плашка НАКЛАДЫВАЛАСЬ на правовые ссылки и читалась как
          постоянная тревога на каждом экране. Доступность сохранена — меню
          профиля есть у всех ролей, пункт называется «Данные могли утечь». */}
      {/* Правовые документы — те же, что в подвале страницы входа. Нужны и
          после входа: сотрудник должен иметь возможность перечитать их. */}
      {/* Одной строкой и короткими словами: полные названия («Какие данные
          обрабатываются и как защищены») занимали три строки, и низ меню
          обрезался нижним краем экрана. Полное название — в подсказке. */}
      <div className="mt-2 flex items-center gap-1.5 px-2 text-[10px] leading-tight text-ink-600">
        {LEGAL_DOCS.map((d, i) => (
          <span key={d.slug} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <span className="text-ink-700">·</span>}
            <Link
              href={`/legal/${d.slug}`}
              title={d.short}
              className="truncate transition hover:text-brand"
            >
              {LEGAL_TINY[d.slug] ?? d.short}
            </Link>
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* мобильная шапка */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink-800 bg-ink-950/90 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/dashboard" className="shrink-0">
          <Logo />
        </Link>
        {/* Где я сейчас: на узком экране это единственная подсказка. */}
        <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-ink-300">
          {current?.label ?? ""}
        </span>
        <button className="btn-icon shrink-0" onClick={() => setOpen(true)} aria-label="Все разделы">
          ☰
        </button>
      </div>

      {/* десктоп-сайдбар */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-900/70 md:flex">
        <div className="border-b border-ink-800 px-5 py-5">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>
        {nav}
        {userBox}
      </aside>

      {/* мобильный оверлей */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-[85%] max-w-xs flex-col border-r border-ink-800 bg-ink-900 animate-fade-in">
            <div className="flex items-center justify-between border-b border-ink-800 px-5 py-5">
              <Logo />
              <button className="btn-icon" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            {nav}
            {userBox}
          </aside>
        </div>
      )}
    </>
  );
}
