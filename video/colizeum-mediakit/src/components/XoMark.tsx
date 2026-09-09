/** Знак «ХО» — жёлтая маска. */
export const XoMark: React.FC<{ size: number; face?: string }> = ({
  size,
  face = "#F1E27B",
}) => (
  <svg viewBox="0 0 48 48" style={{ width: size, height: size }}>
    <defs>
      <clipPath id="xo-face">
        <circle cx="24" cy="24" r="22.5" />
      </clipPath>
    </defs>
    <circle cx="24" cy="24" r="22.5" fill={face} />
    <g clipPath="url(#xo-face)">
      <path d="M0 14.6 H48 V30.8 H27 L24 27.9 L21 30.8 H0 Z" fill="#000000" />
    </g>
    <path
      d="M11 19.2 L18 26.2 M18 19.2 L11 26.2"
      stroke="#FFFFFF"
      strokeWidth="2.7"
      strokeLinecap="round"
    />
    <circle cx="35" cy="22.7" r="5" fill="none" stroke="#FFFFFF" strokeWidth="2.7" />
  </svg>
);
