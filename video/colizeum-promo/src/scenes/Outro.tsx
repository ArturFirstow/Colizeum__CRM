import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { XoMark } from "../components/XoMark";
import { display, text } from "../fonts";

/** Сцена 7 — финал: знак, мысль, адрес сервиса. */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      name="Финал"
      style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}
    >
      <div
        style={{
          opacity: interpolate(frame, [0, 16], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [0, 26], [0.7, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            output: "perceptual-scale",
          }),
        }}
      >
        <XoMark size={116} />
      </div>

      <Interactive.Div
        name="Итог"
        style={{
          marginTop: 40,
          fontFamily: display.fontFamily,
          fontSize: 84,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 2,
          color: "#F5F5F5",
          textAlign: "center",
          opacity: interpolate(frame, [12, 32], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [12, 36], ["0px 34px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Весь отдел — в одном окне
      </Interactive.Div>

      <Interactive.Div
        name="Адрес"
        style={{
          marginTop: 34,
          padding: "20px 48px",
          borderRadius: 999,
          border: "1px solid rgba(252,223,59,0.5)",
          backgroundColor: "rgba(252,223,59,0.08)",
          fontFamily: text.fontFamily,
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: 3,
          color: "#FCDF3B",
          opacity: interpolate(frame, [30, 50], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [30, 54], [0.9, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            output: "perceptual-scale",
          }),
        }}
      >
        colizeum-agensy.space
      </Interactive.Div>
    </AbsoluteFill>
  );
};
