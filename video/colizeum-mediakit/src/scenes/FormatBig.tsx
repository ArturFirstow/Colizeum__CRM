import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Headline } from "../components/Bits";
import { MUTED, PAD, RAIL, WHITE, YELLOW } from "../theme";
import { display, text } from "../fonts";

/**
 * Ключевой формат на весь экран: слева крупная подпись и цифры,
 * справа настоящий макет из медиакита. По сцене на формат, чтобы успевать читать.
 */
export const FormatBig: React.FC<{
  num: string;
  name: string;
  headline: string;
  image: string;
  bullets: string[];
}> = ({ num, name, headline, image, bullets }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name={`Формат ${num}`} style={{ backgroundColor: "#000000" }}>
      {/* макет справа */}
      <div
        style={{
          position: "absolute",
          right: RAIL + 26,
          top: 224,
          width: 900,
          opacity: interpolate(frame, [6, 24], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [6, 40, 180], [0.88, 1, 1.06], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            output: "perceptual-scale",
          }),
          filter: "drop-shadow(0 30px 90px rgba(241,226,123,0.16))",
        }}
      >
        <Img
          name="Макет формата"
          src={staticFile(`img/${image}`)}
          style={{ width: "100%", display: "block" }}
        />
      </div>

      {/* номер и название слева */}
      <div style={{ position: "absolute", top: 148, left: PAD, width: 720 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              backgroundColor: YELLOW,
              color: "#000000",
              padding: "10px 22px 6px",
              fontFamily: display.fontFamily,
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1,
              clipPath: `inset(0 ${interpolate(frame, [0, 12], [100, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              })}% 0 0)`,
            }}
          >
            {num}
          </div>
          <div
            style={{
              fontFamily: text.fontFamily,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: YELLOW,
              opacity: interpolate(frame, [8, 22], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            Формат
          </div>
        </div>

        <div style={{ marginTop: 26 }}>
          <Headline start={10} size={86} color={WHITE}>
            {name}
          </Headline>
        </div>

        <div
          style={{
            marginTop: 26,
            display: "inline-block",
            backgroundColor: YELLOW,
            color: "#000000",
            padding: "16px 26px 12px",
            fontFamily: display.fontFamily,
            fontSize: 54,
            fontWeight: 700,
            lineHeight: 1,
            clipPath: `inset(0 ${interpolate(frame, [26, 44], [100, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })}% 0 0)`,
          }}
        >
          {headline}
        </div>

        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 20 }}>
          {bullets.map((b, i) => (
            <div
              key={b}
              style={{
                display: "flex",
                gap: 18,
                alignItems: "flex-start",
                opacity: interpolate(frame, [46 + i * 14, 64 + i * 14], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                translate: interpolate(
                  frame,
                  [46 + i * 14, 70 + i * 14],
                  ["0px 22px", "0px 0px"],
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
                  width: 12,
                  height: 12,
                  marginTop: 12,
                  backgroundColor: YELLOW,
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  fontFamily: text.fontFamily,
                  fontSize: 30,
                  fontWeight: 300,
                  lineHeight: 1.35,
                  color: MUTED,
                }}
              >
                {b}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
