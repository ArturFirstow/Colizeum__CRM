import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { ScreenShot } from "../components/ScreenShot";
import { display, text } from "../fonts";

/** Блок «один раздел сервиса»: скриншот + подпись слева или справа. */
export const ScreenBlock: React.FC<{
  file: string;
  num: string;
  kicker: string;
  title: string;
  subtitle: string;
  side: "left" | "right";
  hold: number;
}> = ({ file, num, kicker, title, subtitle, side, hold }) => {
  const frame = useCurrentFrame();
  const enter = 16;
  const textSide = side === "right" ? "left" : "right";

  return (
    <AbsoluteFill name="Раздел сервиса">
      <ScreenShot file={file} side={side} enter={enter} hold={hold} />

      <Interactive.Div
        name="Крупная цифра"
        style={{
          position: "absolute",
          top: 210,
          [textSide]: 40,
          fontFamily: display.fontFamily,
          fontSize: 300,
          fontWeight: 700,
          lineHeight: 0.8,
          color: "rgba(252,223,59,0.07)",
          opacity: interpolate(frame, [0, 14, hold - 8, hold], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {num}
      </Interactive.Div>

      <div
        style={{
          position: "absolute",
          top: 340,
          [textSide]: 90,
          width: 570,
          textAlign: textSide === "left" ? "left" : "right",
        }}
      >
        <div
          style={{
            fontFamily: text.fontFamily,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 5,
            textTransform: "uppercase",
            color: "#FCDF3B",
            opacity: interpolate(frame, [2, 16, hold - 8, hold], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(frame, [2, 20], ["0px 22px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          {kicker}
        </div>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            flexWrap: "wrap",
            gap: "0 18px",
            justifyContent: textSide === "left" ? "flex-start" : "flex-end",
          }}
        >
          {title.split(" ").map((word, i) => (
            <div
              key={word + i}
              style={{
                fontFamily: display.fontFamily,
                fontSize: 62,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "#F5F5F5",
                opacity: interpolate(
                  frame,
                  [6 + i * 3, 22 + i * 3, hold - 8, hold],
                  [0, 1, 1, 0],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                  },
                ),
                translate: interpolate(
                  frame,
                  [6 + i * 3, 26 + i * 3],
                  ["0px 40px", "0px 0px"],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                  },
                ),
              }}
            >
              {word}
            </div>
          ))}
        </div>

        <Interactive.Div
          name="Пояснение"
          style={{
            marginTop: 24,
            fontFamily: text.fontFamily,
            fontSize: 25,
            fontWeight: 300,
            lineHeight: 1.45,
            color: "#A8A8AC",
            opacity: interpolate(frame, [18, 34, hold - 8, hold], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(frame, [18, 38], ["0px 26px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          {subtitle}
        </Interactive.Div>

        <div
          style={{
            marginTop: 30,
            height: 4,
            borderRadius: 2,
            backgroundColor: "#FCDF3B",
            marginLeft: textSide === "left" ? 0 : "auto",
            width: interpolate(frame, [16, 44], [0, 190], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            opacity: interpolate(frame, [hold - 8, hold], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
