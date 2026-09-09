import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { YELLOW } from "../theme";

/**
 * Склейки закрываются жёлтой шторкой, которая проносится по кадру —
 * приём из вёрстки медиакита, только в движении.
 */
export const Sweep: React.FC<{ cuts: number[] }> = ({ cuts }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Шторки" style={{ pointerEvents: "none", overflow: "hidden" }}>
      {cuts.map((cut) => {
        if (Math.abs(frame - cut) > 12) {
          return null;
        }

        return (
          <AbsoluteFill key={cut}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: YELLOW,
                translate: `${interpolate(frame, [cut - 10, cut, cut + 10], [-104, 0, 104], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.5, 0, 0.5, 1),
                })}% 0px`,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "#000000",
                translate: `${interpolate(frame, [cut - 12, cut - 2, cut + 8], [-104, 0, 104], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.5, 0, 0.5, 1),
                })}% 0px`,
              }}
            />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};
