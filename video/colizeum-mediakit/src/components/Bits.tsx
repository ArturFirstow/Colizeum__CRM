import { Easing, interpolate, useCurrentFrame } from "remotion";
import { MUTED, WHITE, YELLOW } from "../theme";
import { display, text } from "../fonts";

/** Заголовок, который «вытирается» слева направо — как в медиаките. */
export const Headline: React.FC<{
  children: React.ReactNode;
  start: number;
  size?: number;
  color?: string;
  out?: number;
}> = ({ children, start, size = 128, color = WHITE, out = 100000 }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        fontFamily: display.fontFamily,
        fontSize: size,
        fontWeight: 700,
        lineHeight: 0.98,
        letterSpacing: -1,
        textTransform: "uppercase",
        color,
        clipPath: `inset(0 ${interpolate(frame, [start, start + 16], [100, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })}% 0 0)`,
        opacity: interpolate(frame, [out, out + 10], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      {children}
    </div>
  );
};

/** Число, которое набегает до значения. */
export const CountUp: React.FC<{
  to: number;
  start: number;
  dur?: number;
  prefix?: string;
  suffix?: string;
  size?: number;
  color?: string;
}> = ({ to, start, dur = 30, prefix = "", suffix = "", size = 96, color = YELLOW }) => {
  const frame = useCurrentFrame();
  const raw = interpolate(frame, [start, start + dur], [0, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  // дробные значения (например 50,8 %) показываем с одним знаком
  const value = Number.isInteger(to) ? Math.round(raw) : Number(raw.toFixed(1));

  return (
    <span
      style={{
        fontFamily: display.fontFamily,
        fontSize: size,
        fontWeight: 700,
        lineHeight: 1,
        color,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {prefix}
      {value.toLocaleString("ru-RU")}
      {suffix}
    </span>
  );
};

/** Ячейка «цифра + подпись» из сетки медиакита. */
export const StatCell: React.FC<{
  value: number;
  caption: string;
  prefix?: string;
  suffix?: string;
  start: number;
  size?: number;
}> = ({ value, caption, prefix, suffix, start, size = 92 }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        opacity: interpolate(frame, [start, start + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        translate: interpolate(frame, [start, start + 18], ["0px 26px", "0px 0px"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
      }}
    >
      <CountUp to={value} start={start} prefix={prefix} suffix={suffix} size={size} />
      <div
        style={{
          marginTop: 6,
          fontFamily: text.fontFamily,
          fontSize: 27,
          fontWeight: 300,
          color: WHITE,
        }}
      >
        {caption}
      </div>
    </div>
  );
};

/** Жёлтая надстрочная плашка-рубрика. */
export const Kicker: React.FC<{ children: React.ReactNode; start: number }> = ({
  children,
  start,
}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        display: "inline-block",
        backgroundColor: YELLOW,
        color: "#000000",
        padding: "8px 18px 6px",
        fontFamily: display.fontFamily,
        fontSize: 30,
        fontWeight: 700,
        letterSpacing: 2,
        textTransform: "uppercase",
        clipPath: `inset(0 ${interpolate(frame, [start, start + 12], [100, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })}% 0 0)`,
      }}
    >
      {children}
    </div>
  );
};

/** Пояснительная строка. */
export const Note: React.FC<{
  children: React.ReactNode;
  start: number;
  size?: number;
  width?: number;
}> = ({ children, start, size = 30, width }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        fontFamily: text.fontFamily,
        fontSize: size,
        fontWeight: 300,
        lineHeight: 1.4,
        color: MUTED,
        width,
        opacity: interpolate(frame, [start, start + 14], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        translate: interpolate(frame, [start, start + 20], ["0px 18px", "0px 0px"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
      }}
    >
      {children}
    </div>
  );
};
