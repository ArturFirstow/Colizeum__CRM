// Небольшие презентационные примитивы (server-safe).
import Link from "next/link";
import { stageStyle, taskStatusStyle, urgencyStyle, advertiserTypeStyle } from "@/lib/ui-tokens";

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800/60 text-xl">
            {icon}
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-ink-50">
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink-300">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Ring({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`pill ring-1 ring-inset ${className}`}>{children}</span>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  return <Ring className={stageStyle(stage)}>{stage}</Ring>;
}

export function TaskStatusBadge({ status }: { status: string }) {
  return <Ring className={taskStatusStyle(status)}>{status}</Ring>;
}

export function UrgencyBadge({ urgency }: { urgency?: string | null }) {
  if (!urgency) return null;
  return <Ring className={urgencyStyle(urgency)}>{urgency}</Ring>;
}

export function TypeBadge({ type }: { type?: string | null }) {
  if (!type) return null;
  return <Ring className={advertiserTypeStyle(type)}>{type}</Ring>;
}

export function EmptyState({
  icon = "📭",
  title,
  hint,
  action,
  compact,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  // compact — когда «пусто» это хорошая новость (нет блокеров, нет долгов):
  // такой блок не должен занимать пол-экрана.
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-ink-700 bg-ink-900/40 px-4 py-3">
        <span className="text-lg opacity-80">{icon}</span>
        <span className="text-sm text-ink-200">{title}</span>
        {hint && <span className="text-xs text-ink-500">· {hint}</span>}
        {action && <span className="ml-auto">{action}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-700 bg-ink-900/40 px-6 py-14 text-center">
      <div className="mb-3 text-4xl opacity-80">{icon}</div>
      <div className="text-base font-semibold text-ink-100">{title}</div>
      {hint && <div className="mt-1 max-w-sm text-sm text-ink-400">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent,
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <div
      className={`card card-hover p-5 ${accent ? "!border-brand/40 !bg-brand/[0.06]" : ""}`}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</div>
      <div className={`mt-2 font-display text-3xl font-semibold ${accent ? "text-brand" : "text-ink-50"}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-ink-400">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</div>
      <div className="mt-1 text-sm text-ink-100">{children ?? "—"}</div>
    </div>
  );
}
