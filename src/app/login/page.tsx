"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { XoMark } from "@/components/Logo";
import { LEGAL_DOCS } from "@/lib/legal";
import { apiFetch } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Второй шаг входа: пароль принят, ждём код из приложения.
  const [pending, setPending] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [who, setWho] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = pending ? { pending, code } : { email, password };
      const res = await apiFetch<{ need2fa?: boolean; pending?: string; name?: string }>(
        "/api/auth/login",
        { method: "POST", body: JSON.stringify(body) },
      );
      // Включён второй фактор — показываем поле для кода и остаёмся на месте.
      if (res.need2fa && res.pending) {
        setPending(res.pending);
        setWho(res.name ?? "");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
      setLoading(false);
    }
  }

  function backToPassword() {
    setPending(null);
    setCode("");
    setError(null);
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
          <h1 className="mt-5 font-display text-3xl font-bold uppercase tracking-[0.12em] text-ink-50">
            Colizeum
          </h1>
          <div className="mt-1 text-sm font-semibold uppercase tracking-[0.42em] text-brand">
            Agency
          </div>
          <p className="mt-3 text-sm text-ink-400">
            Сервис менеджера рекламных проектов
          </p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-7">
          {pending ? (
            <>
              <div className="text-center">
                <div className="text-3xl">🔐</div>
                <h2 className="mt-2 text-lg font-bold text-ink-50">Код из приложения</h2>
                <p className="mt-1 text-sm text-ink-400">
                  {who ? `${who}, откройте` : "Откройте"} приложение-аутентификатор и введите
                  шестизначный код. Если телефона под рукой нет — введите запасной код.
                </p>
              </div>
              <div>
                <label className="label" htmlFor="code">
                  Код
                </label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  className="input text-center font-mono text-xl tracking-[0.35em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  required
                />
              </div>
            </>
          ) : (
          <>
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
              placeholder="имя@colizeum.ru"
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
          </>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary w-full py-2.5" disabled={loading}>
            {loading ? "Проверяем…" : pending ? "Подтвердить" : "Войти"}
          </button>

          {pending && (
            <button type="button" className="btn btn-ghost w-full" onClick={backToPassword}>
              ← Ввести пароль заново
            </button>
          )}
        </form>

        <p className="mt-6 text-center text-xs text-ink-500">
          Регистрация закрыта. Доступ только у заведённых аккаунтов.
        </p>

        {/* Подвал с правовыми документами — как на сайте агентства. Страницы
            открываются без входа: их нужно иметь возможность прочитать до
            того, как принимаешь условия. */}
        <footer className="mt-8 border-t border-ink-800 pt-5 text-center">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-4">
            {LEGAL_DOCS.map((d) => (
              <Link
                key={d.slug}
                href={`/legal/${d.slug}`}
                className="text-xs text-ink-500 underline-offset-4 transition hover:text-brand hover:underline"
              >
                {d.title}
              </Link>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-ink-600">
            Выполняя вход, вы принимаете условия пользовательского соглашения и подтверждаете, что
            ознакомлены с политикой обработки персональных данных.
          </p>
        </footer>
      </div>
    </div>
  );
}
