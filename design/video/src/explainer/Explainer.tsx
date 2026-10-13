// The home page video ("How GEO can increase your sales"): a short explainer in the feel of a product launch film.
// A few words at a time, dark and pastel scenes taking turns, and one simple picture per idea: shoppers ask AI,
// AI picks a few brands, then what GEO does in the background and the money it shows. 1280x800, 30 fps, silent,
// looped on the page. Storyboard: docs/video/explainer.md.
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { AIPicks, Anymore, BigAI, Introducing, IsYours, LogoReveal, SearchBar, Shoppers, TheyAsk } from "./scenes-intro";
import { SPEED } from "./kit";
import { AskAIs, EndCard, Guides, Money, Orbit, Rewrite, Sites, Slogan, Unlock, WhoPicks } from "./scenes-work";

const END = 90; // the end card, in design frames

// [scene, length in design frames]. Each plays SPEED times faster (kit.tsx), so it lasts length / SPEED frames,
// and starts where the one before ends.
const SCENES: [React.FC, number][] = [
  [Shoppers, 66],
  [SearchBar, 62],
  [Anymore, 34],
  [TheyAsk, 100],
  [BigAI, 50],
  [AIPicks, 110],
  [IsYours, 62],
  [Introducing, 38],
  [LogoReveal, 84],
  [AskAIs, 92],
  [Orbit, 142],
  [WhoPicks, 96],
  [Rewrite, 130],
  [Guides, 90],
  [Sites, 132],
  [Money, 120],
  [Slogan, 96],
  [Unlock, 84],
];

const real = (len: number) => Math.round(len / SPEED);
const STARTS: number[] = [];
let at = 0;
for (const [, len] of SCENES) {
  STARTS.push(at);
  at += real(len);
}
const END_AT = at;

export const EXPLAINER_FPS = 30;
export const EXPLAINER_DURATION = END_AT + real(END);
/** The poster: the money scene with every number counted up. */
export const EXPLAINER_POSTER = STARTS[SCENES.findIndex(([s]) => s === Money)] + real(100);

export const Explainer: React.FC = () => (
  <AbsoluteFill style={{ background: "#07081f" }}>
    {SCENES.map(([Scene, len], i) => (
      <Sequence key={i} from={STARTS[i]} durationInFrames={real(len)}>
        <Scene />
      </Sequence>
    ))}
    <Sequence from={END_AT} durationInFrames={real(END)}>
      <EndCard duration={END} />
    </Sequence>
  </AbsoluteFill>
);
