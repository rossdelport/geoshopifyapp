// Timing for the member tour: scene starts, screen changes, the active tab, the Fixes badge, and the small
// animation helpers every scene uses. All frame numbers here are GLOBAL (0 to 1679 at 30 fps); scenes work in
// local frames (global minus their start). Everything is a pure function of the frame (README rule).
import { Easing, interpolate, spring } from "remotion";
import type { TabIndex } from "./data";

export const FPS = 30;
export const DURATION = 1680; // 56.0 s

// Scene starts (storyboard section 1). Scene 6 has two beats (6a money, 6b report) with their own captions.
export const S1 = 0;
export const S2 = 195;
export const S3 = 465;
export const S4 = 705;
export const S5 = 960;
export const S6 = 1185;
export const S6B = 1335;
// The end card starts half a second earlier than the storyboard (1485) so its three stops and the button stay
// on screen for about 4.5 s before the loop fade; the report beat (6b) gives up that half second.
export const S7 = 1470;
// The caption rows, one per SCENE_COPY entry, and when each one shows.
export const CAPTION_STARTS = [S1, S2, S3, S4, S5, S6, S6B, S7];

// The loop seam: for the last 18 frames scene 1's opening picture fades in over the end card.
export const LOOP_FADE = 18;
export const LOOP_START = DURATION - LOOP_FADE; // 1662

// Screens in the app's main area. Each change is a quick fade through: the old screen leaves over 7 frames and
// the new one starts 4 frames later (see swap), so two layouts never sit on top of each other.
export const SWAP_GAP = 4;
export const SCREEN = {
  setupOut: 245,
  resultsIn: 245 + SWAP_GAP,
  resultsOut: 495,
  fixesIn: 495 + SWAP_GAP,
  fixesOut: 733,
  outreachIn: 733 + SWAP_GAP,
  outreachOut: 986,
  weeklyIn: 986 + SWAP_GAP,
  weeklyOut: 1211,
  moneyIn: 1211 + SWAP_GAP,
};

// Pointer clicks (global frames).
export const CLICK = {
  fixesTab: S3 + 28, // 493
  approve: S3 + 96, // 561
  outreachTab: S4 + 26, // 731
  pitchRow: S4 + 120, // 825
  questionsTab: S5 + 24, // 984
  dashboardTab: S6 + 24, // 1209
};

const TAB_CHANGES: { f: number; tab: TabIndex }[] = [
  { f: 0, tab: 0 },
  { f: CLICK.fixesTab, tab: 3 },
  { f: CLICK.outreachTab, tab: 4 },
  { f: CLICK.questionsTab, tab: 1 },
  { f: CLICK.dashboardTab, tab: 0 },
];

// Which tab is active and where the white pill sits (a fractional tab index while it slides over 8 frames).
export function tabState(f: number): { active: TabIndex; pill: number; from: TabIndex; to: TabIndex; p: number } {
  let i = 0;
  for (let k = 0; k < TAB_CHANGES.length; k++) if (f >= TAB_CHANGES[k].f) i = k;
  const cur = TAB_CHANGES[i];
  const prev = i > 0 ? TAB_CHANGES[i - 1] : cur;
  const p = i > 0 ? ease(f, cur.f, cur.f + 8, Easing.inOut(Easing.cubic)) : 1;
  return { active: cur.tab, pill: prev.tab + (cur.tab - prev.tab) * p, from: prev.tab, to: cur.tab, p };
}

// The Fixes badge: none until the first fixes arrive, then 3, 2 after the approve, 4 after the weekly check.
const BADGE: { f: number; n: number }[] = [
  { f: S2 + 230, n: 3 }, // 425
  { f: S3 + 118, n: 2 }, // 583
  { f: S5 + 150, n: 4 }, // 1110
];
export function badgeState(f: number): { n: number; scale: number } {
  let n = 0;
  let since = -1;
  for (const b of BADGE) if (f >= b.f) { n = b.n; since = f - b.f; }
  // one soft pulse: 1 to 1.15 to 1 over 12 frames
  const scale = since >= 0 && since < 12 ? 1 + 0.15 * Math.sin((since / 12) * Math.PI) : 1;
  return { n, scale };
}

// ---- helpers ----
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const EASE_OUT = Easing.out(Easing.cubic);
export const EASE_IN_OUT = Easing.inOut(Easing.cubic);

// 0 to 1 between frames a and b (clamped), with an optional easing.
export function ease(f: number, a: number, b: number, easing: (t: number) => number = EASE_OUT): number {
  return interpolate(f, [a, b], [0, 1], { ...clamp, easing });
}
// A value moving from x to y between frames a and b.
export function tween(f: number, a: number, b: number, x: number, y: number, easing: (t: number) => number = EASE_OUT): number {
  return x + (y - x) * ease(f, a, b, easing);
}

// Calm entrance: opacity 0 to 1 with a small rise, a no-bounce spring (damping 200) over about 15 frames.
export function rise(f: number, start: number, dist = 10, dur = 16): React.CSSProperties {
  const p = f < start ? 0 : spring({ frame: f - start, fps: FPS, config: { damping: 200 }, durationInFrames: dur });
  return { opacity: p, transform: `translateY(${((1 - p) * dist).toFixed(2)}px)` };
}
export function riseP(f: number, start: number, dur = 16): number {
  return f < start ? 0 : spring({ frame: f - start, fps: FPS, config: { damping: 200 }, durationInFrames: dur });
}

// A screen or caption that comes in at `inAt` (12 frames, from 8 px below) and leaves at `outAt` (7 frames, rising
// 8 px, most of the fade early). Returns null when it is fully hidden, so hidden screens are not drawn at all.
export function swap(f: number, inAt: number | null, outAt: number | null): React.CSSProperties | null {
  const pin = inAt === null ? 1 : ease(f, inAt, inAt + 12);
  const pout = outAt === null ? 0 : ease(f, outAt, outAt + 7);
  const o = pin * (1 - pout);
  if (o <= 0.001) return null;
  const y = (1 - pin) * 8 - pout * 8;
  return { opacity: o, transform: y === 0 ? undefined : `translateY(${y.toFixed(2)}px)` };
}

// Count up with an ease out (whole numbers).
export function count(f: number, a: number, b: number, from: number, to: number): number {
  return Math.round(tween(f, a, b, from, to));
}
