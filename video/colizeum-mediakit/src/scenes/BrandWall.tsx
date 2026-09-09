import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Headline } from "../components/Bits";
import { MUTED, PAD, RAIL, YELLOW } from "../theme";
import { text } from "../fonts";

const ADS = Array.from({ length: 16 }, (_, i) => `ad-${String(i + 1).padStart(2, "0")}.jpg`);

/** Социальное доказательство: макеты брендов, которые уже размещались в сети. */
export const BrandWall: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Стена рекламодателей" style={{ paddingLeft: PAD, paddingRight: RAIL + PAD }}>
      <div style={{ position: "absolute", top: 76, left: PAD }}>
        <Headline start={0} size={100}>
          Здесь уже рекламировались
        </Headline>
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              fontFamily: text.fontFamily,
              fontSize: 28,
              fontWeight: 300,
              color: MUTED,
              opacity: interpolate(frame, [14, 30], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            Маркетплейсы, телеком, банки, доставка, FMCG, кино и киберспорт
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 300,
          left: PAD,
          right: RAIL + PAD,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 16,
        }}
      >
        {ADS.map((file, i) => (
          <div
            key={file}
            style={{
              width: 258,
              height: 172,
              backgroundColor: "#0B0B0B",
              border: `1px solid rgba(241,226,123,0.18)`,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: interpolate(frame, [8 + i * 3, 20 + i * 3], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              scale: interpolate(frame, [8 + i * 3, 24 + i * 3], [0.82, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
                output: "perceptual-scale",
              }),
            }}
          >
            <Img
              name="Макет рекламодателя"
              src={staticFile(`img/${file}`)}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: PAD,
          right: RAIL + PAD,
          backgroundColor: YELLOW,
          color: "#000000",
          padding: "18px 30px",
          fontFamily: text.fontFamily,
          fontSize: 30,
          fontWeight: 700,
          clipPath: `inset(0 ${interpolate(frame, [58, 78], [100, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })}% 0 0)`,
        }}
      >
        Готовим макеты под каждый формат и сопровождаем маркировку
      </div>
    </AbsoluteFill>
  );
};
