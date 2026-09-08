import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Backdrop } from "./components/Backdrop";
import { Intro } from "./scenes/Intro";
import { Outro } from "./scenes/Outro";
import { RapidCuts } from "./scenes/RapidCuts";
import { ScreenBlock } from "./scenes/ScreenBlock";
import { Words } from "./scenes/Words";
import { text } from "./fonts";

// Монтаж привязан к музыке: 120 BPM → удар = 15 кадров, такт = 60 кадров.
export const ColizeumPromo: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Ролик" style={{ backgroundColor: "#0E0E10" }}>
      <Backdrop
        glowX={interpolate(frame, [0, 240, 360, 480, 600, 720, 840, 960], [50, 50, 72, 28, 72, 28, 50, 50], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
        glowY={interpolate(frame, [0, 240, 840, 960], [46, 52, 52, 46], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
      />

      <Audio src={staticFile("music.mp3")} />

      <Sequence name="Заставка" from={0} durationInFrames={120}>
        <Intro />
      </Sequence>

      <Sequence name="Слова в такт" from={120} durationInFrames={120}>
        <Words />
      </Sequence>

      <Sequence name="Сегодня" from={240} durationInFrames={120}>
        <ScreenBlock
          file="dashboard.png"
          num="01"
          kicker="Сегодня"
          title="День на одном экране"
          subtitle="Портфель, задачи, блокеры и стадии проектов — сразу при входе."
          side="right"
          hold={120}
        />
      </Sequence>

      <Sequence name="Оплаты" from={360} durationInFrames={120}>
        <ScreenBlock
          file="finances.png"
          num="02"
          kicker="Оплаты"
          title="Календарь платежей"
          subtitle="Кто, сколько и когда платит — по месяцам, с НДС и остатком."
          side="left"
          hold={120}
        />
      </Sequence>

      <Sequence name="Размещения" from={480} durationInFrames={120}>
        <ScreenBlock
          file="placements.png"
          num="03"
          kicker="Календарь размещений"
          title="Слоты и недели"
          subtitle="Подписан, на подписании, ожидание — видно всю сетку сразу."
          side="right"
          hold={120}
        />
      </Sequence>

      <Sequence name="Клиенты" from={600} durationInFrames={120}>
        <ScreenBlock
          file="advertisers.png"
          num="04"
          kicker="Клиенты и сделки"
          title="Девять стадий"
          subtitle="Карточка клиента, реквизиты, сделки и документы — в одном месте."
          side="left"
          hold={120}
        />
      </Sequence>

      <Sequence name="Напарник ИИ" from={720} durationInFrames={60}>
        <ScreenBlock
          file="assistant.png"
          num="05"
          kicker="Напарник ИИ"
          title="Разложит и подскажет"
          subtitle="Читает базу знаний, раскладывает файлы по сделкам."
          side="right"
          hold={60}
        />
      </Sequence>

      <Sequence name="Нарезка" from={780} durationInFrames={60}>
        <RapidCuts />
      </Sequence>

      <Sequence name="Финал" from={840} durationInFrames={120}>
        <Outro />
      </Sequence>

      {/* адрес сервиса в углу */}
      <div
        style={{
          position: "absolute",
          right: 54,
          bottom: 44,
          fontFamily: text.fontFamily,
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: 3,
          color: "rgba(245,245,245,0.42)",
          opacity: interpolate(frame, [240, 260, 830, 845], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        colizeum-agensy.space
      </div>

      {/* полоса прогресса */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 5,
          backgroundColor: "#FCDF3B",
          width: interpolate(frame, [0, 960], [0, 1920], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          opacity: 0.85,
        }}
      />

      {/* вход из чёрного и затухание */}
      <AbsoluteFill
        name="Затемнение"
        style={{
          backgroundColor: "#000000",
          pointerEvents: "none",
          opacity: interpolate(frame, [0, 16, 916, 960], [1, 0, 0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
    </AbsoluteFill>
  );
};
