"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/format";

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string | Date;
  _count: { ownedAdvertisers: number; ownedTasks: number };
};

// Страница «Команда»: выдача доступов сотрудникам. Каждый сотрудник получает
// чистый личный кабинет со своими клиентами; общие — база знаний и календарь.
export function TeamView({ members, isAdmin }: { members: Member[]; isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [f, setF] = useState({ name: "", email: "", password: "", role: "Manager" });

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/users", { method: "POST", body: JSON.stringify(f) });
      setCreated({ email: f.email, password: f.password });
      setF({ name: "", email: "", password: "", role: "Manager" });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Выданные доступы: показываем один раз, чтобы переслать сотруднику */}
      {created && (
        <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-emerald-200">✅ Доступы созданы — перешлите сотруднику</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setCreated(null)}>
              Скрыть
            </button>
          </div>
          <div className="font-mono text-sm text-ink-100">
            логин: {created.email}
            <br />
            пароль: {created.password}
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Пароль больше нигде не показывается — сохраните его сейчас.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {members.map((m) => (
          <div key={m.id} className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-ink-50">{m.name}</div>
                <div className="mt-0.5 text-sm text-ink-400">{m.email}</div>
              </div>
              <span className={`badge ${m.role === "Owner" || m.role === "Director" ? "badge-brand" : "badge-muted"}`}>
                {m.role === "Owner" ? "Админ" : m.role === "Director" ? "Руководитель" : "Менеджер"}
              </span>
            </div>
            <div className="mt-3 flex gap-4 border-t border-ink-800 pt-3 text-xs text-ink-400">
              <span>☰ {m._count.ownedAdvertisers} клиентов</span>
              <span>✓ {m._count.ownedTasks} задач</span>
              <span>с {formatDate(m.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="mt-5">
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            + Выдать доступ сотруднику
          </button>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Новый сотрудник" subtitle="Чистый личный кабинет: свои клиенты, общие база знаний и календарь">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Имя *</label>
            <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} required autoFocus placeholder="Иван Петров" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">E-mail (логин) *</label>
              <input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} required placeholder="ivan@colizeum.ru" />
            </div>
            <div>
              <label className="label">Пароль *</label>
              <input className="input" value={f.password} onChange={(e) => set("password", e.target.value)} required minLength={6} placeholder="минимум 6 символов" />
            </div>
          </div>
          <div>
            <label className="label">Роль</label>
            <select className="input" value={f.role} onChange={(e) => set("role", e.target.value)}>
              <option value="Manager">Менеджер — ведёт своих клиентов</option>
              <option value="Director">Руководитель — видит весь отдел + бюджет</option>
            </select>
          </div>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "…" : "Создать доступ"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
