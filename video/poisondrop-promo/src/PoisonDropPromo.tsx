import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { z } from "zod";
import { ProductVisual } from "./components/ProductVisual";
import { Stage } from "./components/Stage";
import { SceneCta } from "./scenes/SceneCta";
import { SceneHook } from "./scenes/SceneHook";
import { SceneMeaning } from "./scenes/SceneMeaning";
import { SceneProduct } from "./scenes/SceneProduct";

export const promoSchema = z.object({
  brand: z.string(),
  productName: z.string(),
  bullets: z.array(z.string()),
  /** Цена строкой, например «4 900 ₽». Пусто — блок цены не показывается. */
  price: z.string(),
  ctaLabel: z.string(),
  site: z.string(),
  /** Имя файла в public/ или полный URL. Пусто — используется рисованная подвеска. */
  photoSrc: z.string(),
});

export type PromoProps = z.infer<typeof promoSchema>;

export const PoisonDropPromo: React.FC<PromoProps> = ({
  brand,
  productName,
  bullets,
  price,
  ctaLabel,
  site,
  photoSrc,
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Ролик" style={{ backgroundColor: "#08080A" }}>
      <Stage />

      {/* Изделие живёт весь ролик: плавно въезжает, парит, уходит в фон
          на сцене со смыслом и возвращается к призыву. */}
      <AbsoluteFill
        name="Изделие"
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: interpolate(
            frame,
            [0, 30, 306, 348, 402, 440],
            [0, 1, 1, 0.3, 0.3, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
          scale: interpolate(
            frame,
            [0, 56, 300, 348, 440, 492],
            [0.66, 1, 1.03, 1.17, 1.17, 0.82],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
              output: "perceptual-scale",
            },
          ),
          rotate: interpolate(frame, [0, 600], ["-2.6deg", "2.6deg"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.4, 0, 0.6, 1),
          }),
          filter: `blur(${interpolate(frame, [0, 46, 306, 348, 402, 440], [36, 0, 0, 18, 18, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })}px)`,
          translate: `0px ${
            interpolate(frame, [0, 56, 440, 492], [-120, -218, -218, -400], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }) +
            Math.sin(frame / 44) * 16
          }px`,
        }}
      >
        <ProductVisual photoSrc={photoSrc} />
      </AbsoluteFill>

      <Sequence name="Крючок" from={0} durationInFrames={132}>
        <SceneHook brand={brand} />
      </Sequence>

      <Sequence name="Презентация" from={126} durationInFrames={192}>
        <SceneProduct productName={productName} bullets={bullets} />
      </Sequence>

      <Sequence name="Смысл" from={312} durationInFrames={132}>
        <SceneMeaning />
      </Sequence>

      <Sequence name="Призыв" from={438} durationInFrames={162}>
        <SceneCta
          productName={productName}
          price={price}
          ctaLabel={ctaLabel}
          site={site}
        />
      </Sequence>

      {/* Плавный вход из чёрного и затухание в чёрный в конце */}
      <AbsoluteFill
        name="Затемнение"
        style={{
          backgroundColor: "#000000",
          pointerEvents: "none",
          opacity: interpolate(frame, [0, 22, 546, 600], [1, 0, 0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      />
    </AbsoluteFill>
  );
};
