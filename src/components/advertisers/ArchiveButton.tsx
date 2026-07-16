"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";

// «Удаление» карточек = перемещение в Архив (v2, п.1.2). Возврат — одним действием.
export function ArchiveButton({
  advertiserId,
  archived,
}: {
  advertiserId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await apiFetch(`/api/advertisers/${advertiserId}`, {
        method: "PATCH",
        body: JSON.stringify({ archived: !archived }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn btn-ghost btn-sm" onClick={toggle} disabled={busy}>
      {busy ? "…" : archived ? "↩ Вернуть из архива" : "🗄 В архив"}
    </button>
  );
}
