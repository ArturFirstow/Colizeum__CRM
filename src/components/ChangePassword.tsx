"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Modal, FormError } from "@/components/ui/Modal";

// Смена собственного пароля. Нужна, чтобы выданный при заведении пароль не жил
// вечно: сотрудник заходит первый раз и сразу ставит свой.
export function ChangePassword({
  userId,
  hideTrigger,
  openSignal,
}: {
  userId: string;
  /** Кнопку рисует кто-то другой (например, меню профиля). */
  hideTrigger?: boolean;
  /** Меняется — открываем окно. Позволяет вызывать окно снаружи. */
  openSignal?: number;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function reset() {
    setCurrent("");
    setNext("");
    setRepeat("");
    setError(null);
    setDone(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== repeat) {
      setError("Новый пароль и повтор не совпадают");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/users/${userId}/password`, {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setDone(true);
      setCurrent("");
      setNext("");
      setRepeat("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сменить пароль");
    } finally {
      setBusy(false);
    }
  }

  // Внешний вызов: меню профиля увеличивает openSignal — открываем окно.
  useEffect(() => {
    if (openSignal && openSignal > 0) {
      reset();
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  return (
    <>
      {!hideTrigger && (
        <button
          onClick={() => {
            reset();
            setOpen(true);
          }}
          title="Сменить пароль"
          aria-label="Сменить пароль"
          className="btn-icon"
        >
          <KeyRound size={15} />
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Смена пароля"
        subtitle="Придумайте пароль, который знаете только вы"
      >
        {done ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-200">
              Пароль изменён. В следующий раз входите с новым — старый больше не работает.
            </p>
            <button className="btn btn-primary" onClick={() => setOpen(false)}>
              Понятно
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="label">Текущий пароль</span>
              <input
                className="input"
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            <label className="block">
              <span className="label">Новый пароль</span>
              <input
                className="input"
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="минимум 8 символов"
              />
            </label>
            <label className="block">
              <span className="label">Новый пароль ещё раз</span>
              <input
                className="input"
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            {error && <FormError message={error} />}
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Меняю…" : "Сменить пароль"}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
