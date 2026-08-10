"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check } from "lucide-react";
import { apiFetch } from "@/lib/client";

// Блокер = флажок + комментарий. Пока флажок снят, сделка нигде не считается
// заблокированной, даже если текст остался как история.
export function BlockerToggle({
  dealId,
  blocker,
  blockerActive,
}: {
  dealId: string;
  blocker: string | null;
  blockerActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(blocker ?? "");

  async function save(active: boolean, comment: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({ blockerActive: active, blocker: comment.trim() }),
      });
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // Блокер поднят — красная карточка с кнопкой «Снять блокер».
  if (blockerActive && !editing) {
    return (
      <div className={`card p-4 !border-red-500/40 ${busy ? "opacity-50" : ""}`}>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-300">⛔ Блокер</div>
        <p className="text-sm text-red-100">{blocker || "Причина не указана"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => save(false, text)}>
            <Check size={14} /> Снять блокер
          </button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setEditing(true)}>
            Изменить причину
          </button>
        </div>
      </div>
    );
  }

  // Режим ввода причины.
  if (editing) {
    return (
      <div className="card p-4 !border-red-500/30">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-300">⛔ Блокер</div>
        <textarea
          className="input min-h-[64px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Что именно мешает двигаться"
          autoFocus
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => save(true, text)}>
            Поставить блокер
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => {
              setText(blocker ?? "");
              setEditing(false);
            }}
          >
            Отмена
          </button>
        </div>
      </div>
    );
  }

  // Блокера нет — неброская кнопка, чтобы поднять флажок.
  return (
    <button
      className="card flex items-center justify-center gap-2 p-4 text-sm text-ink-500 transition hover:!border-red-500/40 hover:text-red-300"
      onClick={() => setEditing(true)}
    >
      <Ban size={15} /> Отметить блокер
    </button>
  );
}
