"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, FormError } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/format";
import { parseSheetUrl, validateSheetUrl } from "@/lib/sheet-url";

type Member = {
  id: string;
  name: string;
  telegramChatId?: string | null;
  avatarUrl?: string | null;
  email: string;
  role: string;
  sheetUrl: string | null;
  createdAt: string | Date;
  _count: { ownedAdvertisers: number; ownedTasks: number };
};

// Страница «Команда»: выдача доступов сотрудникам. Каждый сотрудник получает
// чистый личный кабинет со своими клиентами; общие — база знаний и календарь.
export function TeamView({ members, isAdmin, meId }: { members: Member[]; isAdmin: boolean; meId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [edit, setEdit] = useState<Member | null>(null);
  const [sheetEdit, setSheetEdit] = useState<Member | null>(null);
  const [f, setF] = useState({ name: "", email: "", password: "", role: "Manager" });
  const me = members.find((m) => m.id === meId) ?? null;

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

      {/* Своя таблица учёта — у каждого своя, а не одна на всех. */}
      {me && (
        <div className="mb-5 card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-ink-50">📊 Моя таблица учёта</div>
              <p className="mt-1 text-sm text-ink-400">
                Ваша личная Google-таблица. Вставьте ссылку целиком — вместе с хвостом{" "}
                <span className="font-mono text-ink-300">?gid=…</span>, он указывает на нужный лист внизу таблицы.
              </p>
              {me.sheetUrl ? (
                <a
                  href={me.sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block max-w-full truncate text-sm text-brand hover:underline"
                >
                  {me.sheetUrl}
                </a>
              ) : (
                <p className="mt-2 text-sm text-ink-500">Пока не указана.</p>
              )}
            </div>
            <button className="btn btn-ghost btn-sm shrink-0" onClick={() => setSheetEdit(me)}>
              {me.sheetUrl ? "Изменить ссылку" : "Указать таблицу"}
            </button>
          </div>
          <p className="mt-3 border-t border-ink-800 pt-3 text-xs text-ink-500">
            Чтобы сервис мог читать таблицу, откройте у неё доступ: «Настройки доступа» → «Все, у кого есть
            ссылка» → «Читатель».
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
              <div className="flex items-center gap-1.5">
                <span className={`badge ${m.role === "Owner" || m.role === "Director" ? "badge-brand" : "badge-muted"}`}>
                  {m.role === "Owner" ? "Админ" : m.role === "Director" ? "Руководитель" : "Менеджер"}
                </span>
                {isAdmin && (
                  <button className="btn-icon h-7 w-7 text-ink-400 hover:text-brand" title="Изменить" onClick={() => setEdit(m)}>
                    ✎
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-ink-800 pt-3 text-xs text-ink-400">
              <span>☰ {m._count.ownedAdvertisers} клиентов</span>
              <span>✓ {m._count.ownedTasks} задач</span>
              <span>с {formatDate(m.createdAt)}</span>
              <span className={m.sheetUrl ? "text-emerald-300" : "text-ink-500"}>
                📊 {m.sheetUrl ? "таблица указана" : "таблицы нет"}
              </span>
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

      {edit && <EditMemberModal member={edit} onClose={() => setEdit(null)} onSaved={() => router.refresh()} />}
      {sheetEdit && (
        <SheetUrlModal member={sheetEdit} onClose={() => setSheetEdit(null)} onSaved={() => router.refresh()} />
      )}
    </div>
  );
}

// Ссылка на личную таблицу учёта. Отдельная модалка, а не поле в «Изменить
// сотрудника»: имя и роль правит только админ, а таблицу человек ставит себе сам.
function SheetUrlModal({
  member,
  onClose,
  onSaved,
}: {
  member: Member;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState(member.sheetUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateSheetUrl(url);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/api/users/${member.id}`, { method: "PATCH", body: JSON.stringify({ sheetUrl: url.trim() }) });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  const ref = parseSheetUrl(url);

  return (
    <Modal open onClose={onClose} title="Моя таблица учёта" subtitle="Google-таблица, в которой вы ведёте свои записи">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Ссылка на таблицу</label>
          <input
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
            placeholder="https://docs.google.com/spreadsheets/d/…/edit?gid=989964510"
          />
          <p className="mt-1.5 text-xs text-ink-500">
            Откройте нужный лист в таблице и скопируйте адрес прямо из строки браузера — так в ссылку попадёт
            номер листа. Пустое поле — убрать таблицу.
          </p>
        </div>
        {ref && (
          <div className="rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3 text-xs text-ink-300">
            Распознали таблицу <span className="font-mono text-ink-100">{ref.id.slice(0, 12)}…</span>, лист{" "}
            <span className="font-mono text-ink-100">gid={ref.gid}</span>
            {ref.gid === "0" && <span className="text-ink-500"> — это первый лист таблицы</span>}
          </div>
        )}
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "…" : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditMemberModal({
  member,
  onClose,
  onSaved,
}: {
  member: Member;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState(member.role);
  const [telegramChatId, setTelegramChatId] = useState(member.telegramChatId ?? "");
  const [avatarUrl, setAvatarUrl] = useState(member.avatarUrl ?? "");
  const [uploading, setUploading] = useState(false);

  // Фото кладём в общее хранилище файлов и запоминаем ссылку на него.
  async function uploadAvatar(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("ownerType", "avatar");
      form.append("ownerId", member.id);
      form.append("kind", "Фото");
      const res = await fetch("/api/files", { method: "POST", body: form });
      const json = (await res.json()) as { data?: { id: string } };
      if (json.data?.id) setAvatarUrl(`/api/files/${json.data.id}`);
    } finally {
      setUploading(false);
    }
  }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/api/users/${member.id}`, { method: "PATCH", body: JSON.stringify({ name, role, telegramChatId, avatarUrl }) });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Изменить сотрудника" subtitle={member.email}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Имя</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="label">Роль</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="Manager">Менеджер — ведёт своих клиентов</option>
            <option value="Director">Руководитель — видит весь отдел + бюджет</option>
            <option value="Owner">Админ — управление доступами</option>
          </select>
        </div>
        <div>
          <label className="label">Фото</label>
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-800 text-sm text-ink-500">
                нет
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              className="text-xs text-ink-400"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
              }}
            />
            {avatarUrl && (
              <button type="button" className="text-xs text-ink-500 hover:text-red-300" onClick={() => setAvatarUrl("")}>
                убрать
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-500">
            Фото руководителя показывается на кнопке «Саша, окни пожалуйста».
          </p>
        </div>
        <div>
          <label className="label">Telegram для уведомлений</label>
          <input
            className="input"
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
            placeholder="chat id, например 123456789"
          />
          <p className="mt-1 text-xs text-ink-500">
            Сотрудник пишет боту «/start», после чего его chat id покажет команда
            npx tsx scripts/telegram-chats.ts. Пусто — уведомления не приходят.
          </p>
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "…" : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
