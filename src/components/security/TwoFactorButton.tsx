"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Подключение второго фактора (требование 5.1).
//
// Три экрана подряд: QR-код → подтверждение кодом → запасные коды.
// Запасные коды показываются ОДИН раз: в базе лежат только их хэши, как у
// паролей. Без них единственный администратор, потерявший телефон, окажется
// заперт снаружи собственного сервиса.
// ─────────────────────────────────────────────────────────────────────────────

type Step = "intro" | "scan" | "codes";

/** Окно второго фактора без своей кнопки: открывается из меню профиля —
 *  так же, как смена пароля (openSignal меняется, окно появляется). */
export function TwoFactorPanel({
  userId,
  enabled,
  openSignal,
}: {
  userId: string;
  enabled: boolean;
  openSignal: number;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);

  if (!open) return null;
  return <TwoFactorModal userId={userId} enabled={enabled} onClose={() => setOpen(false)} />;
}

function TwoFactorModal({
  userId,
  enabled,
  onClose,
}: {
  userId: string;
  enabled: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recovery, setRecovery] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ secret: string; qr: string }>(`/api/users/${userId}/totp`, {
        method: "POST",
      });
      setSecret(r.secret);
      setQr(r.qr);
      setStep("scan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ recoveryCodes: string[] }>(`/api/users/${userId}/totp`, {
        method: "PUT",
        body: JSON.stringify({ code }),
      });
      setRecovery(r.recoveryCodes);
      setStep("codes");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/users/${userId}/totp`, {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setBusy(false);
    }
  }

  function copyCodes() {
    navigator.clipboard.writeText(recovery.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // ── Уже включён: предлагаем только отключить ──────────────────────────────
  if (enabled && step === "intro") {
    return (
      <Modal open onClose={onClose} title="Вход по коду включён" subtitle="Второй фактор защищает ваш доступ">
        <form onSubmit={disable} className="space-y-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            При входе сервис спрашивает код из приложения. Даже зная пароль, войти без вашего
            телефона не получится.
          </div>
          <p className="text-sm text-ink-400">
            Отключать стоит только если меняете телефон — тогда сразу подключите заново.
          </p>
          <div>
            <label className="label">Пароль — чтобы подтвердить, что это вы</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <FormError message={error} />
          <div className="flex justify-between gap-2">
            <button type="submit" className="btn btn-ghost text-red-300" disabled={busy}>
              {busy ? "…" : "Отключить"}
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Оставить включённым
            </button>
          </div>
        </form>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={step === "codes" ? () => { router.refresh(); onClose(); } : onClose}
      title="Вход по коду"
      subtitle="Второй фактор: пароль плюс код из приложения на телефоне"
      size="lg"
    >
      {step === "intro" && (
        <div className="space-y-4">
          <p className="text-sm text-ink-300">
            Понадобится приложение-аутентификатор на телефоне: Яндекс Ключ, Google Authenticator,
            1Password — любое. Оно показывает шестизначный код, который меняется каждые полминуты.
          </p>
          <div className="rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3 text-sm text-ink-400">
            Код считается из общего секрета и текущего времени — по сети он не передаётся.
            Поэтому перехватить его нельзя, а подобрать за полминуты невозможно.
          </div>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={onClose}>
              Отмена
            </button>
            <button className="btn btn-primary" onClick={start} disabled={busy}>
              {busy ? "…" : "Начать настройку"}
            </button>
          </div>
        </div>
      )}

      {step === "scan" && (
        <form onSubmit={confirm} className="space-y-4">
          <p className="text-sm text-ink-300">
            Откройте приложение, нажмите «добавить» и наведите камеру на этот квадрат.
          </p>
          <div className="flex justify-center">
            {qr && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={qr} alt="QR-код для приложения-аутентификатора" className="rounded-xl bg-white p-2" />
            )}
          </div>
          <details className="rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3">
            <summary className="cursor-pointer text-sm text-ink-300">Камера не работает — ввести вручную</summary>
            <p className="mt-2 break-all font-mono text-xs text-brand">{secret}</p>
            <p className="mt-1 text-xs text-ink-500">
              В приложении выберите «ввести ключ вручную» и вставьте эту строку.
            </p>
          </details>
          <div>
            <label className="label">Код из приложения *</label>
            <input
              className="input text-center font-mono text-xl tracking-[0.35em]"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              autoFocus
              required
            />
            <p className="mt-1 text-xs text-ink-500">
              Так сервис убедится, что приложение настроено верно, — иначе вы могли бы остаться без входа.
            </p>
          </div>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Проверяем…" : "Включить"}
            </button>
          </div>
        </form>
      )}

      {step === "codes" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            ✅ Готово. Теперь при входе сервис спросит код.
          </div>
          <div>
            <h3 className="mb-1 font-semibold text-ink-50">Запасные коды — сохраните сейчас</h3>
            <p className="mb-3 text-sm text-ink-400">
              Каждый работает один раз и заменяет код из приложения. Нужны, если телефон потерян
              или сломан. <b className="text-ink-200">Второй раз они не покажутся</b> — в сервисе
              хранятся только их отпечатки.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-ink-800 bg-ink-900/50 p-4 font-mono text-sm text-ink-100">
              {recovery.map((c) => (
                <div key={c}>{c}</div>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm mt-3" onClick={copyCodes}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Скопировано" : "Копировать коды"}
            </button>
          </div>
          <div className="flex justify-end">
            <button
              className="btn btn-primary"
              onClick={() => {
                router.refresh();
                onClose();
              }}
            >
              Я сохранил коды
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
