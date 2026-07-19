"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";

// Универсальная кнопка удаления с подтверждением.
// endpoint — DELETE-роут; redirectTo — куда уйти после (для detail-страниц),
// иначе просто router.refresh().
export function DeleteButton({
  endpoint,
  what,
  redirectTo,
  variant = "icon",
  className,
}: {
  endpoint: string;
  what: string; // что удаляем (для текста подтверждения)
  redirectTo?: string;
  variant?: "icon" | "button" | "text";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(endpoint, { method: "DELETE" });
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить");
    } finally {
      setBusy(false);
    }
  }

  // Корзина считывается сразу: красный акцент уже в покое, ярче — при наведении (ТЗ р.2, п.0).
  const trigger =
    variant === "icon" ? (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title="Удалить"
        aria-label="Удалить"
        className={
          className ??
          "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 transition hover:border-red-500/60 hover:bg-red-500/20 hover:text-red-300"
        }
      >
        <Trash2 size={15} strokeWidth={2.2} />
      </button>
    ) : variant === "text" ? (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={className ?? "inline-flex items-center gap-1 text-xs font-medium text-red-400 transition hover:text-red-300"}
      >
        <Trash2 size={13} strokeWidth={2.2} /> Удалить
      </button>
    ) : (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={className ?? "btn btn-danger btn-sm"}
      >
        <Trash2 size={14} strokeWidth={2.2} /> Удалить
      </button>
    );

  return (
    <>
      {trigger}
      <Modal open={open} onClose={() => setOpen(false)} title="Удалить?" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-ink-200">
            Удалить {what}? Это действие нельзя отменить.
          </p>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
              Отмена
            </button>
            <button className="btn btn-danger" onClick={confirmDelete} disabled={busy}>
              {busy ? "Удаление…" : "Удалить"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
