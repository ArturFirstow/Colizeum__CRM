import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

/** Фотофон из медиакита: медленный наезд и затемнение, чтобы текст читался. */
export const PhotoBg: React.FC<{
  file: string;
  dim?: number;
  from?: number;
  zoom?: number;
}> = ({ file, dim = 0.72, from = 0, zoom = 1.12 }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Фотофон">
      <Img
        name="Фото клуба"
        src={staticFile(`img/${file}`)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: interpolate(frame, [from, from + 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [from, from + 240], [1, zoom], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.3, 0, 0.5, 1),
            output: "perceptual-scale",
          }),
        }}
      />
      <AbsoluteFill
        name="Затемнение фото"
        style={{ backgroundColor: `rgba(0,0,0,${dim})` }}
      />
    </AbsoluteFill>
  );
};
