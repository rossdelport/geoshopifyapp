// Shared pieces for the explainer (Explainer.tsx): the two backgrounds (dark navy with a cobalt glow, soft pastel
// mesh), the text effects (a word that streaks in, words that rise out of a blur), the GEO mark, the AI logo coins
// and the cursor. Everything moves from the scene's own frame (useF), never from timers.
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT_HEAD } from "../fonts";
import { C } from "../theme";

export const W = 1280;
export const H = 800;
export const NIGHT = "#07081f"; // the dark scenes' base (a deeper navy than the page's, like the reference)

/** How fast the video plays its scenes: every scene is timed at 1x in "design frames" and played SPEED times
 *  faster (Ross, 13 Oct 2026: "speed it up a little"). Explainer.tsx shortens each scene to match. */
export const SPEED = 1.25;
/** The scene's own frame, in design frames. Use it instead of useCurrentFrame() in every explainer scene. */
export const useF = () => useCurrentFrame() * SPEED;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
/** Value from `from` to `to` while the frame goes from a to b (clamped, eased out). */
export const io = (f: number, a: number, b: number, from: number, to: number, easing = easeOut) =>
  interpolate(f, [a, b], [from, to], { ...clamp, easing });

// ---------- backgrounds ----------

/** Dark scene: deep navy, a cobalt glow from the bottom left and dotted columns at the sides. */
export const Dark: React.FC<{ children?: React.ReactNode; dots?: boolean }> = ({ children, dots = true }) => {
  const f = useF();
  const drift = Math.sin(f / 60) * 4;
  return (
    <AbsoluteFill style={{ background: NIGHT, overflow: "hidden" }}>
      <AbsoluteFill
        style={{ background: `radial-gradient(60% 80% at ${6 + drift}% 108%, rgba(64, 80, 176, 0.62), rgba(64, 80, 176, 0) 70%)` }}
      />
      {dots && (
        <AbsoluteFill
          style={{
            backgroundImage: "radial-gradient(rgba(150, 165, 245, 0.32) 1.3px, transparent 1.8px)",
            backgroundSize: "22px 22px",
            backgroundPosition: `0 ${f * 0.6}px`,
            WebkitMaskImage: "linear-gradient(90deg, #000 0%, transparent 16%, transparent 84%, #000 100%)",
            maskImage: "linear-gradient(90deg, #000 0%, transparent 16%, transparent 84%, #000 100%)",
            opacity: 0.8,
          }}
        />
      )}
      {children}
    </AbsoluteFill>
  );
};

const BLOBS = [
  { c: "#e3d8ff", x: 28, y: 72, r: 34 },
  { c: "#cdd6fd", x: 74, y: 26, r: 30 },
  { c: "#fbdcee", x: 60, y: 80, r: 24 },
  { c: "#fde7d2", x: 88, y: 70, r: 20 },
  { c: "#d7f2e8", x: 14, y: 20, r: 22 },
];

