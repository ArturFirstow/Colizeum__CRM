import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, EASE, EASE_OUT } from "./theme";
import { display, text } from "./fonts";

/** Появление: сдвиг вверх + проявление. База всей анимации ролика. */
export function rise(frame: number, start: number, dur = 18, shift = 34) {
  const p = interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  return { opacity: p, transform: `translateY(${(1 - p) * shift}px)` };
}

/**
 * Снимок экрана сервиса.
 *
 * ⚠️ Медленный наезд (push-in) обязателен: статичный скриншот на 8 секунд
 * читается как картинка в презентации, а не как живой продукт. Наезд всего
 * 4 % — больше начинает мылить интерфейс.
 */
export function Shot({
  src,
  from,
  dur,
  zoom = 1.04,
  pan = 0,
  focus,
}: {
  src: string;
  from: number;
  dur: number;
  zoom?: number;
  /** Сдвиг по вертикали за сцену, px — «проезд» по длинной странице. */
  pan?: number;
  /** Рамка внимания: доля ширины/высоты кадра. */
  focus?: { x: number; y: number; w: number; h: number; delay?: number };
}) {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [from, from + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const inP = interpolate(frame, [from, from + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const scale = 1 + (zoom - 1) * t;

  return (
    <AbsoluteFill style={{ opacity: inP }}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale * (0.96 + 0.04 * inP)}) translateY(${-pan * t}px)`,
          transformOrigin: "center 38%",
        }}
      >
        <Img src={staticFile(`shots/${src}.png`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      {/* Лёгкая виньетка: кадр собирается к центру, края не спорят с текстом */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(130% 100% at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      {focus && <Focus {...focus} from={from + (focus.delay ?? 18)} />}
    </AbsoluteFill>
  );
}

/** Жёлтая рамка внимания + затемнение остального кадра. */
function Focus({
  x,
  y,
  w,
  h,
  from,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  from: number;
}) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [from, from + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const box = {
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    width: `${w * 100}%`,
    height: `${h * 100}%`,
  } as const;
  // ⚠️ Затемнение «всё кроме рамки» сделано огромной тенью наружу, а не
  // вырезом в слое: вырез требует canvas-режима смешивания, которого в CSS
  // нет, и в рендере он молча не сработает.
  return (
    <div
      style={{
        position: "absolute",
        ...box,
        border: `3px solid ${C.brand}`,
        borderRadius: 18,
        boxShadow: `0 0 0 9999px rgba(0,0,0,${p * 0.55}), 0 10px 40px rgba(252,223,59,.25)`,
        opacity: p,
        transform: `scale(${1 + (1 - p) * 0.04})`,
      }}
    />
  );
}

/** Крупная строка: слова вылетают по очереди — ритм задаёт озвучка. */
export function Kinetic({
  words,
  from,
  size = 96,
  color = C.ink50,
  accent,
  step = 3,
  align = "center",
}: {
  words: string[];
  from: number;
  size?: number;
  color?: string;
  /** Индексы слов, которые красим в фирменный жёлтый. */
  accent?: number[];
  step?: number;
  align?: "center" | "left";
}) {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0 24px",
        justifyContent: align === "center" ? "center" : "flex-start",
        maxWidth: 1500,
        textAlign: align,
      }}
    >
      {words.map((w, i) => {
        const s = rise(frame, from + i * step, 16, 26);
        return (
          <span
            key={i}
            style={{
              ...display,
              fontSize: size,
              lineHeight: 1.08,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: accent?.includes(i) ? C.brand : color,
              ...s,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
}

/** Подпись под крупной строкой. */
export function Sub({ children, from }: { children: React.ReactNode; from: number }) {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...text,
        fontSize: 34,
        fontWeight: 400,
        color: C.ink300,
        marginTop: 26,
        ...rise(frame, from, 18, 20),
      }}
    >
      {children}
    </div>
  );
}

/** Карточка «окна», из которых состоит прежний способ работы. */
export function WindowCard({
  title,
  from,
  x,
  y,
  rotate,
  dim,
}: {
  title: string;
  from: number;
  x: number;
  y: number;
  rotate: number;
  dim?: boolean;
}) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [from, from + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 420,
        padding: "22px 26px",
        borderRadius: 16,
        background: dim ? C.ink900 : C.ink800,
        border: `1px solid ${C.ink700}`,
        boxShadow: "0 30px 80px rgba(0,0,0,.55)",
        transform: `rotate(${rotate}deg) translateY(${(1 - p) * 60}px) scale(${0.94 + p * 0.06})`,
        opacity: p,
      }}
    >
      <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 11, height: 11, borderRadius: 99, background: c, opacity: 0.8 }} />
        ))}
      </div>
      <div style={{ ...text, fontSize: 30, fontWeight: 600, color: C.ink300 }}>{title}</div>
    </div>
  );
}

/** Цифра, которая набегает. Для сцены «цена вопроса». */
export function Counter({
  from,
  to,
  dur = 30,
  start,
  suffix = "",
  size = 150,
}: {
  from: number;
  to: number;
  dur?: number;
  start: number;
  suffix?: string;
  size?: number;
}) {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [start, start + dur], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
  return (
    <span style={{ ...display, fontSize: size, fontWeight: 700, color: C.brand, lineHeight: 1 }}>
      {Math.round(v).toLocaleString("ru-RU")}
      {suffix}
    </span>
  );
}

/** Знак «ХО» из брендбука — маска с глазами. */
export function XoMark({ size = 220, from = 0 }: { size?: number; from?: number }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [from, from + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ opacity: p, transform: `scale(${0.9 + p * 0.1})` }}
    >
      <circle cx="50" cy="50" r="48" fill={C.brand} />
      <path d="M12 44 Q50 30 88 44 Q50 58 12 44 Z" fill="#111" opacity="0.92" />
      <path d="M26 38 l10 10 M36 38 l-10 10" stroke={C.brand} strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="68" cy="43" r="6" fill="none" stroke={C.brand} strokeWidth="3.4" />
    </svg>
  );
}

/** Плашка-«чип» для перечислений. */
export function Chip({ label, from, i = 0 }: { label: string; from: number; i?: number }) {
  const frame = useCurrentFrame();
  return (
    <span
      style={{
        ...text,
        fontSize: 30,
        fontWeight: 600,
        color: C.ink50,
        padding: "14px 26px",
        borderRadius: 999,
        background: "rgba(31,31,31,.86)",
        border: `1px solid ${C.ink700}`,
        backdropFilter: "blur(6px)",
        ...rise(frame, from + i * 4, 16, 18),
      }}
    >
      {label}
    </span>
  );
}

/** Нижняя треть: подпись к экрану, не закрывающая интерфейс. */
export function Lower({
  title,
  note,
  from,
}: {
  title: string;
  note?: string;
  from: number;
}) {
  const frame = useCurrentFrame();
  const s = rise(frame, from, 18, 26);
  return (
    <div style={{ position: "absolute", left: 96, bottom: 92, maxWidth: 1180, ...s }}>
      <div
        style={{
          ...display,
          fontSize: 68,
          fontWeight: 700,
          color: C.ink50,
          lineHeight: 1.05,
          textShadow: "0 6px 40px rgba(0,0,0,.65)",
        }}
      >
        {title}
      </div>
      {note && (
        <div
          style={{
            ...text,
            fontSize: 32,
            color: C.ink300,
            marginTop: 14,
            textShadow: "0 4px 24px rgba(0,0,0,.7)",
          }}
        >
          {note}
        </div>
      )}
    </div>
  );
}

/** Фон: графит с еле заметной сеткой — как подложка интерфейса. */
export function Backdrop() {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,.055) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          opacity: 0.6,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(70% 55% at 50% 42%, rgba(252,223,59,.10) 0%, rgba(0,0,0,0) 70%)",
        }}
      />
    </AbsoluteFill>
  );
}
