import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Frame } from "./components/Frame";
import { Sweep } from "./components/Sweep";
import { Audience } from "./scenes/Audience";
import { Brand } from "./scenes/Brand";
import { BrandWall } from "./scenes/BrandWall";
import { Case } from "./scenes/Case";
import { Cta } from "./scenes/Cta";
import { FormatBig } from "./scenes/FormatBig";
import { FormatsRest } from "./scenes/FormatsRest";
import { Hook } from "./scenes/Hook";
import { PushIn } from "./scenes/PushIn";
import { Scale } from "./scenes/Scale";
import { Tournaments } from "./scenes/Tournaments";
import { YELLOW } from "./theme";

// Монтаж на сетке музыки: 120 BPM → удар 15 кадров, такт 60 кадров, всего 34 такта.
const SECTIONS: [number, number, string, string][] = [
  [0, 120, "Медиакит", "01"],
  [120, 240, "Сеть", "02"],
  [240, 480, "Масштаб", "03"],
  [480, 720, "Аудитория", "04"],
  [720, 1560, "Форматы", "05"],
  [1560, 1800, "Турниры", "06"],
  [1800, 1980, "Клиенты", "07"],
  [1980, 2580, "Кейсы", "08"],
  [2580, 2820, "Контакты", "09"],
];

// Кадры, на которых музыка бьёт акцентом — там же жёлтая вспышка.
const IMPACTS = [240, 840, 1800, 2580];
// Склейки, которые закрываем шторкой.
const CUTS = [120, 240, 480, 720, 1020, 1200, 1380, 1560, 1800, 1980, 2130, 2280, 2430, 2580];

const flash = (frame: number) =>
  Math.max(
    ...IMPACTS.map((f) =>
      interpolate(frame, [f - 2, f, f + 10], [0, 0.42, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );

export const MediaPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const section = SECTIONS.find(([from, to]) => frame >= from && frame < to) ?? SECTIONS[0];

  return (
    <AbsoluteFill name="Ролик" style={{ backgroundColor: "#000000" }}>
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
      <Sequence name="Заход в экран" from={720} durationInFrames={120}>
        <PushIn />
      </Sequence>
      <Sequence name="Формат 01 — ПК и ТВ" from={840} durationInFrames={180}>
        <FormatBig
          num="01"
          name="Баннеры на свободных ПК и ТВ"
          headline="20 000 ПК и 1 800 ТВ"
          image="fmt-screens.jpg"
          bullets={[
            "Показ примерно раз в минуту на заставке каждого свободного экрана",
            "Синхронно во всей сети — один креатив уходит на 570 клубов",
            "За один визит гость видит рекламу несколько раз",
          ]}
        />
      </Sequence>
      <Sequence name="Формат 02 — личный кабинет" from={1020} durationInFrames={180}>
        <FormatBig
          num="02"
          name="Баннер в личном кабинете"
          headline="2 слота · 2 показа в минуту"
          image="fmt-cabinet.jpg"
          bullets={[
            "Здесь гость пополняет баланс, покупает часы и запускает игру",
            "Около 5 минут в кабинете за одну игровую сессию",
            "Внимание сосредоточено на экране — момент принятия решений",
          ]}
        />
      </Sequence>
      <Sequence name="Формат 03 — рабочий стол" from={1200} durationInFrames={180}>
        <FormatBig
          num="03"
          name="Баннер на рабочем столе игрока"
          headline="CTR 2–6 %"
          image="fmt-widget.jpg"
          bullets={[
            "Кликабельный баннер или видео прямо на рабочем столе",
            "Показ раз в минуту, около 5 минут на столе за сессию",
            "Можно брендировать весь рабочий стол целиком",
          ]}
        />
      </Sequence>
      <Sequence name="Ещё каналы" from={1380} durationInFrames={180}>
        <FormatsRest />
      </Sequence>
      <Sequence name="Турниры" from={1560} durationInFrames={240}>
        <Tournaments />
      </Sequence>
      <Sequence name="Клиенты" from={1800} durationInFrames={180}>
        <BrandWall />
      </Sequence>

      <Sequence name="Кейс «Горячая штучка»" from={1980} durationInFrames={150}>
        <Case
          brand="«Горячая штучка»"
          photo="case-hot.jpg"
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
      <Sequence name="Кейс Уралсиб" from={2130} durationInFrames={150}>
        <Case
          brand="Уралсиб"
          photo="case-uralsib.jpg"
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
      <Sequence name="Кейс Thunderobot" from={2280} durationInFrames={150}>
        <Case
          brand="Thunderobot"
          photo="case-thunderobot.jpg"
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
      <Sequence name="Кейс ASUS ROG" from={2430} durationInFrames={150}>
        <Case
          brand="ASUS ROG"
          photo="case-asus.jpg"
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

      <Sequence name="Контакты" from={2580} durationInFrames={240}>
        <Cta />
      </Sequence>

      {/* рамка медиакита поверх сцен */}
      <Frame section={section[2]} num={section[3]} />

      <Sweep cuts={CUTS} />

      <AbsoluteFill
        name="Вспышка"
        style={{ backgroundColor: YELLOW, pointerEvents: "none", opacity: flash(frame) }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 5,
          backgroundColor: YELLOW,
          width: interpolate(frame, [0, 2820], [0, 1920], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />

      <AbsoluteFill
        name="Затемнение"
        style={{
          backgroundColor: "#000000",
          pointerEvents: "none",
          opacity: interpolate(frame, [0, 14, 2770, 2820], [1, 0, 0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
    </AbsoluteFill>
  );
};
