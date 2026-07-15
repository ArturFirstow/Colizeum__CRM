"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XoMark } from "@/components/Logo";
import { apiFetch } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@colizeum.ru");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* фоновые декоративные ХО */}
      <div className="pointer-events-none absolute inset-0 select-none opacity-[0.04]">
        <div className="absolute -left-10 top-10 text-[220px] font-black leading-none text-brand">
          ХО
        </div>
        <div className="absolute bottom-0 right-0 text-[220px] font-black leading-none text-brand">
          ХО
        </div>
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <XoMark className="h-16 w-16" />
          <h1 className="mt-5 text-2xl font-extrabold uppercase tracking-tight text-ink-50">
            Colizeum Workspace
          </h1>
          <p className="mt-1.5 text-sm text-ink-400">
            Приватный сервис менеджера рекламных проектов
          </p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-7">
          <div>
            <label className="label" htmlFor="email">
              Логин (e-mail)
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@colizeum.ru"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary w-full py-2.5" disabled={loading}>
            {loading ? "Вход…" : "Войти"}
          </button>

          <div className="rounded-xl border border-ink-700/60 bg-ink-900/60 px-3.5 py-3 text-xs text-ink-400">
            <div className="mb-1 font-semibold text-ink-300">Демо-доступ</div>
            <div>owner@colizeum.ru · manager@colizeum.ru</div>
            <div>пароль: <span className="font-mono text-brand-200">colizeum</span></div>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-ink-500">
          Регистрация закрыта. Доступ только у заведённых аккаунтов.
        </p>
      </div>
    </div>
  );
}
