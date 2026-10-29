import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FPS, sec } from "./theme";
import "./fonts";
import {
  SceneAi,
  SceneBrand,
  SceneClient,
  SceneCost,
  SceneCta,
  SceneDocs,
  SceneHook,
  SceneMoney,
  SceneTasks,
  SceneTrust,
} from "./scenes";

// Границы сцен — настоящие паузы в озвучке (найдены silencedetect по файлу
// public/voice.mp3). Правите текст — пересчитайте их, иначе картинка поедет.
export const EDGES = [0, 10.41, 15.07, 20.85, 36.62, 47.08, 57.66, 72.1, 80.57, 88.61, 95.72];
export const TOTAL = Math.ceil(EDGES[EDGES.length - 1] * FPS);

const SCENES = [
  SceneHook,
  SceneCost,
  SceneBrand,
  SceneClient,
  SceneTasks,
  SceneMoney,
  SceneDocs,
  SceneAi,
  SceneTrust,
  SceneCta,
];

/** Вспышка на склейке: кадр меняется не «подменой», а ударом. */
const Cut: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at - 2, at, at + 5], [0, 0.5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ background: "#fff", opacity: o, pointerEvents: "none" }} />;
};

export const Tutorial: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    {SCENES.map((S, i) => {
      const from = Math.round(EDGES[i] * FPS);
      const dur = Math.round(EDGES[i + 1] * FPS) - from;
      return (
        <Sequence key={i} from={from} durationInFrames={dur}>
          <S dur={dur} />
        </Sequence>
      );
    })}

    {EDGES.slice(1, -1).map((e, i) => (
      <Cut key={i} at={Math.round(e * FPS)} />
    ))}

    <Audio src={staticFile("voice.mp3")} />
    {/* Музыка под голосом: 0.16 — слышно ритм, но речь не спорит с ней */}
    <Audio src={staticFile("music.mp3")} volume={(f) =>
      interpolate(f, [0, sec(1), TOTAL - sec(3), TOTAL], [0, 0.16, 0.16, 0], { extrapolateRight: "clamp" })
    } />
  </AbsoluteFill>
);
