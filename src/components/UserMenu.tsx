"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, LogOut, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/client";

// ─────────────────────────────────────────────────────────────────────────────
// Меню по клику на аватарку: сменить фото, сменить пароль, выйти.
// Раньше кнопки висели в ряд рядом с именем и занимали место в узком меню.
// ─────────────────────────────────────────────────────────────────────────────
export function UserMenu({
  user,
  onChangePassword,
  onTwoFactor,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    roleLabel: string;
    avatarUrl?: string | null;
    totpEnabled?: boolean;
    /** Вход по коду ОБЯЗАТЕЛЕН этой роли и ещё не включён. */
    twoFactorPending?: boolean;
  };
  onChangePassword: () => void;
  onTwoFactor: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Клик мимо меню закрывает его — обычное поведение таких менюшек.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("ownerType", "avatar");
      form.append("ownerId", user.id);
      form.append("kind", "Фото");
      const res = await fetch("/api/files", { method: "POST", body: form });
      const json = (await res.json()) as { data?: { id: string } };
      if (json.data?.id) {
        await apiFetch(`/api/users/${user.id}`, {
          method: "PATCH",
          body: JSON.stringify({ avatarUrl: `/api/files/${json.data.id}` }),
        });
        router.refresh();
      }
    } finally {
      setUploading(false);
      setOpen(false);
    }
  }

  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-ink-800/60"
        title="Профиль"
      >
        {/* Точка на аватарке — незакрытое дело по своему профилю (сейчас это
            невключённый вход по коду). Полосу-напоминание наверху страницы
            можно закрыть, а дело при этом остаётся на виду — но занимает
            точку, а не первый экран. */}
        <span className="relative shrink-0">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-ink-950">
              {initials}
            </span>
          )}
          {user.twoFactorPending && (
            <span
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-900 bg-amber-400"
              title="Вход по коду не включён"
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink-100">{user.name}</span>
          <span className="block truncate text-xs text-ink-500">{user.roleLabel}</span>
        </span>
        {uploading && <Loader2 size={14} className="animate-spin text-ink-500" />}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-full min-w-[220px] overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-xl">
          <div className="border-b border-ink-800 px-3 py-2.5">
            <div className="truncate text-sm font-medium text-ink-100">{user.name}</div>
            <div className="truncate text-xs text-ink-500">{user.email}</div>
          </div>
          <MenuItem icon={<Camera size={14} />} onClick={() => fileRef.current?.click()}>
            {user.avatarUrl ? "Сменить фото" : "Загрузить фото"}
          </MenuItem>
          <MenuItem
            icon={<KeyRound size={14} />}
            onClick={() => {
              setOpen(false);
              onChangePassword();
            }}
          >
            Сменить пароль
          </MenuItem>
          {/* ⚠️ Полоса-напоминание про вход по коду раньше висела НАВЕРХУ КАЖДОЙ
              страницы и съедала первый экран. Напоминание осталось, но живёт
              там, где дело и делается: точка на аватарке + подсвеченный пункт
              здесь. */}
          <MenuItem
            icon={<ShieldCheck size={14} />}
            onClick={() => {
              setOpen(false);
              onTwoFactor();
            }}
            accent={user.twoFactorPending}
          >
            {user.totpEnabled
              ? "Вход по коду ✓"
              : user.twoFactorPending
                ? "Включить вход по коду"
                : "Вход по коду"}
          </MenuItem>
          {/* ⚠️ Ссылка «что делать при утечке» переехала сюда из низа меню, где
              она накладывалась на правовые ссылки. Доступна по-прежнему всем
              ролям — меню профиля есть у каждого. */}
          <MenuItem icon={<AlertTriangle size={14} />} href="/incident" onClick={() => setOpen(false)}>
            Данные могли утечь
          </MenuItem>
          <MenuItem icon={<LogOut size={14} />} onClick={logout} danger>
            Выйти
          </MenuItem>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadAvatar(f);
        }}
      />
    </div>
  );
}

function MenuItem({
  icon,
  onClick,
  children,
  danger,
  accent,
  href,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  /** Незакрытое дело — пункт подсвечивается фирменным жёлтым. */
  accent?: boolean;
  /** Пункт-ссылка (переход на страницу), а не действие. */
  href?: string;
}) {
  const cls = `flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-ink-800 ${
    danger ? "text-red-300" : accent ? "bg-brand/10 font-medium text-brand" : "text-ink-200"
  }`;
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={cls}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      {icon}
      {children}
    </button>
  );
}
