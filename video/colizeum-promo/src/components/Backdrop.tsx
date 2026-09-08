import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

/** Фон: графит брендбука, сетка точек и жёлтое свечение, пульсирующее в такт (120 BPM). */
export const Backdrop: React.FC<{ glowX: number; glowY: number }> = ({
  glowX,
  glowY,
}) => {
  const frame = useCurrentFrame();
  // доля кадра внутри доли такта: 15 кадров = 1 удар
  const beat = frame % 15;

  return (
    <AbsoluteFill name="Фон" style={{ backgroundColor: "#0E0E10" }}>
      <AbsoluteFill
        name="Сетка"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)",
          backgroundSize: "38px 38px",
          opacity: 0.9,
        }}
      />
      <AbsoluteFill
        name="Свечение"
        style={{
          background: `radial-gradient(46% 52% at ${glowX}% ${glowY}%, rgba(252,223,59,0.16) 0%, rgba(252,223,59,0.05) 45%, rgba(14,14,16,0) 74%)`,
          opacity: interpolate(beat, [0, 3, 15], [1, 0.72, 0.72], {
            extrapolateRight: "clamp",
          }),
        }}
      />
      <AbsoluteFill
        name="Виньетка"
        style={{
          background:
            "radial-gradient(78% 70% at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.6) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
