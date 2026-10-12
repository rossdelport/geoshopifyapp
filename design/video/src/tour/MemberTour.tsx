// The member tour: what a store gets after it joins, in the order a member lives it (docs/video/storyboard.md).
// 56 s, silent, loops. Made-up store and sample numbers, with an "Example" tag on every frame.
import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { ExampleTag } from "../TestCard";
import { AppWindow } from "./AppWindow";
import { Captions } from "./Caption";
import { geo, Layout } from "./geometry";
import { Pointer } from "./Pointer";
import { EndCard } from "./scenes/EndCard";
import { Fixes } from "./scenes/Fixes";
import { Money } from "./scenes/Money";
import { Outreach } from "./scenes/Outreach";
import { Results } from "./scenes/Results";
import { Setup } from "./scenes/Setup";
import { Weekly } from "./scenes/Weekly";
import { ease, LOOP_FADE, LOOP_START, S7, SCREEN, swap } from "./timeline";

const Screens: React.FC<{ f: number; layout: Layout }> = ({ f, layout }) => {
  const list: { style: React.CSSProperties | null; el: React.ReactNode }[] = [
    { style: swap(f, null, SCREEN.setupOut), el: <Setup f={f} layout={layout} /> },
    { style: swap(f, SCREEN.resultsIn, SCREEN.resultsOut), el: <Results f={f} layout={layout} /> },
    { style: swap(f, SCREEN.fixesIn, SCREEN.fixesOut), el: <Fixes f={f} layout={layout} /> },
    { style: swap(f, SCREEN.outreachIn, SCREEN.outreachOut), el: <Outreach f={f} layout={layout} /> },
    { style: swap(f, SCREEN.weeklyIn, SCREEN.weeklyOut), el: <Weekly f={f} layout={layout} /> },
    { style: swap(f, SCREEN.moneyIn, null), el: <Money f={f} layout={layout} /> },
  ];
  return (
    <>
      {list.map((s, i) =>
        s.style ? (
          <div key={i} style={{ position: "absolute", inset: 0, ...s.style }}>
            {s.el}
          </div>
        ) : null,
      )}
    </>
  );
};

// Everything on screen at global frame f.
export const TourFrame: React.FC<{ f: number; layout: Layout }> = ({ f, layout }) => {
  const g = geo(layout);
  const winOut = ease(f, S7, S7 + 20);
  return (
    <AbsoluteFill style={{ background: C.warm50 }}>
      <Captions f={f} layout={layout} />
      {winOut < 1 ? (
        <AppWindow f={f} layout={layout} style={{ opacity: 1 - winOut, transform: winOut > 0 ? `scale(${1 - 0.03 * winOut})` : undefined }}>
          <Screens f={f} layout={layout} />
        </AppWindow>
      ) : null}
      <EndCard f={f} layout={layout} />
      <Pointer f={f} layout={layout} />
      <ExampleTag style={{ position: "absolute", top: g.tag.top, right: g.tag.right, fontSize: g.tag.size, padding: layout === "phone" ? "5px 8px" : "6px 9px" }} />
    </AbsoluteFill>
  );
};

export const MemberTour: React.FC<{ layout: Layout; measure?: boolean }> = ({ layout, measure }) => {
  const f = useCurrentFrame();
  const root = useRef<HTMLDivElement>(null);
  // Debug: print the boxes of everything marked data-pt (pointer targets) to the render log.
  useLayoutEffect(() => {
    if (!measure || !root.current) return;
    const base = root.current.getBoundingClientRect();
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
    root.current.querySelectorAll<HTMLElement>("[data-pt]").forEach((el) => {
      const r = el.getBoundingClientRect();
      out[el.dataset.pt as string] = { x: Math.round(r.left - base.left), y: Math.round(r.top - base.top), w: Math.round(r.width), h: Math.round(r.height) };
    });
    console.log(`PT frame=${f} ${JSON.stringify(out)}`);
  }, [f, measure]);
  const loop = f >= LOOP_START ? (f - LOOP_START) / LOOP_FADE : 0;
  return (
    <AbsoluteFill ref={root} style={{ background: C.warm50 }}>
      <TourFrame f={f} layout={layout} />
      {loop > 0 ? (
        <AbsoluteFill style={{ opacity: loop }}>
          <TourFrame f={0} layout={layout} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