/** Light scene: near white with soft lilac, periwinkle, pink, peach and mint light drifting slowly. */
export const Light: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const f = useF();
  return (
    <AbsoluteFill style={{ background: "#f8f7fd", overflow: "hidden" }}>
      {BLOBS.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${b.x + Math.sin((f + i * 37) / 55) * 3}%`,
            top: `${b.y + Math.cos((f + i * 23) / 65) * 3}%`,
            width: `${b.r * 2}%`,
            aspectRatio: "1",
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: b.c,
            filter: "blur(80px)",
          }}
        />
      ))}
      {children}
    </AbsoluteFill>
  );
};

/** Centres its children in the frame. */
export const Center: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", ...style }}>
    {children}
  </AbsoluteFill>
);

// ---------- text ----------

export const head = (size: number, color: string, extra: React.CSSProperties = {}): React.CSSProperties => ({
  fontFamily: FONT_HEAD,
  fontWeight: 600,
  fontSize: size,
  letterSpacing: `${-size * 0.03}px`,
  lineHeight: 1.1,
  color,
  whiteSpace: "nowrap",
  ...extra,
});

/** One word or line that streaks in from the left, with a trail of blurred copies (like the reference's "People"). */
export const StreakIn: React.FC<{ text: string; size: number; color?: string; at?: number; trail?: string }> = ({
  text,
  size,
  color = C.white,
  at = 0,
  trail = "#7d8cf0",
}) => {
  const f = useF();
  const p = io(f, at, at + 14, 0, 1);
  const x = (1 - p) * -220;
  const base = head(size, color, { position: "absolute", left: "50%", top: "50%" });
  return (
    <AbsoluteFill>
      {[5, 4, 3, 2, 1].map((k) => (
        <span
          key={k}
          style={{
            ...base,
            color: trail,
            opacity: (1 - p) * (0.5 - k * 0.07),
            filter: `blur(${4 + k * 2}px)`,
            transform: `translate(-50%, -50%) translateX(${x - k * 26 * (1 - p)}px) scaleX(${1 + (1 - p) * 0.5})`,
          }}
        >
          {text}
        </span>
      ))}
      <span
        style={{
          ...base,
          opacity: io(f, at, at + 6, 0, 1),
          filter: `blur(${(1 - p) * 6}px)`,
          transform: `translate(-50%, -50%) translateX(${x}px) scaleX(${1 + (1 - p) * 0.25})`,
          textShadow: color === C.white ? "0 0 24px rgba(150, 165, 245, 0.35)" : undefined,
        }}
      >
        {text}
      </span>
    </AbsoluteFill>
  );
};

export type Word = string | { t: string; style?: React.CSSProperties };

/** Words that rise out of a blur one after another. */
export const Rise: React.FC<{
  words: Word[];
  style: React.CSSProperties;
  at?: number;
  gap?: number;
  stagger?: number;
}> = ({ words, style, at = 0, gap = 0.26, stagger = 4 }) => {
  const f = useF();
  return (
    <span style={{ ...style, display: "inline-flex", gap: `${gap}em`, alignItems: "baseline" }}>
      {words.map((w, i) => {
        const s = at + i * stagger;
        const word = typeof w === "string" ? { t: w } : w;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: io(f, s, s + 8, 0, 1),
              filter: `blur(${io(f, s, s + 12, 10, 0)}px)`,
              transform: `translateY(${io(f, s, s + 14, 22, 0)}px)`,
              ...word.style,
            }}
          >
            {word.t}
          </span>
        );
      })}
    </span>
  );
};

/** Text filled with the page's lilac to cobalt gradient. */
export const lilacText: React.CSSProperties = {
  backgroundImage: "linear-gradient(100deg, #c9c2ff 0%, #9ea9f5 45%, #7d8cf0 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

// ---------- brand and props ----------

/** The GEO mark: a periwinkle circle over a cobalt one (the nav's logo), drawn on light backgrounds. */
export const GeoMark: React.FC<{ size: number; spread?: number; style?: React.CSSProperties }> = ({ size, spread = 1, style }) => {
  const d = size * 0.675;
  const off = (size - d) * spread;
  return (
    <span style={{ position: "relative", width: size, height: size, display: "inline-block", flex: "none", ...style }}>
      <i style={{ position: "absolute", left: off, top: off, width: d, height: d, borderRadius: "50%", background: C.cobalt }} />
      <i
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: d,
          height: d,
          borderRadius: "50%",
          background: C.peri300,
          opacity: 0.92,
          mixBlendMode: "multiply",
        }}
      />
    </span>
  );
};

export type Engine = "chatgpt" | "gemini" | "perplexity" | "google" | "claude";

/** A white coin with an AI's logo. */
export const Coin: React.FC<{ engine: Engine; size: number; style?: React.CSSProperties }> = ({ engine, size, style }) => (
  <span
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: "radial-gradient(circle at 35% 28%, #ffffff 0%, #f3f4fa 60%, #dfe3f1 100%)",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.4), 0 0 26px rgba(125, 140, 240, 0.45), inset 0 -3px 6px rgba(0,0,0,0.1)",
      display: "grid",
      placeItems: "center",
      flex: "none",
      ...style,
    }}
  >
    <Img src={staticFile(`logos/${engine}.svg`)} style={{ width: size * 0.52, height: size * 0.52 }} />
  </span>
);

/** The mouse pointer. */
export const Cursor: React.FC<{ x: number; y: number; press?: number }> = ({ x, y, press = 0 }) => (
  <svg
    width="30"
    height="30"
    viewBox="0 0 24 24"
    style={{ position: "absolute", left: x, top: y, transform: `scale(${1 - press * 0.15})`, transformOrigin: "4px 3px", filter: "drop-shadow(0 4px 8px rgba(11,12,43,.35))" }}
  >
    <path d="M4 2.5 19.5 12l-6.6 1.6 3.6 6.9-2.6 1.3-3.6-6.9L5.5 19.6Z" fill={C.navy} stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);
