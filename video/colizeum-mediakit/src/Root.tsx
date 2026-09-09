import "./index.css";
import { Composition } from "remotion";
import { MediaPromo } from "./MediaPromo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ColizeumMediaPromo"
      component={MediaPromo}
      durationInFrames={1800}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
