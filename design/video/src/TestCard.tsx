// 3-second pipeline test (loops if rendered longer with --duration):the site's fonts at the sizes the page uses, a counting number, a growing bar and
// small text, on the page's colours. Not part of the home page video.
import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_BODY, FONT_HEAD } from "./fonts";
import { C, GRAD_MAIN, SHADOW_LG } from "./theme";

export type Layout = "desktop" | "phone";

// The persistent "Example" tag, styled like .vid-tag / .sample-tag on the page.
export const ExampleTag: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <span
    style={{
      fontFamily: FONT_BODY,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: ".04em",
      textTransform: "uppercase",
      lineHeight: 1,
      color: C.text2,
      background: C.white,
      borderRadius: 6,
      padding: "5px 8px",
      boxShadow: `inset 0 0 0 1px ${C.line}`,
      ...style,
    }}
  >
    Example
  </span>
);

export const TestCard: React.FC<{ layout: Layout }> = ({ layout }) => {
  // Loops every 3 s, so `--duration=1500` gives a 50 s benchmark with motion all the way through.
  const frame = useCurrentFrame() % 90;
  const { fps } = useVideoConfig();
  const phone = layout === "phone";

  const rise = spring({ frame, fps, config: { damping: 200 } });
  const revenue = Math.round(
    interpolate(frame, [12, 66], [0, 1240], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }),
  );
  const score = interpolate(frame, [20, 70], [38, 52], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });

  return (
    <AbsoluteFill style={{ background: C.warm50, fontFamily: FONT_BODY, color: C.text }}>
      <ExampleTag style={{ position: "absolute", top: phone ? 14 : 22, right: phone ? 14 : 22 }} />
      <div
        style={{
          position: "absolute",
          inset: phone ? "56px 20px 24px" : "70px 96px 60px",
          display: "flex",
          flexDirection: phone ? "column" : "row",
          gap: phone ? 22 : 56,
          alignItems: phone ? "stretch" : "center",
          opacity: rise,
          transform: `translateY(${(1 - rise) * 16}px)`,
        }}
      >
        <div style={{ flex: 1 }}>
          <h2
            style={{
              fontFamily: FONT_HEAD,
              fontWeight: 500,
              color: C.navy,
              fontSize: phone ? 32 : 48,
              letterSpacing: phone ? "-1.2px" : "-2px",
              lineHeight: 1.15,
            }}
          >
            Your first month with GEO
          </h2>
          <p style={{ marginTop: 16, fontSize: phone ? 15 : 16, lineHeight: 1.7, color: C.text, maxWidth: 460 }}>
            Fixes go live the day you approve them. AI answers can take weeks to catch up, so we check every week and
            show you what changed.
          </p>
          <p style={{ marginTop: 12, fontSize: 12.5, color: C.text2 }}>
            Small text check: 11 px tags, 12.5 px notes, ÀÉÎÕÜ ąčęłż “quotes” 1,240 · 38%
          </p>
        </div>

        <div
          style={{
            width: phone ? "auto" : 420,
            background: C.white,
            borderRadius: 16,
            padding: 12,
            boxShadow: `0 0 0 1px rgba(11, 12, 43, 0.05), ${SHADOW_LG}`,
          }}
        >
          <div style={{ background: C.adminMain, borderRadius: 12, padding: "16px 18px", color: C.adminText, fontSize: 13, lineHeight: 1.45 }}>
            <h6 style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 650, color: C.adminText, margin: "0 0 8px" }}>
              Sales from AI this month
            </h6>
            <div className="tnum" style={{ fontFamily: FONT_HEAD, fontSize: 26, letterSpacing: "-0.8px", fontWeight: 600, color: C.navy, lineHeight: 1.1 }}>
              US${revenue.toLocaleString("en-US")}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: C.greenInk }}>Sample numbers</div>

            <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.adminSub }}>
              <span>Visibility score</span>
              <b className="tnum" style={{ color: C.adminText, fontWeight: 650 }}>{Math.round(score)} / 100</b>
            </div>
            <div style={{ marginTop: 6, height: 10, borderRadius: 99, background: C.white, boxShadow: `inset 0 0 0 1px ${C.line}` }}>
              <div style={{ width: `${score}%`, height: "100%", borderRadius: 99, background: C.cobalt }} />
            </div>
            <div style={{ marginTop: 14, height: 28, borderRadius: 8, background: GRAD_MAIN }} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
