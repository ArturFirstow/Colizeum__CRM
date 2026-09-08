import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { XoMark } from "../components/XoMark";
import { display, text } from "../fonts";

/** Сцена 1 — заставка: знак, название, обещание. Уходит на «дроп». */
export const Intro: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      name="Заставка"
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        opacity: interpolate(frame, [0, 14, 104, 118], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        scale: interpolate(frame, [0, 30, 104, 120], [0.82, 1, 1, 1.22], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          output: "perceptual-scale",
        }),
      }}
    >
      <div
        style={{
          opacity: interpolate(frame, [0, 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          rotate: interpolate(frame, [0, 34], ["-24deg", "0deg"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        <XoMark size={132} />
      </div>

      <Interactive.Div
        name="Название"
        style={{
          marginTop: 34,
          fontFamily: display.fontFamily,
          fontSize: 104,
          fontWeight: 700,
          textTransform: "uppercase",
          color: "#F5F5F5",
          opacity: interpolate(frame, [16, 36], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          letterSpacing: interpolate(frame, [16, 52], [26, 10], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Colizeum
      </Interactive.Div>

      <Interactive.Div
        name="Agency"
        style={{
          marginTop: 6,
          fontFamily: text.fontFamily,
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: 22,
          textTransform: "uppercase",
          color: "#FCDF3B",
          opacity: interpolate(frame, [28, 46], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Agency
      </Interactive.Div>

      <Interactive.Div
        name="Подпись"
        style={{
          marginTop: 40,
          fontFamily: text.fontFamily,
          fontSize: 30,
          fontWeight: 300,
          color: "#9A9A9E",
          opacity: interpolate(frame, [44, 64], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [44, 68], ["0px 24px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Рабочий сервис отдела рекламы
      </Interactive.Div>
    </AbsoluteFill>
  );
};
