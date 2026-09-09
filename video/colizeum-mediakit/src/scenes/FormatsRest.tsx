import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Headline } from "../components/Bits";
import { MUTED, PAD, RAIL, WHITE, YELLOW } from "../theme";
import { display, text } from "../fonts";

const REST: [string, string, string, string][] = [
  ["fmt-browser.jpg", "Интеграция в браузер", "18 000 открытий в день", "сайт рекламодателя открывается сам, плюс брендирование Chrome"],
  ["fmt-app.jpg", "Баннеры в приложении", "700 000 скачиваний", "встроены прямо в интерфейс — гость видит их до прихода в клуб"],
  ["fmt-social.jpg", "Соцсети сети клубов", "200 000+ подписчиков", "ВК и Telegram, вовлечённость до 4 %, маркировку берём на себя"],
];

/** Остальные три канала — одним экраном, но крупно. */
export const FormatsRest: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Ещё каналы" style={{ paddingLeft: PAD, paddingRight: RAIL + PAD }}>
      <div style={{ position: "absolute", top: 96, left: PAD }}>
        <Headline start={0} size={100}>
          Ещё три канала
        </Headline>
      </div>

      <div
        style={{
          position: "absolute",
          top: 272,
          left: PAD,
          right: RAIL + PAD,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          columnGap: 34,
        }}
      >
        {REST.map(([img, name, stat, note], i) => (
          <div
            key={name}
            style={{
              opacity: interpolate(frame, [10 + i * 14, 30 + i * 14], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [10 + i * 14, 38 + i * 14],
                ["0px 36px", "0px 0px"],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                },
              ),
            }}
          >
            <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Img
                name="Макет канала"
                src={staticFile(`img/${img}`)}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            </div>
            <div
              style={{
                marginTop: 20,
                fontFamily: display.fontFamily,
                fontSize: 44,
                fontWeight: 700,
                lineHeight: 1.05,
                textTransform: "uppercase",
                color: WHITE,
              }}
            >
              {name}
            </div>
            <div
              style={{
                marginTop: 12,
                display: "inline-block",
                backgroundColor: YELLOW,
                color: "#000000",
                padding: "8px 16px 5px",
                fontFamily: display.fontFamily,
                fontSize: 34,
                fontWeight: 700,
              }}
            >
              {stat}
            </div>
            <div
              style={{
                marginTop: 14,
                fontFamily: text.fontFamily,
                fontSize: 25,
                fontWeight: 300,
                lineHeight: 1.4,
                color: MUTED,
              }}
            >
              {note}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 72,
          left: PAD,
          right: RAIL + PAD,
          backgroundColor: YELLOW,
          color: "#000000",
          padding: "20px 30px",
          fontFamily: display.fontFamily,
          fontSize: 40,
          fontWeight: 700,
          textTransform: "uppercase",
          clipPath: `inset(0 ${interpolate(frame, [72, 92], [100, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })}% 0 0)`,
        }}
      >
        Форматы комбинируются в одну кампанию
      </div>
    </AbsoluteFill>
  );
};
