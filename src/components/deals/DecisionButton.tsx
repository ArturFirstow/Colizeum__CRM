"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";

export function DecisionButton({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function accept() {
    setLoading(true);
    try {
      await apiFetch(`/api/deals/${dealId}/decision`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={accept} disabled={loading} className="btn btn-primary btn-sm">
      {loading ? "…" : "Решение принято"}
    </button>
  );
}
