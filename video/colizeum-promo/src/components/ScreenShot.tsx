import { Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

/**
 * Скриншот сервиса: влетает сбоку, слегка развёрнут в перспективе,
 * потом медленно наезжает (эффект «кен бёрнс»).
 */
export const ScreenShot: React.FC<{
  file: string;
  side: "left" | "right";
  enter: number;
  hold: number;
}> = ({ file, side, enter, hold }) => {
  const frame = useCurrentFrame();
  const dir = side === "right" ? 1 : -1;

  return (
    <div
      style={{
        position: "absolute",
        top: 200,
        [side]: 72,
        width: 1040,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(252,223,59,0.22)",
        boxShadow:
          "0 50px 120px rgba(0,0,0,0.7), 0 0 90px rgba(252,223,59,0.10)",
        opacity: interpolate(frame, [0, enter, hold - 8, hold], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
        transform: `perspective(2200px) rotateY(${
          interpolate(frame, [0, enter, hold], [dir * 16, dir * 7, dir * 4], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })
        }deg) rotateX(2deg) translateX(${
          interpolate(frame, [0, enter], [dir * 160, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })
        }px) scale(${
          interpolate(frame, [0, enter, hold], [1.12, 1, 1.05], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })
        })`,
        filter: `blur(${interpolate(frame, [0, enter], [14, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}px)`,
      }}
    >
      <Img name="Экран сервиса" src={staticFile(`shots/${file}`)} style={{ width: "100%", display: "block" }} />
    </div>
  );
};
