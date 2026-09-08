import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { display } from "../fonts";

const SHOTS: [string, string][] = [
  ["ord.png", "ОРД и маркировка"],
  ["promo.png", "Промокоды"],
  ["messenger.png", "Мессенджер"],
  ["budget.png", "Деньги отдела"],
];

const Cut: React.FC<{ file: string; label: string }> = ({ file, label }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Быстрый кадр" style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          width: 1320,
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid rgba(252,223,59,0.25)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.7)",
          scale: interpolate(frame, [0, 15], [1.14, 1.02], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            output: "perceptual-scale",
          }),
        }}
      >
        <Img name="Экран" src={staticFile(`shots/${file}`)} style={{ width: "100%", display: "block" }} />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 96,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: display.fontFamily,
          fontSize: 64,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 2,
          color: "#FCDF3B",
          textShadow: "0 6px 40px rgba(0,0,0,0.9)",
          opacity: interpolate(frame, [0, 4], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {label}
      </div>
    </AbsoluteFill>
  );
};

/** Сцена 6 — быстрая нарезка: по кадру на удар. */
export const RapidCuts: React.FC = () => (
  <AbsoluteFill name="Нарезка">
    {SHOTS.map(([file, label], i) => (
      <Sequence key={file} name={label} from={i * 15} durationInFrames={15}>
        <Cut file={file} label={label} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
