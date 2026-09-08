import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { sans, serif } from "../fonts";

/** Сцена 2 — презентация: название и три причины забрать. */
export const SceneProduct: React.FC<{ productName: string; bullets: string[] }> = ({
  productName,
  bullets,
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Сцена 2 — презентация">
      <Interactive.Div
        name="Название товара"
        style={{
          position: "absolute",
          bottom: 500,
          left: 80,
          right: 80,
          textAlign: "center",
          fontFamily: serif.fontFamily,
          fontSize: 68,
          textWrap: "balance",
          fontWeight: 500,
          lineHeight: 1.18,
          color: "#F6F3ED",
          opacity: interpolate(frame, [8, 44, 162, 188], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [8, 54], ["0px 40px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        {productName}
      </Interactive.Div>

      <div
        style={{
          position: "absolute",
          bottom: 180,
          left: 90,
          right: 90,
          display: "flex",
          flexDirection: "column",
          gap: 26,
        }}
      >
        {bullets.map((bullet, i) => (
          <div
            key={bullet}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 22,
              fontFamily: sans.fontFamily,
              fontSize: 42,
              fontWeight: 300,
              color: "#CFC8B8",
              opacity: interpolate(
                frame,
                [40 + i * 22, 74 + i * 22, 162, 184],
                [0, 1, 1, 0],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                },
              ),
              translate: interpolate(
                frame,
                [40 + i * 22, 84 + i * 22],
                ["0px 28px", "0px 0px"],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                },
              ),
            }}
          >
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                backgroundColor: "#D8C9A8",
                flexShrink: 0,
              }}
            />
            {bullet}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
