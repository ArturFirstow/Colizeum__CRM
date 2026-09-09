import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Headline, Note } from "../components/Bits";
import { MUTED, PAD, RAIL, YELLOW } from "../theme";
import { display, text } from "../fonts";
import { PhotoBg } from "../components/Photo";

/** 4–8 с. Кто мы: сеть №1 и признание рынка. */
export const Brand: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Бренд" style={{ paddingLeft: PAD, paddingRight: RAIL + PAD }}>
      <PhotoBg file="club-blue.jpg" dim={0.8} zoom={1.14} />
      <div style={{ position: "absolute", top: 150, left: PAD, right: RAIL + PAD }}>
        <Headline start={2} size={216}>
          Colizeum
        </Headline>

        <div style={{ marginTop: 22, maxWidth: 1180 }}>
          <Headline start={20} size={66} color={YELLOW}>
            Самая крупная сеть компьютерных клубов в мире
          </Headline>
        </div>

        <div style={{ marginTop: 26 }}>
          <Note start={40} size={34} width={980}>
            №1 рекламная площадка коммуникации с геймерами в офлайне
          </Note>
        </div>

        <div style={{ marginTop: 54, display: "flex", gap: 22 }}>
          {[
            "Бренд года в России 2025",
            "Топ-1 из 30 самых выгодных франшиз — Forbes",
          ].map((badge, i) => (
            <div
              key={badge}
              style={{
                border: `1px solid ${YELLOW}`,
                color: MUTED,
                padding: "16px 26px",
                fontFamily: text.fontFamily,
                fontSize: 25,
                fontWeight: 500,
                opacity: interpolate(frame, [56 + i * 10, 72 + i * 10], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                translate: interpolate(
                  frame,
                  [56 + i * 10, 78 + i * 10],
                  ["0px 22px", "0px 0px"],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                  },
                ),
              }}
            >
              <span style={{ fontFamily: display.fontFamily, fontWeight: 700, color: YELLOW }}>
                ★{" "}
              </span>
              {badge}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
