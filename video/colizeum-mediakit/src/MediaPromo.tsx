import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Frame } from "./components/Frame";
import { Audience } from "./scenes/Audience";
import { Brand } from "./scenes/Brand";
import { Case } from "./scenes/Case";
import { Cta } from "./scenes/Cta";
import { Formats } from "./scenes/Formats";
import { Hook } from "./scenes/Hook";
import { Scale } from "./scenes/Scale";
import { Tournaments } from "./scenes/Tournaments";
import { YELLOW } from "./theme";

// Монтаж на сетке музыки: 120 BPM → удар 15 кадров, такт 60 кадров, всего 30 тактов.
const SECTIONS: [number, number, string, string][] = [
  [0, 120, "Медиакит", "01"],
  [120, 240, "Сеть", "02"],
  [240, 480, "Масштаб", "03"],
  [480, 720, "Аудитория", "04"],
  [720, 960, "Форматы", "05"],
  [960, 1200, "Турниры", "06"],
  [1200, 1560, "Кейсы", "07"],
  [1560, 1800, "Контакты", "08"],
];

export const MediaPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const section = SECTIONS.find(([from, to]) => frame >= from && frame < to) ?? SECTIONS[0];

  return (
    <AbsoluteFill name="Ролик" style={{ backgroundColor: "#000000" }}>
      <Frame section={section[2]} num={section[3]} />

      <Audio src={staticFile("music.mp3")} />

      <Sequence name="Крючок" from={0} durationInFrames={120}>
        <Hook />
      </Sequence>
      <Sequence name="Сеть" from={120} durationInFrames={120}>
        <Brand />
      </Sequence>
      <Sequence name="Масштаб" from={240} durationInFrames={240}>
        <Scale />
      </Sequence>
      <Sequence name="Аудитория" from={480} durationInFrames={240}>
        <Audience />
      </Sequence>
      <Sequence name="Форматы" from={720} durationInFrames={240}>
        <Formats />
      </Sequence>
      <Sequence name="Турниры" from={960} durationInFrames={240}>
        <Tournaments />
      </Sequence>

      <Sequence name="Кейс «Горячая штучка»" from={1200} durationInFrames={90}>
        <Case
          brand="«Горячая штучка»"
          what="Сканирование чеков за промокоды на игровой баланс плюс баннеры в клубах и соцсетях"
          steps={[
            "Покупка продукции → скан чека → промокод на игровой баланс 100–300 ₽",
            "Розыгрыш игровых девайсов и мерча среди активных участников",
            "Баннеры на ПК, ТВ и в личном кабинете плюс продвижение в соцсетях",
          ]}
          results={[
            ["37 000", "единиц продукции продано"],
            ["+40 %", "рост узнаваемости среди гостей клубов"],
            ["> 1 млн", "охват кампании"],
          ]}
        />
      </Sequence>
      <Sequence name="Кейс Уралсиб" from={1290} durationInFrames={90}>
        <Case
          brand="Уралсиб"
          what="Турнир по CS:GO с призовым фондом 1,5 млн ₽ — выплата только на карту «Прибыль»"
          steps={[
            "Масштабный любительский турнир по CS:GO с крупным призовым фондом",
            "Приз выплачивается только на карту банка — прямая мотивация оформить",
            "Турнирный календарь, соцсети и реклама на 18 000 игровых ПК",
          ]}
          results={[
            ["90 %", "призёров оформили карту банка"],
            ["128", "команд, 640 игроков"],
            ["110 000", "охват кампании"],
          ]}
        />
      </Sequence>
      <Sequence name="Кейс Thunderobot" from={1380} durationInFrames={90}>
        <Case
          brand="Thunderobot"
          what="Открытый чемпионат по CS2, гранд-финал на арене Шелепиха и шоу-матчи с Virtus.pro"
          steps={[
            "Открытый чемпионат с призовым фондом 1,5 млн ₽",
            "Гранд-финал на арене Шелепиха, автограф- и фотосессии",
            "Баннеры в клубах, виджеты на ПК и заставки на всех экранах",
          ]}
          results={[
            ["+25 %", "рост продаж в партнёрских магазинах"],
            ["466 000", "уникальных посетителей увидели рекламу"],
            ["1,5 млн", "проходимость клубов за кампанию"],
          ]}
        />
      </Sequence>
      <Sequence name="Кейс ASUS ROG" from={1470} durationInFrames={90}>
        <Case
          brand="ASUS ROG"
          what="LAN-турнир с показательными матчами звёзд и тест-драйвами новинок техники"
          steps={[
            "Локальный турнир: призовой фонд 300 000 ₽ плюс девайсы ASUS ROG",
            "Показательные матчи с L’ONE, Boombl4 и Recrent",
            "Интерактивные зоны с тест-драйвом новинок техники",
          ]}
          results={[
            ["70 %", "участников рассматривают ASUS к покупке"],
            ["500 000", "просмотров трансляции"],
            ["256", "команд, 1 280 игроков"],
          ]}
        />
      </Sequence>

      <Sequence name="Контакты" from={1560} durationInFrames={240}>
        <Cta />
      </Sequence>

      {/* жёлтые вспышки на акцентах музыки */}
      <AbsoluteFill
        name="Вспышка"
        style={{
          backgroundColor: YELLOW,
          pointerEvents: "none",
          opacity: Math.max(
            interpolate(frame, [238, 240, 250], [0, 0.45, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            interpolate(frame, [958, 960, 970], [0, 0.45, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          ),
        }}
      />

      {/* полоса прогресса */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 5,
          backgroundColor: YELLOW,
          width: interpolate(frame, [0, 1800], [0, 1920], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />

      {/* вход из чёрного и затухание */}
      <AbsoluteFill
        name="Затемнение"
        style={{
          backgroundColor: "#000000",
          pointerEvents: "none",
          opacity: interpolate(frame, [0, 14, 1750, 1800], [1, 0, 0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
    </AbsoluteFill>
  );
};
