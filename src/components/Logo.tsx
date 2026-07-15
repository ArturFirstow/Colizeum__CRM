// Логотип Colizeum Agency.
// Фирменный знак по брендбуку: жёлтый круг-«маска» с глазами X и O.

export function XoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <clipPath id="xo-face">
          <circle cx="24" cy="24" r="22.5" />
        </clipPath>
      </defs>

      {/* жёлтое «лицо» */}
      <circle cx="24" cy="24" r="22.5" fill="#FCDF3B" stroke="#141414" strokeWidth="1.4" />

      {/* широкая тёмная маска-полоса + маленький «нос»-треугольник по центру */}
      <g clipPath="url(#xo-face)">
        <rect x="0" y="14.6" width="48" height="16.2" fill="#1A1A1A" />
        <path d="M21 30.8 L27 30.8 L24 34 Z" fill="#1A1A1A" />
      </g>

      {/* левый глаз — X (у левого края маски) */}
      <path
        d="M11 19.2 L18 26.2 M18 19.2 L11 26.2"
        stroke="#FFFFFF"
        strokeWidth="2.7"
        strokeLinecap="round"
      />
      {/* правый глаз — O (правее центра, широкий зазор) */}
      <circle cx="35" cy="22.7" r="5" fill="none" stroke="#FFFFFF" strokeWidth="2.7" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <XoMark className="h-9 w-9" />
      {!compact && (
        <div className="leading-none">
          <div className="font-display text-[17px] font-bold uppercase tracking-[0.13em] text-ink-50">
            Colizeum
          </div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.36em] text-brand">
            Agency
          </div>
        </div>
      )}
    </div>
  );
}
