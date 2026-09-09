import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { PhotoBg } from "../components/Photo";
import { PAD, RAIL, WHITE, YELLOW } from "../theme";
import { display, text } from "../fonts";

/**
 * Переход из зала клуба в экран: камера идёт по ряду компьютеров,
 * один монитор выезжает вперёд и разрастается на весь кадр — дальше
 * начинается разговор про рекламные форматы.
 */
export const PushIn: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Заход в экран" style={{ backgroundColor: "#000000" }}>
      <PhotoBg file="club-corridor.jpg" dim={0.42} zoom={1.3} />

      {/* монитор выходит из глубины зала и заполняет кадр */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <Img
          name="Монитор с рекламой"
          src={staticFile("img/fmt-screens.jpg")}
          style={{
            width: 1180,
            opacity: interpolate(frame, [10, 30], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            scale: interpolate(frame, [10, 62, 118], [0.34, 1, 2.5], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.32, 0, 0.2, 1),
              output: "perceptual-scale",
            }),
            filter: `drop-shadow(0 40px 90px rgba(0,0,0,0.8)) blur(${interpolate(
              frame,
              [10, 34],
              [10, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )}px)`,
          }}
        />
      </AbsoluteFill>

      {/* подпись уходит раньше, чем экран накрывает кадр */}
      <div
        style={{
          position: "absolute",
          bottom: 96,
          left: PAD,
          right: RAIL + PAD,
          opacity: interpolate(frame, [26, 42, 76, 92], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            fontFamily: display.fontFamily,
            fontSize: 76,
            fontWeight: 700,
            textTransform: "uppercase",
            color: WHITE,
            textShadow: "0 8px 40px rgba(0,0,0,0.9)",
          }}
        >
          Каждый свободный экран — <span style={{ color: YELLOW }}>это ваш экран</span>
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: text.fontFamily,
            fontSize: 30,
            fontWeight: 300,
            color: "#DDDDDD",
            textShadow: "0 4px 20px rgba(0,0,0,0.9)",
          }}
        >
          20 000 компьютеров и 1 800 телевизоров показывают рекламу синхронно
        </div>
      </div>

      {/* к концу сцены экран «съедает» кадр — стык с форматами не виден */}
      <AbsoluteFill
        name="Заливка"
        style={{
          backgroundColor: "#000000",
          opacity: interpolate(frame, [104, 120], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
    </AbsoluteFill>
  );
};
