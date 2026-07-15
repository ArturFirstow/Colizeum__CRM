"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "checkbox" | "textarea";
  options?: readonly string[];
  placeholder?: string;
  required?: boolean;
  default?: string | boolean;
  half?: boolean;
};

// Универсальная кнопка + модалка «добавить запись» по описанию полей.
export function QuickAdd({
  label,
  title,
  subtitle,
  endpoint,
  fields,
  buttonClass = "btn btn-ghost btn-sm",
}: {
  label: string;
  title: string;
  subtitle?: string;
  endpoint: string;
  fields: FieldDef[];
  buttonClass?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initial = () =>
    Object.fromEntries(
      fields.map((f) => [f.name, f.default ?? (f.type === "checkbox" ? false : f.type === "select" ? f.options?.[0] ?? "" : "")]),
    ) as Record<string, string | boolean>;
  const [values, setValues] = useState<Record<string, string | boolean>>(initial);

  function set(name: string, v: string | boolean) {
    setValues((s) => ({ ...s, [name]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of fields) {
        const raw = values[f.name];
        if (f.type === "number") {
          if (raw !== "" && raw != null) payload[f.name] = Number(raw);
        } else if (f.type === "checkbox") {
          payload[f.name] = !!raw;
        } else if (raw !== "") {
          payload[f.name] = raw;
        }
      }
      await apiFetch(endpoint, { method: "POST", body: JSON.stringify(payload) });
      setOpen(false);
      setValues(initial());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className={buttonClass} onClick={() => setOpen(true)}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} subtitle={subtitle}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.name} className={f.half ? "" : "sm:col-span-2"}>
                {f.type === "checkbox" ? (
                  <label className="flex items-center gap-2 text-sm text-ink-200">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand"
                      checked={!!values[f.name]}
                      onChange={(e) => set(f.name, e.target.checked)}
                    />
                    {f.label}
                  </label>
                ) : (
                  <>
                    <label className="label">
                      {f.label}
                      {f.required && " *"}
                    </label>
                    {f.type === "select" ? (
                      <select className="input" value={String(values[f.name])} onChange={(e) => set(f.name, e.target.value)}>
                        {f.options?.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : f.type === "textarea" ? (
                      <textarea
                        className="input"
                        value={String(values[f.name])}
                        onChange={(e) => set(f.name, e.target.value)}
                        placeholder={f.placeholder}
                      />
                    ) : (
                      <input
                        className="input"
                        type={f.type === "number" ? "number" : "text"}
                        value={String(values[f.name])}
                        onChange={(e) => set(f.name, e.target.value)}
                        placeholder={f.placeholder}
                        required={f.required}
                      />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "…" : "Добавить"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
