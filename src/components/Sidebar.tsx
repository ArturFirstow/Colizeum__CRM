"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { NAV_GROUPS } from "@/lib/nav";
import { ChatBadge } from "@/components/ui/ChatBadge";
import { ROLE_LABELS, type Role } from "@/lib/enums";
import { initials } from "@/lib/format";
import { apiFetch } from "@/lib/client";
import { ChangePassword } from "@/components/ChangePassword";
import { UserMenu } from "@/components/UserMenu";

export function Sidebar({
  user,
}: {
  user: { id: string; name: string; email: string; role: string; track: string; avatarUrl?: string | null };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Счётчик-сигнал: увеличиваем — открывается окно смены пароля из меню.
  const [passwordSignal, setPasswordSignal] = useState(0);

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
  const groups = NAV_GROUPS
    .filter((g) => !g.leadershipOnly || isDirector)
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => !it.track || isDirector || it.track === user.track),
    }))
    .filter((g) => g.items.length > 0);

  const nav = (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.title}>
          <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
            {group.title}
          </div>
          <div className="space-y-0.5">
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
      ))}
    </nav>
  );

  const userBox = (
    <div className="border-t border-ink-800 p-3">
      {/* Всё про себя — под аватаркой: фото, пароль, выход */}
      <UserMenu
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          roleLabel: ROLE_LABELS[user.role as Role] ?? user.role,
          avatarUrl: user.avatarUrl,
        }}
        onChangePassword={() => setPasswordSignal((n) => n + 1)}
      />
      <ChangePassword userId={user.id} hideTrigger openSignal={passwordSignal} />
    </div>
  );

  return (
    <>
      {/* мобильная шапка */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-800 bg-ink-950/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <button className="btn-icon" onClick={() => setOpen(true)} aria-label="Меню">
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
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-ink-800 bg-ink-900 animate-fade-in">
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
