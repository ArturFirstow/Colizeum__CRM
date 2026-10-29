import React from "react";
import { Composition } from "remotion";
import { Tutorial, TOTAL } from "./Tutorial";
import { FPS } from "./theme";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Tutorial"
    component={Tutorial}
    durationInFrames={TOTAL}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
