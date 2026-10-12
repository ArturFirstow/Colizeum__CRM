"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";

// Контекст по клиенту на неделю: «где мы сейчас». В прежнем задачнике это был
// абзац перед списком пунктов — без него список читается как набор строк.
// Пустое поле стирает заметку.
export function WorksheetNote({
  weekStart,
  advertiserId,
  text,
  placeholder,
}: {
  weekStart: string;
  advertiserId?: string;
  text: string | null;
  placeholder: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(text ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/worksheet/note", {
        method: "PUT",
        body: JSON.stringify({ weekStart, advertiserId, text: value }),
      });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div
        className="group cursor-text rounded-xl border border-dashed border-ink-800 px-3 py-2 text-sm text-ink-300 hover:border-ink-700"
        onClick={() => setOpen(true)}
        title="Нажмите, чтобы изменить"
      >
        {text ? (
          <span className="whitespace-pre-wrap">{text}</span>
        ) : (
          <span className="text-ink-500">{placeholder}</span>
        )}
      </div>
    );
  }

  return (
    <div>
      <textarea
        className="input min-h-[90px] text-sm"
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
      />
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      <div className="mt-2 flex items-center gap-2">
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setValue(text ?? "");
            setOpen(false);
          }}
        >
          Отмена
        </button>
        <span className="text-xs text-ink-500">пустое поле удалит заметку</span>
      </div>
    </div>
  );
}
