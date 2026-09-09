import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Headline, Kicker } from "../components/Bits";
import { MUTED, PAD, RAIL, WHITE, YELLOW } from "../theme";
import { display, text } from "../fonts";

/** Один кейс: бренд, задача и три цифры результата. */
export const Case: React.FC<{
  brand: string;
  what: string;
  steps: string[];
  results: [string, string][];
}> = ({ brand, what, steps, results }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Кейс" style={{ paddingLeft: PAD, paddingRight: RAIL + PAD }}>
      <div style={{ position: "absolute", top: 108, left: PAD }}>
        <Kicker start={0}>Кейс</Kicker>
        <div style={{ marginTop: 16 }}>
          <Headline start={4} size={118}>
            {brand}
          </Headline>
        </div>
        <div
          style={{
            marginTop: 14,
            maxWidth: 1180,
            fontFamily: text.fontFamily,
            fontSize: 30,
            fontWeight: 300,
            color: MUTED,
            opacity: interpolate(frame, [16, 30], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {what}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 450,
          left: PAD,
          right: RAIL + PAD,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          columnGap: 40,
        }}
      >
        {steps.map((step, i) => (
          <div
            key={step}
            style={{
              display: "flex",
              gap: 16,
              alignItems: "flex-start",
              opacity: interpolate(frame, [20 + i * 8, 34 + i * 8], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [20 + i * 8, 40 + i * 8],
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
                fontFamily: display.fontFamily,
                fontSize: 30,
                fontWeight: 700,
                color: YELLOW,
                lineHeight: 1.2,
              }}
            >
              0{i + 1}
            </div>
            <div
              style={{
                fontFamily: text.fontFamily,
                fontSize: 25,
                fontWeight: 300,
                lineHeight: 1.45,
                color: WHITE,
              }}
            >
              {step}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          top: 700,
          left: PAD,
          right: RAIL + PAD,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          columnGap: 40,
        }}
      >
        {results.map(([value, caption], i) => (
          <div
            key={caption}
            style={{
              borderTop: `2px solid ${YELLOW}`,
              paddingTop: 20,
              opacity: interpolate(frame, [26 + i * 10, 42 + i * 10], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [26 + i * 10, 48 + i * 10],
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
                fontFamily: display.fontFamily,
                fontSize: 78,
                fontWeight: 700,
                lineHeight: 1,
                color: i === 0 ? YELLOW : WHITE,
              }}
            >
              {value}
            </div>
            <div
              style={{
                marginTop: 8,
                fontFamily: text.fontFamily,
                fontSize: 24,
                fontWeight: 300,
                lineHeight: 1.35,
                color: MUTED,
              }}
            >
              {caption}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
