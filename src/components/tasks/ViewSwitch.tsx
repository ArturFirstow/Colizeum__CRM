import Link from "next/link";

// Переключатель вида в «Задачах». Список задач ОДИН, видов два, потому что
// в течение дня спрашивают «на чьей стороне мяч», а раз в неделю — «что по
// клиенту сделано, что делаем, что дальше». Раньше это были два раздела меню
// по одному и тому же списку.

export function ViewSwitch({ view }: { view: "board" | "clients" }) {
  const base =
    "rounded-lg px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60";
  const on = "bg-brand text-ink-950";
  const off = "text-ink-300 hover:bg-ink-800 hover:text-ink-100";

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-ink-700 bg-ink-900/60 p-1">
      <Link
        href="/tasks"
        className={`${base} ${view === "board" ? on : off}`}
        title="Доска: на чьей стороне сейчас работа"
      >
        Доска
      </Link>
      <Link
        href="/tasks?view=clients"
        className={`${base} ${view === "clients" ? on : off}`}
        title="Недельная сверка по клиентам: сделано / делаем / дальше"
      >
        По клиентам
      </Link>
    </div>
  );
}
