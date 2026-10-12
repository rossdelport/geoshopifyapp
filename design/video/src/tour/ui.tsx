// Small building blocks for the member tour, styled like the page's sample app (parts/20m-money.css, base.css).
import React from "react";
import { FONT_BODY, FONT_HEAD } from "../fonts";
import { C } from "../theme";
import type { Engine } from "./data";

export const AMBER_BG = "#fdf3e2";
export const AMBER_INK = "#9a6411";
export const OTHER = "#a3a3b5";
export const RIVAL_BAR = "#a9a8a2";
export const TRACK = "#f0f0f4";
export const LINE2 = "#ebebeb";
export const PANEL_SHADOW = "0 1px 0 rgba(0,0,0,.07), inset 0 0 0 1px rgba(0,0,0,.04)";

export const engineColor = (e: Engine | "other"): string => (e === "other" ? OTHER : C[e]);

// ---- icons (Lucide paths, the same set the page uses) ----
const ICONS = {
  dashboard: (
    <>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </>
  ),
  question: (
    <>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  wand: (
    <>
      <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" />
      <path d="m14 7 3 3" />
      <path d="M5 6v4" />
      <path d="M19 14v4" />
      <path d="M10 2v2" />
      <path d="M7 8H3" />
      <path d="M21 16h-4" />
      <path d="M11 3H9" />
    </>
  ),
  send: (
    <>
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
      <path d="m21.854 2.147-10.94 10.939" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  file: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </>
  ),
  title: (
    <>
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6" />
      <path d="M12 4v16" />
    </>
  ),
  mail: (
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  copy: (
    <>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </>
  ),
  open: (
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>
  ),
  book: (
    <>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </>
  ),
  dollar: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M15.5 8.5h-5a2 2 0 1 0 0 4h3a2 2 0 1 1 0 4h-5" />
      <path d="M12 6.5v11" />
    </>
  ),
  bag: (
    <>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  cursor: (
    <>
      <path d="M12.586 12.586 19 19" />
      <path d="M3.688 3.037a.497.497 0 0 0-.651.651l6.5 15.999a.501.501 0 0 0 .947-.062l1.569-6.083a2 2 0 0 1 1.448-1.479l6.124-1.579a.5.5 0 0 0 .063-.947z" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
};
export type IconName = keyof typeof ICONS;

export const Icon: React.FC<{ name: IconName; size?: number; stroke?: number; color?: string; style?: React.CSSProperties }> = ({
  name,
  size = 16,
  stroke = 1.8,
  color = "currentColor",
  style,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke={color}
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flex: "none", display: "block", ...style }}
  >
    {ICONS[name]}
  </svg>
);

// ---- atoms ----
export const Panel: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
  <div style={{ background: C.white, borderRadius: 12, boxShadow: PANEL_SHADOW, padding: "18px 20px", minWidth: 0, ...style }}>{children}</div>
);

export const H6: React.FC<{ size?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ size = 15, style, children }) => (
  <div style={{ fontFamily: FONT_BODY, fontSize: size, fontWeight: 650, color: C.adminText, lineHeight: 1.3, whiteSpace: "nowrap", ...style }}>
    {children}
  </div>
);

export const Sub: React.FC<{ size?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ size = 14, style, children }) => (
  <div style={{ fontFamily: FONT_BODY, fontSize: size, fontWeight: 400, color: C.adminSub, lineHeight: 1.4, ...style }}>{children}</div>
);

export const ScreenTitle: React.FC<{ title: string; size?: number; right?: React.ReactNode; style?: React.CSSProperties }> = ({
  title,
  size = 20,
  right,
  style,
}) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: size + 12, ...style }}>
    <div style={{ fontFamily: FONT_BODY, fontSize: size, fontWeight: 700, color: C.adminText, letterSpacing: -0.2, whiteSpace: "nowrap", lineHeight: 1.2 }}>
      {title}
    </div>
    {right}
  </div>
);

type PillTone = "grey" | "green" | "amber" | "white" | "navy";
const PILL: Record<PillTone, React.CSSProperties> = {
  grey: { background: C.warm100, color: C.ink2, boxShadow: `inset 0 0 0 1px ${C.lineSoft}` },
  green: { background: C.greenBg, color: C.greenInk },
  amber: { background: AMBER_BG, color: AMBER_INK },
  white: { background: C.white, color: C.adminText, boxShadow: `inset 0 0 0 1px ${C.lineSoft}` },
  navy: { background: C.navy, color: C.white },
};
export const Pill: React.FC<{ tone?: PillTone; size?: number; h?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({
  tone = "grey",
  size = 14,
  h,
  style,
  children,
}) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: h ?? Math.round(size * 1.95),
      padding: `0 ${Math.round(size * 0.78)}px`,
      borderRadius: 100,
      fontFamily: FONT_BODY,
      fontSize: size,
      fontWeight: 500,
      lineHeight: 1,
      whiteSpace: "nowrap",
      flex: "none",
      ...PILL[tone],
      ...style,
    }}
  >
    {children}
  </span>
);

