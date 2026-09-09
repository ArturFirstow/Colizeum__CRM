import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { PhotoBg } from "../components/Photo";
import { PAD, RAIL, WHITE, YELLOW } from "../theme";
import { display, text } from "../fonts";

/**
 * Мост к разговору о форматах: зал клуба, поверх него монитор с рекламой.
 * Без наезда — картинка спокойно стоит, чтобы подпись успевали прочитать.
 */
export const PushIn: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Заход в экран" style={{ backgroundColor: "#000000" }}>
      <PhotoBg file="club-corridor.jpg" dim={0.46} zoom={1.04} />

      {/* монитор выходит из глубины зала и заполняет кадр */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <Img
          name="Монитор с рекламой"
          src={staticFile("img/fmt-screens.jpg")}
          style={{
            width: 1060,
            marginTop: -60,
            opacity: interpolate(frame, [6, 24], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: interpolate(frame, [6, 30], ["0px 40px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            filter: "drop-shadow(0 40px 90px rgba(0,0,0,0.8))",
          }}
        />
      </AbsoluteFill>

      {/* подпись держится до конца сцены */}
      <div
        style={{
          position: "absolute",
          bottom: 96,
          left: PAD,
          right: RAIL + PAD,
          opacity: interpolate(frame, [22, 40, 104, 118], [0, 1, 1, 0], {
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

    </AbsoluteFill>
  );
};
