import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";

/** Фон: графит, мягкий свет сверху, парящие пылинки, виньетка. */
export const Stage: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Фон" style={{ backgroundColor: "#08080A" }}>
      {/* световое пятно, медленно разгорается на входе */}
      <AbsoluteFill
        name="Свет"
        style={{
          background:
            "radial-gradient(58% 42% at 50% 34%, rgba(232,224,206,0.20) 0%, rgba(232,224,206,0.07) 42%, rgba(8,8,10,0) 72%)",
          opacity: interpolate(frame, [0, 45], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />

      {/* холодный контровой свет снизу — металл «оживает» */}
      <AbsoluteFill
        name="Контровой свет"
        style={{
          background:
            "radial-gradient(46% 26% at 50% 78%, rgba(150,170,200,0.14) 0%, rgba(8,8,10,0) 70%)",
        }}
      />

      {/* пылинки в луче */}
      {new Array(18).fill(true).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${random(`x${i}`) * 100}%`,
            top: `${((random(`y${i}`) * 120 + frame * (0.05 + random(`s${i}`) * 0.07)) % 120) - 10}%`,
            width: 3 + random(`w${i}`) * 5,
            height: 3 + random(`w${i}`) * 5,
            borderRadius: "50%",
            backgroundColor: "#EFE7D6",
            opacity: 0.05 + random(`o${i}`) * 0.16,
            filter: "blur(2px)",
          }}
        />
      ))}

      {/* виньетка */}
      <AbsoluteFill
        name="Виньетка"
        style={{
          background:
            "radial-gradient(72% 58% at 50% 46%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.62) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
