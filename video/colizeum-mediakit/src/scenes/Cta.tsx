import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Headline } from "../components/Bits";
import { XoMark } from "../components/XoMark";
import { MUTED, PAD, RAIL, WHITE, YELLOW } from "../theme";
import { display, text } from "../fonts";

/** 52–60 с. Что мы предлагаем и куда писать. */
export const Cta: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Призыв" style={{ paddingLeft: PAD, paddingRight: RAIL + PAD }}>
      <div style={{ position: "absolute", top: 130, left: PAD }}>
        <XoMark size={92} />
        <div style={{ marginTop: 30 }}>
          <Headline start={6} size={140}>
            Colizeum
          </Headline>
          <Headline start={14} size={140} color={YELLOW}>
            Agency
          </Headline>
        </div>
      </div>

      <div style={{ position: "absolute", top: 560, left: PAD, maxWidth: 1240 }}>
        <div
          style={{
            fontFamily: display.fontFamily,
            fontSize: 54,
            fontWeight: 700,
            textTransform: "uppercase",
            lineHeight: 1.1,
            color: WHITE,
            clipPath: `inset(0 ${interpolate(frame, [28, 46], [100, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })}% 0 0)`,
          }}
        >
          Соберём кампанию под вашу задачу
        </div>
        <div
          style={{
            marginTop: 16,
            fontFamily: text.fontFamily,
            fontSize: 30,
            fontWeight: 300,
            color: MUTED,
            opacity: interpolate(frame, [46, 62], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Клубы · турниры · соцсети · инфлюенсеры · исследования аудитории
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 110,
          left: PAD,
          display: "flex",
          gap: 20,
          alignItems: "center",
        }}
      >
        {["@alexandr_ivanushkin", "colizeum-agency.ru"].map((contact, i) => (
          <div
            key={contact}
            style={{
              backgroundColor: i === 0 ? YELLOW : "transparent",
              border: `2px solid ${YELLOW}`,
              color: i === 0 ? "#000000" : YELLOW,
              padding: "20px 40px",
              fontFamily: text.fontFamily,
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: 1,
              opacity: interpolate(frame, [64 + i * 10, 80 + i * 10], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              scale: interpolate(frame, [64 + i * 10, 84 + i * 10], [0.9, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
                output: "perceptual-scale",
              }),
            }}
          >
            {contact}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
