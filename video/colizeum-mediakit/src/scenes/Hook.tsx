import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { CountUp, Headline } from "../components/Bits";
import { PAD, RAIL, WHITE, YELLOW } from "../theme";
import { text } from "../fonts";
import { PhotoBg } from "../components/Photo";

/** 0–4 с. Один вопрос — где сегодня можно поймать геймера офлайн. */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Крючок" style={{ paddingLeft: PAD, paddingRight: RAIL + PAD }}>
      <PhotoBg file="club-people.jpg" dim={0.76} zoom={1.18} />
      <div style={{ position: "absolute", top: 96, left: PAD }}>
        <div
          style={{
            fontFamily: text.fontFamily,
            fontSize: 26,
            fontWeight: 500,
            letterSpacing: 8,
            color: YELLOW,
            opacity: interpolate(frame, [4, 20], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          [ CYBER . ARENA ]
        </div>
      </div>

      <div style={{ position: "absolute", top: 280, left: PAD }}>
        <div
          style={{
            opacity: interpolate(frame, [8, 22], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            scale: interpolate(frame, [8, 34], [0.86, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
              output: "perceptual-scale",
            }),
            transformOrigin: "left center",
          }}
        >
          <CountUp to={1600000} start={8} dur={44} size={240} />
        </div>

        <div style={{ marginTop: 18 }}>
          <Headline start={44} size={92} color={WHITE}>
            геймеров в месяц
          </Headline>
        </div>
        <div style={{ marginTop: 6 }}>
          <Headline start={54} size={92} color={YELLOW}>
            приходят в клубы
          </Headline>
        </div>
      </div>
    </AbsoluteFill>
  );
};
