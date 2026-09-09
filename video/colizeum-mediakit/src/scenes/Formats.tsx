import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Headline } from "../components/Bits";
import { MUTED, PAD, RAIL, WHITE, YELLOW } from "../theme";
import { display, text } from "../fonts";

const FORMATS: [string, string, string][] = [
  ["Заставки на ПК и ТВ", "20 000 ПК · 1 800 ТВ", "показ примерно раз в минуту на каждом свободном экране"],
  ["Личный кабинет", "2 слота · 2 раза в минуту", "гость пополняет баланс и запускает сессию — около 5 минут"],
  ["Виджет на рабочем столе", "CTR 2–6 %", "кликабельный баннер или видео, брендирование стола"],
  ["Интеграция в браузер", "18 000 открытий в день", "автозапуск сайта рекламодателя и брендирование Chrome"],
  ["Баннеры в приложении", "700 000 скачиваний", "встроенные в интерфейс — максимальная видимость"],
  ["Соцсети сети клубов", "200 000+ подписчиков", "ВК и Telegram, вовлечённость до 4 %, маркировка на нас"],
];

/** 24–32 с. Шесть точек контакта с рекламой. */
export const Formats: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Форматы" style={{ paddingLeft: PAD, paddingRight: RAIL + PAD }}>
      <div style={{ position: "absolute", top: 104, left: PAD }}>
        <Headline start={2} size={112}>
          Точки контакта
        </Headline>
      </div>

      <div
        style={{
          position: "absolute",
          top: 288,
          left: PAD,
          right: RAIL + PAD,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          rowGap: 74,
          columnGap: 34,
        }}
      >
        {FORMATS.map(([name, stat, note], i) => (
          <div
            key={name}
            style={{
              borderTop: `2px solid ${YELLOW}`,
              paddingTop: 22,
              opacity: interpolate(frame, [16 + i * 9, 30 + i * 9], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [16 + i * 9, 36 + i * 9],
                ["0px 30px", "0px 0px"],
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
                fontSize: 21,
                fontWeight: 700,
                letterSpacing: 3,
                color: YELLOW,
              }}
            >
              0{i + 1}
            </div>
            <div
              style={{
                marginTop: 8,
                fontFamily: display.fontFamily,
                fontSize: 42,
                fontWeight: 700,
                lineHeight: 1.04,
                textTransform: "uppercase",
                color: WHITE,
              }}
            >
              {name}
            </div>
            <div
              style={{
                marginTop: 12,
                fontFamily: display.fontFamily,
                fontSize: 34,
                fontWeight: 700,
                color: YELLOW,
              }}
            >
              {stat}
            </div>
            <div
              style={{
                marginTop: 10,
                fontFamily: text.fontFamily,
                fontSize: 22,
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
    </AbsoluteFill>
  );
};
