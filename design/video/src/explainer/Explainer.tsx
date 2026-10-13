// The home page video ("What you get when you join"): a short explainer in the feel of a product launch film.
// A few words at a time, dark and pastel scenes taking turns, and one simple picture per idea: shoppers ask AI,
// AI picks a few brands, then what GEO does in the background and the money it shows. 1280x800, 30 fps, silent,
// looped on the page. Storyboard: docs/video/explainer.md.
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { AIPicks, Anymore, BigAI, DontJust, Introducing, IsYours, LogoReveal, SearchBar, Shoppers, TheyAsk } from "./scenes-intro";
import { EndCard, EveryWeek, Guides, Join, Money, Orbit, Rewrite, Sites, Slogan, WhoPicks } from "./scenes-work";

const END = 90;

// [scene, length in frames]. Each scene starts where the one before ends.
const SCENES: [React.FC, number][] = [
  [Shoppers, 42],
  [DontJust, 30],
  [SearchBar, 62],
  [Anymore, 34],
  [TheyAsk, 92],
  [BigAI, 50],
  [AIPicks, 110],
  [IsYours, 62],
  [Introducing, 38],
  [LogoReveal, 84],
  [EveryWeek, 80],
  [Orbit, 126],
  [WhoPicks, 96],
  [Rewrite, 130],
  [Guides, 90],
  [Sites, 100],
  [Money, 120],
  [Slogan, 96],
  [Join, 80],
];

const STARTS: number[] = [];
let at = 0;
for (const [, len] of SCENES) {
  STARTS.push(at);
  at += len;
}
const END_AT = at;

export const EXPLAINER_FPS = 30;
export const EXPLAINER_DURATION = END_AT + END;
/** The poster: the money scene with every number counted up. */
export const EXPLAINER_POSTER = STARTS[SCENES.findIndex(([s]) => s === Money)] + 100;

export const Explainer: React.FC = () => (
  <AbsoluteFill style={{ background: "#07081f" }}>
    {SCENES.map(([Scene, len], i) => (
      <Sequence key={i} from={STARTS[i]} durationInFrames={len}>
        <Scene />
      </Sequence>
    ))}
    <Sequence from={END_AT} durationInFrames={END}>
      <EndCard duration={END} />
    </Sequence>
  </AbsoluteFill>
);