export const Dot: React.FC<{ color: string; size?: number; style?: React.CSSProperties }> = ({ color, size = 8, style }) => (
  <i style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flex: "none", ...style }} />
);

// A bar that grows from the left: `p` is its share of the track (0 to 1).
export const Bar: React.FC<{ p: number; color: string; h?: number; track?: string; style?: React.CSSProperties }> = ({
  p,
  color,
  h = 8,
  track = TRACK,
  style,
}) => (
  <div style={{ height: h, borderRadius: h / 2, background: track, overflow: "hidden", ...style }}>
    <div style={{ width: `${Math.max(0, Math.min(1, p)) * 100}%`, height: "100%", borderRadius: h / 2, background: color }} />
  </div>
);

// Step status: an empty grey ring, a turning spinner, or a green tick that pops from 0.6 to 1.
export const StepIcon: React.FC<{ state: "idle" | "spin" | "done"; f: number; doneAt?: number; size?: number }> = ({ state, f, doneAt = 0, size = 20 }) => {
  if (state === "done") {
    const s = 0.6 + 0.4 * Math.min(1, Math.max(0, (f - doneAt) / 8));
    return (
      <span style={{ width: size, height: size, borderRadius: "50%", background: C.greenBg, color: C.greenInk, display: "grid", placeItems: "center", flex: "none", transform: `scale(${s})`, boxShadow: "inset 0 0 0 1px rgba(31,157,85,.3)" }}>
        <Icon name="check" size={size * 0.6} stroke={3} />
      </span>
    );
  }
  if (state === "spin") {
    const r = size / 2 - 2;
    const c = 2 * Math.PI * r;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: "none", transform: `rotate(${(f * 12) % 360}deg)` }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e3e3ea" strokeWidth={2.2} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.navy} strokeWidth={2.2} strokeLinecap="round" strokeDasharray={`${c * 0.28} ${c}`} />
      </svg>
    );
  }
  return <span style={{ width: size, height: size, borderRadius: "50%", boxShadow: "inset 0 0 0 1.5px #d4d4dc", flex: "none", background: C.white }} />;
};

// Named / not named marks, as on the page's sample app.
export const Mark: React.FC<{ named: boolean; size?: number; scale?: number; ring?: number }> = ({ named, size = 24, scale = 1, ring = 0 }) => (
  <span
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      display: "grid",
      placeItems: "center",
      flex: "none",
      transform: scale === 1 ? undefined : `scale(${scale})`,
      background: named ? C.greenBg : C.white,
      color: C.greenInk,
      boxShadow: [named ? "inset 0 0 0 1px rgba(31,157,85,.3)" : "inset 0 0 0 1.5px #d9d9e0", ring > 0 ? `0 0 0 3px rgba(255,255,255,${ring}), 0 0 0 6px rgba(169,168,162,${0.55 * ring})` : ""]
        .filter(Boolean)
        .join(", "),
    }}
  >
    {named ? <Icon name="check" size={size * 0.52} stroke={3} /> : <span style={{ width: size * 0.34, height: 2, borderRadius: 1, background: "#c4c4cc" }} />}
  </span>
);

export const Kpi: React.FC<{ size: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ size, style, children }) => (
  <span className="tnum" style={{ fontFamily: FONT_HEAD, fontSize: size, fontWeight: 600, letterSpacing: -0.03 * size, color: C.navy, lineHeight: 1.05, whiteSpace: "nowrap", ...style }}>
    {children}
  </span>
);

// Buttons: dark (navy gradient), light (white with a grey line).
export const Btn: React.FC<{ tone?: "dark" | "light"; size?: number; h?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({
  tone = "dark",
  size = 14,
  h = 38,
  style,
  children,
}) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      height: h,
      padding: "0 16px",
      borderRadius: 9,
      fontFamily: FONT_BODY,
      fontSize: size,
      fontWeight: 600,
      lineHeight: 1,
      whiteSpace: "nowrap",
      flex: "none",
      ...(tone === "dark"
        ? { color: C.white, background: "linear-gradient(180deg, #373868 0%, #15163c 100%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.16), 0 0 0 1px #15163c, 0 2px 4px -1px rgba(21,22,60,.4)" }
        : { color: C.adminText, background: C.white, boxShadow: "inset 0 0 0 1px #d4d4d4, 0 1px 0 rgba(0,0,0,.05)" }),
      ...style,
    }}
  >
    {children}
  </span>
);
