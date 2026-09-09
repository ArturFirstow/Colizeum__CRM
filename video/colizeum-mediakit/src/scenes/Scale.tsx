import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Headline, StatCell } from "../components/Bits";
import { PAD, RAIL, YELLOW } from "../theme";
import { display } from "../fonts";

/** 8–16 с. Масштаб сети — цифры из медиакита. */
export const Scale: React.FC = () => {
  const frame = useCurrentFrame();

  return (
  <AbsoluteFill name="Масштаб" style={{ paddingLeft: PAD, paddingRight: RAIL + PAD }}>
    <div style={{ position: "absolute", top: 118, left: PAD }}>
      <Headline start={2} size={118}>
        Масштаб сети
      </Headline>
    </div>

    <div
      style={{
        position: "absolute",
        top: 320,
        left: PAD,
        right: RAIL + PAD,
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        rowGap: 152,
        columnGap: 40,
      }}
    >
      <StatCell value={570} prefix="> " caption="открытых арен" start={18} size={112} />
      <StatCell value={220} prefix="> " caption="городов" start={26} size={112} />
      <StatCell value={18} caption="стран" start={34} size={112} />
      <StatCell value={20000} prefix="> " caption="игровых компьютеров" start={44} size={112} />
      <StatCell value={1800} caption="телевизоров с PS5" start={52} size={112} />
      <StatCell value={3500} caption="турниров проведено" start={60} size={112} />
    </div>

    <div
      style={{
        position: "absolute",
        bottom: 76,
        left: PAD,
        right: RAIL + PAD,
        backgroundColor: YELLOW,
        color: "#000000",
        padding: "22px 32px",
        fontFamily: display.fontFamily,
        fontSize: 40,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1,
        clipPath: `inset(0 ${interpolate(frame, [76, 96], [100, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })}% 0 0)`,
      }}
    >
      Один креатив — синхронный показ во всей сети
    </div>
  </AbsoluteFill>
  );
};
