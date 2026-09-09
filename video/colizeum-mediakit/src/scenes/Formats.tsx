import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Headline } from "../components/Bits";
import { MUTED, PAD, RAIL, WHITE, YELLOW } from "../theme";
import { display, text } from "../fonts";

const FORMATS: [string, string, string, string][] = [
  ["fmt-screens.jpg", "Заставки на ПК и ТВ", "20 000 ПК · 1 800 ТВ", "показ раз в минуту на каждом свободном экране"],
  ["fmt-cabinet.jpg", "Личный кабинет", "2 слота · 2 раза в минуту", "гость пополняет баланс и стартует сессию"],
  ["fmt-widget.jpg", "Виджет на рабочем столе", "CTR 2–6 %", "кликабельный баннер или видео"],
  ["fmt-browser.jpg", "Интеграция в браузер", "18 000 открытий в день", "автозапуск сайта рекламодателя"],
  ["fmt-app.jpg", "Баннеры в приложении", "700 000 скачиваний", "встроены прямо в интерфейс"],
  ["fmt-social.jpg", "Соцсети сети клубов", "200 000+ подписчиков", "ВК и Telegram, маркировка на нас"],
];

/** Шесть точек контакта — с реальными макетами из медиакита. */
export const Formats: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Форматы" style={{ paddingLeft: PAD, paddingRight: RAIL + PAD }}>
      <div style={{ position: "absolute", top: 88, left: PAD }}>
        <Headline start={0} size={104}>
          Точки контакта
        </Headline>
      </div>

      <div
        style={{
          position: "absolute",
          top: 258,
          left: PAD,
          right: RAIL + PAD,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          rowGap: 28,
          columnGap: 30,
        }}
      >
        {FORMATS.map(([img, name, stat, note], i) => (
          <div
            key={name}
            style={{
              opacity: interpolate(frame, [8 + i * 7, 24 + i * 7], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [8 + i * 7, 32 + i * 7],
                ["0px 34px", "0px 0px"],
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
                height: 190,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <Img
                name="Макет формата"
                src={staticFile(`img/${img}`)}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              <span
                style={{
                  fontFamily: display.fontFamily,
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: YELLOW,
                }}
              >
                0{i + 1}
              </span>
              <span
                style={{
                  fontFamily: display.fontFamily,
                  fontSize: 36,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  textTransform: "uppercase",
                  color: WHITE,
                }}
              >
                {name}
              </span>
            </div>

            <div
              style={{
                marginTop: 8,
                fontFamily: display.fontFamily,
                fontSize: 31,
                fontWeight: 700,
                color: YELLOW,
              }}
            >
              {stat}
            </div>
            <div
              style={{
                marginTop: 5,
                fontFamily: text.fontFamily,
                fontSize: 21,
                fontWeight: 300,
                color: MUTED,
              }}
            >
              {note}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
