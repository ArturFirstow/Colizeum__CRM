import "./index.css";
import { Composition } from "remotion";
import { ColizeumPromo } from "./ColizeumPromo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ColizeumPromo"
      component={ColizeumPromo}
      durationInFrames={960}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
