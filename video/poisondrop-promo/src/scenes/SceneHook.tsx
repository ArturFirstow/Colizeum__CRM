import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { sans, serif } from "../fonts";

/** Сцена 1 — крючок: бренд сверху, обещание снизу. */
export const SceneHook: React.FC<{ brand: string }> = ({ brand }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Сцена 1 — крючок">
      <Interactive.Div
        name="Бренд"
        style={{
          position: "absolute",
          top: 150,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: sans.fontFamily,
          fontSize: 34,
          fontWeight: 400,
          color: "#CFC8B8",
          textTransform: "uppercase",
          opacity: interpolate(frame, [10, 40, 100, 130], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          letterSpacing: interpolate(frame, [10, 60], [26, 13], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        {brand}
      </Interactive.Div>

      <Interactive.Div
        name="Обещание"
        style={{
          position: "absolute",
          bottom: 330,
          left: 90,
          right: 90,
          textAlign: "center",
          fontFamily: serif.fontFamily,
          fontSize: 96,
          fontWeight: 400,
          lineHeight: 1.14,
          color: "#F6F3ED",
          opacity: interpolate(frame, [34, 70, 104, 130], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [34, 80], ["0px 46px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Ключ, который
        <br />
        носят на себе
      </Interactive.Div>

      <Interactive.Div
        name="Подпись под обещанием"
        style={{
          position: "absolute",
          bottom: 210,
          left: 90,
          right: 90,
          textAlign: "center",
          fontFamily: sans.fontFamily,
          fontSize: 44,
          fontWeight: 300,
          color: "#A29C90",
          opacity: interpolate(frame, [56, 88, 104, 126], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        новая подвеска-брелок
      </Interactive.Div>
    </AbsoluteFill>
  );
};
