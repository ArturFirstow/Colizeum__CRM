import "./index.css";
import { Composition } from "remotion";
import { PoisonDropPromo, promoSchema } from "./PoisonDropPromo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="PoisonDropPromo"
      component={PoisonDropPromo}
      schema={promoSchema}
      durationInFrames={600}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        brand: "poison drop lab",
        productName: "подвеска-брелок «you are the key»",
        bullets: [
          "носится и на цепочке, и на связке ключей",
          "лаконичная форма — под любой образ",
          "готовый подарок с личным смыслом",
        ],
        price: "",
        ctaLabel: "Забрать себе",
        site: "poisondrop.ru",
        photoSrc: "",
      }}
    />
  );
};
