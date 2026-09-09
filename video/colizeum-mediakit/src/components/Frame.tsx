import { AbsoluteFill } from "remotion";
import { XoMark } from "./XoMark";
import { LINE, RAIL, YELLOW } from "../theme";
import { display } from "../fonts";

/** Постоянная «рамка» медиакита: сетка, правый жёлтый рельс, уголки. */
export const Frame: React.FC<{ section: string; num: string }> = ({ section, num }) => (
  <AbsoluteFill name="Рамка">
    <AbsoluteFill
      name="Сетка"
      style={{
        backgroundImage: `linear-gradient(to right, ${LINE} 1px, transparent 1px), linear-gradient(to bottom, ${LINE} 1px, transparent 1px)`,
        backgroundSize: "409px 231px",
        backgroundPosition: "92px 46px",
      }}
    />

    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: RAIL,
        backgroundColor: YELLOW,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 30,
        paddingBottom: 30,
        gap: 26,
      }}
    >
      <XoMark size={38} face="#000000" />
      <div
        style={{
          writingMode: "vertical-rl",
          fontFamily: display.fontFamily,
          fontSize: 25,
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: "#000000",
        }}
      >
        Colizeum
      </div>
      <div
        style={{
          writingMode: "vertical-rl",
          fontFamily: display.fontFamily,
          fontSize: 25,
          fontWeight: 700,
          letterSpacing: 6,
          textTransform: "uppercase",
          color: "#000000",
        }}
      >
        {section}
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          fontFamily: display.fontFamily,
          fontSize: 44,
          fontWeight: 700,
          color: "#000000",
          lineHeight: 1,
        }}
      >
        {num}
      </div>
    </div>

    {/* уголки кадра */}
    {[
      { top: 34, left: 34, borderTopWidth: 2, borderLeftWidth: 2 },
      { top: 34, right: RAIL + 34, borderTopWidth: 2, borderRightWidth: 2 },
      { bottom: 34, left: 34, borderBottomWidth: 2, borderLeftWidth: 2 },
      { bottom: 34, right: RAIL + 34, borderBottomWidth: 2, borderRightWidth: 2 },
    ].map((pos, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          width: 26,
          height: 26,
          borderStyle: "solid",
          borderColor: YELLOW,
          borderWidth: 0,
          ...pos,
        }}
      />
    ))}
  </AbsoluteFill>
);
