import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { sans, serif } from "../fonts";

/** Сцена 3 — смысл: крупная строка «you are the key» поверх приглушённого изделия. */
export const SceneMeaning: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      name="Сцена 3 — смысл"
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        {["you are", "the key"].map((line, i) => (
          <div
            key={line}
            style={{
              fontFamily: serif.fontFamily,
              fontStyle: "italic",
              fontSize: 132,
              fontWeight: 400,
              lineHeight: 1.06,
              color: "#F8F5EF",
              opacity: interpolate(
                frame,
                [6 + i * 16, 44 + i * 16, 104, 128],
                [0, 1, 1, 0],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                },
              ),
              translate: interpolate(
                frame,
                [6 + i * 16, 56 + i * 16],
                ["0px 54px", "0px 0px"],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                },
              ),
            }}
          >
            {line}
          </div>
        ))}
      </div>

      <Interactive.Div
        name="Перевод"
        style={{
          marginTop: 44,
          fontFamily: sans.fontFamily,
          fontSize: 46,
          fontWeight: 300,
          color: "#A8A296",
          letterSpacing: 2,
          opacity: interpolate(frame, [50, 82, 104, 124], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        ты — тот, кто открывает
      </Interactive.Div>
    </AbsoluteFill>
  );
};
