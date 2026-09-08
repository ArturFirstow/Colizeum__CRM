import { Img, staticFile } from "remotion";
import { KeyPendant } from "./KeyPendant";

/**
 * Показывает фотографию товара, если она положена в public/ и передана
 * через проп photoSrc. Пока фото нет — рисованная подвеска.
 */
export const ProductVisual: React.FC<{ photoSrc: string }> = ({ photoSrc }) => {
  if (photoSrc.trim() === "") {
    return <KeyPendant />;
  }

  return (
    <Img
      name="Фото товара"
      src={photoSrc.startsWith("http") ? photoSrc : staticFile(photoSrc)}
      style={{
        width: 760,
        height: 1140,
        objectFit: "contain",
        filter: "drop-shadow(0 40px 80px rgba(0,0,0,0.55))",
      }}
    />
  );
};
