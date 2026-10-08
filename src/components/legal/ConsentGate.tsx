"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/client";

// ─────────────────────────────────────────────────────────────────────────────
// Принятие правовых документов при первом входе (требования 4.2 и 5.8).
//
// Требование прямо просит: согласие — ОТДЕЛЬНАЯ галочка, не «зашитая» в текст
// соглашения, и она НЕ должна быть отмечена заранее. Поэтому галочек столько
// же, сколько документов, все пустые, и кнопка не работает, пока не отмечены
// все.
//
// Экран перекрывает работу: пока не принято — сервисом не пользуются. Это
// не каприз интерфейса, это условие законности обработки.
// ─────────────────────────────────────────────────────────────────────────────

type Doc = { slug: string; title: string; version: string; updated: string };

export function ConsentGate({ docs }: { docs: Doc[] }) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = docs.every((d) => checked[d.slug]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/consent", {
        method: "POST",
        body: JSON.stringify({ slugs: docs.map((d) => d.slug) }),
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink-950/95 p-4">
      <div className="card w-full max-w-xl p-7">
        <h1 className="text-xl font-bold text-ink-50">Прежде чем начать</h1>
        <p className="mt-2 text-sm text-ink-300">
          {docs.length === 1
            ? "Документ обновился — его нужно прочитать и принять заново."
            : "Это служебный сервис с персональными данными. Ознакомьтесь с документами и подтвердите согласие — без этого работать с сервисом нельзя."}
        </p>

        <div className="mt-5 space-y-2">
          {docs.map((d) => (
            <label
              key={d.slug}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3 transition hover:border-ink-600"
            >
              <input
                type="checkbox"
                className="mt-1 shrink-0"
                checked={!!checked[d.slug]}
                onChange={(e) => setChecked((s) => ({ ...s, [d.slug]: e.target.checked }))}
              />
              <span className="min-w-0 text-sm">
                <span className="text-ink-100">Я прочитал и принимаю </span>
                <Link
                  href={`/legal/${d.slug}`}
                  target="_blank"
                  className="text-brand underline underline-offset-2"
                >
                  {d.title.toLowerCase()}
                </Link>
                <span className="mt-0.5 block text-xs text-ink-500">
                  редакция от {d.updated} · версия {d.version}
                </span>
              </span>
            </label>
          ))}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <p className="mt-4 text-xs text-ink-500">
          Дата, время и версия каждого документа сохраняются — это подтверждение того,
          что именно вы приняли и когда.
        </p>

        <button
          className="btn btn-primary mt-5 w-full py-2.5"
          disabled={!allChecked || busy}
          onClick={submit}
        >
          {busy ? "Сохраняем…" : allChecked ? "Принять и продолжить" : "Отметьте все пункты"}
        </button>
      </div>
    </div>
  );
}
