import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame } from "remotion";
import { sans, serif } from "../fonts";

/** Сцена 4 — призыв: цена, кнопка, адрес. */
export const SceneCta: React.FC<{
  productName: string;
  price: string;
  ctaLabel: string;
  site: string;
}> = ({ productName, price, ctaLabel, site }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Сцена 4 — призыв">
      <Interactive.Div
        name="Название в финале"
        style={{
          position: "absolute",
          bottom: 620,
          left: 80,
          right: 80,
          textAlign: "center",
          fontFamily: serif.fontFamily,
          fontSize: 58,
          textWrap: "balance",
          fontWeight: 500,
          lineHeight: 1.2,
          color: "#F6F3ED",
          opacity: interpolate(frame, [6, 40, 128, 152], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [6, 48], ["0px 34px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        {productName}
      </Interactive.Div>

      <Interactive.Div
        name="Цена"
        style={{
          position: "absolute",
          bottom: 480,
          left: 80,
          right: 80,
          textAlign: "center",
          fontFamily: serif.fontFamily,
          fontSize: 88,
          fontWeight: 600,
          color: "#D8C9A8",
          display: price.trim() === "" ? "none" : "block",
          opacity: interpolate(frame, [22, 54, 128, 150], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          scale: interpolate(frame, [22, 60], [0.86, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            output: "perceptual-scale",
          }),
        }}
      >
        {price}
      </Interactive.Div>

      <Interactive.Div
        name="Кнопка"
        style={{
          position: "absolute",
          bottom: 310,
          left: 150,
          right: 150,
          textAlign: "center",
          padding: "38px 20px",
          borderRadius: 100,
          backgroundColor: "#F4F1EA",
          color: "#0C0C0E",
          fontFamily: sans.fontFamily,
          fontSize: 48,
          fontWeight: 500,
          letterSpacing: 1,
          boxShadow: "0 26px 70px rgba(216,201,168,0.22)",
          opacity: interpolate(frame, [40, 72, 128, 148], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          scale: interpolate(frame, [40, 76, 100, 124], [0.9, 1.02, 0.99, 1.01], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            output: "perceptual-scale",
          }),
        }}
      >
        {ctaLabel}
      </Interactive.Div>

      <Interactive.Div
        name="Адрес сайта"
        style={{
          position: "absolute",
          bottom: 200,
          left: 80,
          right: 80,
          textAlign: "center",
          fontFamily: sans.fontFamily,
          fontSize: 38,
          fontWeight: 300,
          color: "#8E8983",
          letterSpacing: 6,
          textTransform: "uppercase",
          opacity: interpolate(frame, [58, 90, 126, 146], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        {site}
      </Interactive.Div>
    </AbsoluteFill>
  );
};
