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

  // ⚠️ Корзина БОЛЬШЕ НЕ КРАСНАЯ В ПОКОЕ. Прежний вид (красная рамка + красная
  // заливка) делал удаление самым ярким элементом каждого списка: на доске
  // задач корзина читалась громче названия задачи. Удаление нужно — материалы
  // устаревают, данные вносят с ошибкой, — но это не главное действие строки.
  //
  // Правило на весь сервис: в покое — нейтральная серая иконка, красной она
  // становится ТОЛЬКО под курсором (и при фокусе с клавиатуры), то есть ровно
  // в тот момент, когда человек на неё нацелился. Кнопка при этом видна всегда:
  // прятать её до наведения уже пробовали — невидимую кнопку не находят.
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
          "inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition hover:bg-red-500/10 hover:text-red-400 focus-visible:bg-red-500/10 focus-visible:text-red-400"
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
        className={className ?? "inline-flex items-center gap-1.5 text-sm font-medium text-red-400 transition hover:text-red-300"}
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
      <Modal open={open} onClose={() => setOpen(false)} title={`Удалить ${what}?`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-ink-300">
            Запись исчезнет из сервиса. Отменить это нельзя — если сомневаетесь, лучше закройте
            окно.
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
