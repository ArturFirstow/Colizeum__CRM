import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { display, text } from "../fonts";

/** Сцена 2 — слова в такт: по одному на удар, затем общая мысль. */
export const Words: React.FC = () => {
  const frame = useCurrentFrame();
  const words = ["Клиенты.", "Сделки.", "Документы.", "Деньги."];

  return (
    <AbsoluteFill
      name="Слова в такт"
      style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}
    >
      <div style={{ display: "flex", gap: 26, flexWrap: "wrap", justifyContent: "center", padding: "0 90px" }}>
        {words.map((word, i) => (
          <div
            key={word}
            style={{
              fontFamily: display.fontFamily,
              fontSize: 76,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: i === 3 ? "#FCDF3B" : "#F5F5F5",
              opacity: interpolate(
                frame,
                [i * 15, i * 15 + 7, 104, 116],
                [0, 1, 1, 0],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                },
              ),
              scale: interpolate(frame, [i * 15, i * 15 + 10], [1.35, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
                output: "perceptual-scale",
              }),
            }}
          >
            {word}
          </div>
        ))}
      </div>

      <Interactive.Div
        name="Мысль"
        style={{
          marginTop: 46,
          fontFamily: text.fontFamily,
          fontSize: 38,
          fontWeight: 300,
          color: "#A8A8AC",
          opacity: interpolate(frame, [62, 78, 104, 114], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [62, 84], ["0px 28px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Один сервис вместо десяти таблиц
      </Interactive.Div>
    </AbsoluteFill>
  );
};
