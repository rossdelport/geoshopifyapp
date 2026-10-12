// Desktop: a navy arrow pointer that moves on a keyframe track and clicks. Phone: a tap dot that shows where
// a finger taps. Hidden in scenes 1 and 2 (the app sets itself up on its own); gone once it has opened the
// Dashboard in the money scene.
import React from "react";
import { C } from "../theme";
import { Layout } from "./geometry";
import { Pt, targets } from "./targets";
import { CLICK, EASE_IN_OUT, ease, S3, S4, S5, S6 } from "./timeline";

type Key = { f: number; p: Pt };

function desktopTrack(t: ReturnType<typeof targets>): Key[] {
  return [
    { f: S3, p: t.start },
    { f: S3 + 6, p: t.start },
    { f: S3 + 26, p: t.fixesTab },
    { f: S3 + 50, p: t.fixesTab },
    { f: S3 + 90, p: t.approve },
    { f: S3 + 150, p: t.approve },
    { f: S3 + 176, p: t.undo },
    { f: S4 + 4, p: t.undo },
    { f: S4 + 24, p: t.outreachTab },
    { f: S4 + 90, p: t.outreachTab },
    { f: S4 + 118, p: t.pitchRow },
    { f: S4 + 145, p: t.pitchRow },
    { f: S4 + 175, p: t.copyRest },
    { f: S5 + 4, p: t.copyRest },
    { f: S5 + 22, p: t.questionsTab },
    { f: S5 + 40, p: t.questionsTab },
    { f: S5 + 70, p: t.weeklyRest },
    { f: S6 + 4, p: t.weeklyRest },
    { f: S6 + 22, p: t.dashboardTab },
    { f: S6 + 40, p: t.dashboardTab },
    { f: S6 + 70, p: t.moneyRest },
  ];
}

function along(track: Key[], f: number): Pt {
  if (f <= track[0].f) return track[0].p;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1];
    const b = track[i];
    if (f <= b.f) {
      const k = ease(f, a.f, b.f, EASE_IN_OUT);
      return { x: a.p.x + (b.p.x - a.p.x) * k, y: a.p.y + (b.p.y - a.p.y) * k };
    }
  }
  return track[track.length - 1].p;
}

const CLICKS = [CLICK.fixesTab, CLICK.approve, CLICK.outreachTab, CLICK.pitchRow, CLICK.questionsTab, CLICK.dashboardTab];

// The ring that grows out of a click or tap: 0 to 22 px radius, opacity 0.3 to 0 over 14 frames.
const Ring: React.FC<{ f: number; at: number; p: Pt }> = ({ f, at, p }) => {
  const d = f - at;
  if (d < 0 || d > 14) return null;
  const r = 22 * (d / 14);
  return (
    <div
      style={{
        position: "absolute",
        left: p.x - r,
        top: p.y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        background: `rgba(11,12,43,${(0.3 * (1 - d / 14)).toFixed(3)})`,
      }}
    />
  );
};

export const Pointer: React.FC<{ f: number; layout: Layout }> = ({ f, layout }) => {
  const t = targets(layout);
  if (layout === "phone") return <TapDots f={f} t={t} />;
  // it fades once it has opened the Dashboard and come to rest, so it never sits idle on the money scene, the
  // report or the poster (frame 1325)
  const vis = ease(f, S3, S3 + 12) * (1 - ease(f, S6 + 96, S6 + 116));
  if (vis <= 0) return null;
  const p = along(desktopTrack(t), f);
  const pressed = CLICKS.some((c) => f >= c && f < c + 4);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: vis, pointerEvents: "none" }}>
      {CLICKS.map((c) => (
        <Ring key={c} f={f} at={c} p={p} />
      ))}
      <svg
        width={26}
        height={30}
        viewBox="0 0 26 30"
        style={{
          position: "absolute",
          left: p.x - 3,
          top: p.y - 2,
          transform: `scale(${pressed ? 0.9 : 1})`,
          transformOrigin: "3px 2px",
          filter: "drop-shadow(0 3px 5px rgba(11,12,43,.28))",
          overflow: "visible",
        }}
      >
        <path d="M3 2 L3 22.5 L8.4 17.4 L12 25.6 L15.6 24 L12 16 L19.6 16 Z" fill={C.navy} stroke="#fff" strokeWidth={1.5} strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// Phone taps: the dot shows up just before each tap, a ring grows from it, then it fades.
const TapDot: React.FC<{ f: number; at: number; p: Pt; hold?: number }> = ({ f, at, p, hold = 0 }) => {
  const o = ease(f, at - 10, at - 4) * (1 - ease(f, at + 10 + hold, at + 18 + hold));
  if (o <= 0) return null;
  return (
    <>
      <Ring f={f} at={at} p={p} />
      <div
        style={{
          position: "absolute",
          left: p.x - 11,
          top: p.y - 11,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "rgba(11,12,43,.18)",
          boxShadow: "0 0 0 2px #fff, 0 2px 6px rgba(11,12,43,.2)",
          opacity: o,
        }}
      />
    </>
  );
};

const TapDots: React.FC<{ f: number; t: ReturnType<typeof targets> }> = ({ f, t }) => (
  <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
    <TapDot f={f} at={CLICK.fixesTab} p={t.fixesTab} />
    <TapDot f={f} at={CLICK.approve} p={t.approve} />
    {/* rests on Undo while the tooltip shows; no tap */}
    <RestDot f={f} from={S3 + 168} to={S3 + 225} p={t.undo} />
    <TapDot f={f} at={CLICK.outreachTab} p={t.outreachTab} />
    <TapDot f={f} at={CLICK.pitchRow} p={t.pitchRow} />
    <TapDot f={f} at={CLICK.questionsTab} p={t.questionsTab} />
    <TapDot f={f} at={CLICK.dashboardTab} p={t.dashboardTab} />
  </div>
);

const RestDot: React.FC<{ f: number; from: number; to: number; p: Pt }> = ({ f, from, to, p }) => {
  const o = ease(f, from, from + 8) * (1 - ease(f, to - 8, to));
  if (o <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: p.x - 11,
        top: p.y - 11,
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: "rgba(11,12,43,.18)",
        boxShadow: "0 0 0 2px #fff, 0 2px 6px rgba(11,12,43,.2)",
        opacity: o,
      }}
    />
  );
};
