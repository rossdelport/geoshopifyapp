// Scene 7: the end card. What to expect, and when: the only place the "it takes time" line appears. Then the
// same button as the pricing cards. The last 18 frames fade back into scene 1 (MemberTour.tsx).
import React from "react";
import { FONT_BODY, FONT_HEAD } from "../../fonts";
import { C, GRAD_BTN, GRAD_MAIN } from "../../theme";
import { END } from "../data";
import { Layout } from "../geometry";
import { ease, rise, S7 } from "../timeline";

const L = (t: number) => S7 + t;
const TEXT_LILAC = "#45466e";
const SHADOW_CLAY = "0 1px 0 rgba(255,255,255,.9) inset, 0 24px 48px -24px rgba(56,64,160,.28), 0 8px 16px -10px rgba(56,64,160,.14)";

const StopDot: React.FC<{ n: number; size: number }> = ({ n, size }) => (
  <span
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: C.navy,
      color: C.white,
      display: "grid",
      placeItems: "center",
      fontFamily: FONT_BODY,
      fontSize: size * 0.44,
      fontWeight: 700,
      flex: "none",
      boxShadow: "0 0 0 4px rgba(255,255,255,.55)",
      position: "relative",
    }}
  >
    {n}
  </span>
);

export const EndCard: React.FC<{ f: number; layout: Layout }> = ({ f, layout }) => {
  const P = layout === "phone";
  const t = f - S7;
  if (t < 6) return null;
  const card = rise(f, L(6), 16, 20);
  const line = ease(t, 22, 52);

  const button = (
    <div style={{ ...rise(f, L(62), 8), display: "flex", flexDirection: "column", alignItems: P ? "stretch" : "center", gap: P ? 10 : 14 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          height: P ? 48 : 54,
          padding: P ? 0 : "0 32px",
          borderRadius: 10,
          color: C.white,
          background: GRAD_BTN,
          fontFamily: FONT_BODY,
          fontSize: P ? 16 : 18,
          fontWeight: 600,
          whiteSpace: "nowrap",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12), inset 0 1px 0 rgba(255,255,255,.18), 0 6px 14px -6px rgba(21,22,60,.6)",
        }}
      >
        {END.button}
      </span>
      <span style={{ ...rise(f, L(68), 4), fontFamily: FONT_BODY, fontSize: 14, color: TEXT_LILAC, textAlign: "center" }}>{END.small}</span>
    </div>
  );

  if (P) {
    const dot = 28;
    return (
      <div style={{ position: "absolute", left: 18, top: 52, width: 354, height: 548, borderRadius: 24, background: GRAD_MAIN, boxShadow: SHADOW_CLAY, padding: "30px 22px 24px", display: "flex", flexDirection: "column", ...card }}>
        <div style={{ ...rise(f, L(14), 8), fontFamily: FONT_HEAD, fontWeight: 500, fontSize: 28, letterSpacing: -0.9, lineHeight: 1.15, color: C.navy, textWrap: "balance" }}>{END.title}</div>
        <div style={{ position: "relative", marginTop: 28, display: "flex", flexDirection: "column", gap: 26 }}>
          <i style={{ position: "absolute", left: dot / 2 - 1, top: dot / 2, width: 2, height: `calc(100% - ${dot}px - 22px)`, background: "rgba(11,12,43,.2)", transformOrigin: "50% 0", transform: `scaleY(${line})` }} />
          {END.stops.map((s, i) => (
            <div key={s.label} style={{ ...rise(f, L(22 + i * 10), 8), display: "flex", gap: 14, alignItems: "flex-start" }}>
              <StopDot n={i + 1} size={dot} />
              <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 2 }}>
                <span style={{ fontFamily: FONT_HEAD, fontWeight: 500, fontSize: 19, letterSpacing: -0.4, color: C.navy, lineHeight: 1.2 }}>{s.label}</span>
                <span style={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.45, color: TEXT_LILAC }}>{s.line}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "auto" }}>{button}</div>
      </div>
    );
  }

  const dot = 36;
  return (
    <div style={{ position: "absolute", left: 120, top: 100, width: 1040, height: 600, borderRadius: 28, background: GRAD_MAIN, boxShadow: SHADOW_CLAY, padding: "48px 60px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", ...card }}>
      <div style={{ ...rise(f, L(14), 8), fontFamily: FONT_HEAD, fontWeight: 500, fontSize: 46, letterSpacing: -1.8, lineHeight: 1.15, color: C.navy }}>{END.title}</div>
      <div style={{ position: "relative", marginTop: 60, width: "100%", display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 24 }}>
        <i style={{ position: "absolute", top: dot / 2 - 1, left: "16.67%", width: "66.66%", height: 2, background: "rgba(11,12,43,.2)", transformOrigin: "0 50%", transform: `scaleX(${line})` }} />
        {END.stops.map((s, i) => (
          <div key={s.label} style={{ ...rise(f, L(22 + i * 10), 10), display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <StopDot n={i + 1} size={dot} />
            <span style={{ marginTop: 18, fontFamily: FONT_HEAD, fontWeight: 500, fontSize: 24, letterSpacing: -0.6, color: C.navy, lineHeight: 1.2 }}>{s.label}</span>
            <span style={{ marginTop: 8, maxWidth: 270, fontFamily: FONT_BODY, fontSize: 17, lineHeight: 1.5, color: TEXT_LILAC }}>{s.line}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 64 }}>{button}</div>
    </div>
  );
};
