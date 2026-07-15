// Логотип Colizeum: мотив «ХО» (X + O) в брендовых чёрном и жёлтом.

export function XoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="0.5" y="0.5" width="39" height="39" rx="11" fill="#FFDD00" />
      {/* X */}
      <path
        d="M8 8 L17 17 M17 8 L8 17"
        stroke="#0B0B0D"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* O */}
      <circle cx="27.5" cy="12.5" r="5" stroke="#0B0B0D" strokeWidth="2.6" fill="none" />
      {/* нижняя «X» контурная — фирменная сетка */}
      <path
        d="M9 24 L31 24 M9 31 L31 31"
        stroke="#0B0B0D"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <XoMark />
      {!compact && (
        <div className="leading-none">
          <div className="text-[15px] font-extrabold uppercase tracking-tight text-ink-50">
            Colizeum
          </div>
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-brand">
            Workspace
          </div>
        </div>
      )}
    </div>
  );
}
