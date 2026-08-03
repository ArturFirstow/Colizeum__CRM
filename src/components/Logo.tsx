// Логотип Colizeum Agency.
// Фирменный знак по брендбуку: жёлтый круг в толстом тёмном контуре,
// широкая тёмная маска-полоса с глазами X и O, снизу по центру полосы —
// жёлтый вырез-«нос» (пик вверх).

export function XoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <clipPath id="xo-face">
          <circle cx="24" cy="24" r="21" />
        </clipPath>
      </defs>

      {/* жёлтое «лицо» */}
      <circle cx="24" cy="24" r="21" fill="#FCDF3B" />

      {/* маска-полоса во всю ширину; жёлтый пик-«нос» вырезан из её нижнего края */}
      <g clipPath="url(#xo-face)">
        <path d="M0 16.4 H48 V31.6 H27 L24 28.5 L21 31.6 H0 Z" fill="#161616" />
      </g>

      {/* толстый тёмный контур поверх, чтобы полоса уходила под него */}
      <circle cx="24" cy="24" r="21" fill="none" stroke="#161616" strokeWidth="3.2" />

      {/* левый глаз — X (чуть наклонён, как в знаке) */}
      <g transform="rotate(8 15 24)">
        <path d="M10.8 19.8 L19.2 28.2 M19.2 19.8 L10.8 28.2" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      </g>
      {/* правый глаз — O */}
      <circle cx="33.2" cy="24" r="3.9" fill="none" stroke="#FFFFFF" strokeWidth="3" />
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
