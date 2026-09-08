import { interpolate, useCurrentFrame } from "remotion";

/**
 * Отрисованная подвеска-брелок в виде ключа.
 * Это временная графика: как только будут фотографии товара, положите их
 * в public/ и передайте имя файла в проп photoSrc — SVG заменится на фото.
 */
export const KeyPendant: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <svg
      viewBox="0 0 360 900"
      style={{ width: 360, height: 900, overflow: "visible" }}
    >
      <defs>
        {/* Металл: серебро с несколькими переломами света */}
        <linearGradient
          id="silver"
          gradientUnits="userSpaceOnUse"
          x1="40"
          y1="40"
          x2="330"
          y2="820"
        >
          <stop offset="0" stopColor="#5E5F67" />
          <stop offset="0.1" stopColor="#B9BCC5" />
          <stop offset="0.22" stopColor="#FBFCFE" />
          <stop offset="0.34" stopColor="#8D909A" />
          <stop offset="0.48" stopColor="#EDEFF4" />
          <stop offset="0.62" stopColor="#71737C" />
          <stop offset="0.76" stopColor="#DCDFE6" />
          <stop offset="0.9" stopColor="#7E7F88" />
          <stop offset="1" stopColor="#C2C5CD" />
        </linearGradient>

        {/* Верхняя подсветка — грани смотрят на источник света */}
        <linearGradient
          id="topLight"
          gradientUnits="userSpaceOnUse"
          x1="60"
          y1="0"
          x2="300"
          y2="900"
        >
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
          <stop offset="0.35" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        {/* Бегущий блик */}
        <linearGradient
          id="shine"
          gradientUnits="userSpaceOnUse"
          x1={interpolate(frame, [0, 600], [-780, 1180])}
          y1="0"
          x2={interpolate(frame, [0, 600], [-460, 1500])}
          y2="900"
        >
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.44" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="0.56" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        <filter id="glow" x="-70%" y="-25%" width="240%" height="150%">
          <feGaussianBlur stdDeviation="22" />
        </filter>

        <filter id="softShadow" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="18" />
        </filter>

        {/* Силуэт ключа — рисуем один раз, дальше переиспользуем */}
        <g id="keyShapes">
          {/* заводное кольцо */}
          <path d="M180 10a46 46 0 1 0 0.1 0zm0 19a27 27 0 1 1-0.1 0z" />
          {/* перемычка */}
          <rect x="170" y="96" width="20" height="44" rx="9" />
          {/* головка ключа */}
          <path d="M180 130a116 116 0 1 0 0.1 0zm0 52a64 64 0 1 1-0.1 0z" />
          {/* стержень */}
          <rect x="166" y="352" width="28" height="478" rx="13" />
          {/* бородка */}
          <rect x="188" y="688" width="66" height="32" rx="9" />
          <rect x="188" y="754" width="48" height="30" rx="9" />
        </g>
      </defs>

      {/* тень на «подложке» */}
      <ellipse
        cx="180"
        cy="872"
        rx="118"
        ry="14"
        fill="#000000"
        opacity="0.55"
        filter="url(#softShadow)"
      />

      {/* тёплое свечение позади металла */}
      <use href="#keyShapes" fill="#EFE8D8" opacity="0.3" filter="url(#glow)" />

      {/* металл */}
      <use href="#keyShapes" fill="url(#silver)" />

      {/* подсветка верхних граней */}
      <use href="#keyShapes" fill="url(#topLight)" />

      {/* тёмная окантовка — даёт объём */}
      <use
        href="#keyShapes"
        fill="none"
        stroke="#26272C"
        strokeWidth="2.5"
        opacity="0.55"
      />

      {/* бегущий блик */}
      <use
        href="#keyShapes"
        fill="url(#shine)"
        style={{ mixBlendMode: "screen" }}
      />

      {/* тонкая гравированная линия по головке */}
      <circle
        cx="180"
        cy="246"
        r="92"
        fill="none"
        stroke="#2E2F35"
        strokeWidth="1.6"
        opacity={interpolate(frame, [40, 90], [0, 0.4], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
      />
    </svg>
  );
};
