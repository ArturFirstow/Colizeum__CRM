import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Headline, Kicker, StatCell } from "../components/Bits";
import { MUTED, PAD, RAIL, WHITE, YELLOW } from "../theme";
import { display, text } from "../fonts";

const LEVELS: [string, string, string][] = [
  ["Турнирный календарь", "1 500 000", "охват в месяц: клубы, соцсети, Яндекс Карты, РСЯ"],
  ["Спонсорский турнир", "3 000 000", "крупнейшее событие сети, отдельный слот продвижения"],
  ["Спонсорский турнир PRO", "5 000 000", "звёздные амбассадоры, гранд-финал на арене Шелепиха"],
];

/** 32–40 с. Турниры — самый громкий формат. */
export const Tournaments: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Турниры" style={{ paddingLeft: PAD, paddingRight: RAIL + PAD }}>
      <div style={{ position: "absolute", top: 104, left: PAD }}>
        <Kicker start={2}>Самый крупный оператор любительских турниров в СНГ</Kicker>
        <div style={{ marginTop: 18 }}>
          <Headline start={10} size={112}>
            Турниры
          </Headline>
        </div>
      </div>

      <div style={{ position: "absolute", top: 320, left: PAD, display: "flex", gap: 96 }}>
        <StatCell value={3500} caption="турниров проведено" start={26} size={82} />
        <StatCell value={10000} prefix="> " caption="участников каждый месяц" start={34} size={82} />
        <StatCell value={1500000} suffix=" $" caption="разыграно призов" start={42} size={82} />
      </div>

      <div
        style={{
          position: "absolute",
          top: 470,
          left: PAD,
          right: RAIL + PAD,
          border: `1px solid ${YELLOW}`,
          padding: "26px 32px",
          display: "flex",
          alignItems: "center",
          gap: 44,
          opacity: interpolate(frame, [48, 64], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            fontFamily: display.fontFamily,
            fontSize: 40,
            fontWeight: 700,
            textTransform: "uppercase",
            color: YELLOW,
            whiteSpace: "nowrap",
          }}
        >
          Арена Шелепиха
        </div>
        <div
          style={{
            fontFamily: text.fontFamily,
            fontSize: 27,
            fontWeight: 300,
            color: WHITE,
          }}
        >
          5 000 м² · более 100 ПК и 60 консолей PlayStation 5 · 2 сцены для LAN-турниров —
          самый большой компьютерный клуб сети
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 96,
          left: PAD,
          right: RAIL + PAD,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          columnGap: 34,
        }}
      >
        {LEVELS.map(([name, reach, note], i) => (
          <div
            key={name}
            style={{
              borderLeft: `2px solid ${YELLOW}`,
              paddingLeft: 22,
              opacity: interpolate(frame, [56 + i * 12, 72 + i * 12], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [56 + i * 12, 78 + i * 12],
                ["0px 26px", "0px 0px"],
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
                fontSize: 34,
                fontWeight: 700,
                textTransform: "uppercase",
                color: WHITE,
              }}
            >
              {name}
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: display.fontFamily,
                fontSize: 52,
                fontWeight: 700,
                color: YELLOW,
                lineHeight: 1,
              }}
            >
              {reach}
            </div>
            <div
              style={{
                marginTop: 8,
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
