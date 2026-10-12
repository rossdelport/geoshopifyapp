// Scene 5: every week. GEO asks AI again: the trend line (uneven, with a dip, no dates), the new score, one
// question gains an AI and another loses one, and a note that scores move up and down.
import React from "react";
import { Easing } from "remotion";
import { FONT_BODY } from "../../fonts";
import { C } from "../../theme";
import { ENGINES, WEEK } from "../data";
import { Layout } from "../geometry";
import { count, ease, S5 } from "../timeline";
import { Dot, H6, Kpi, Mark, Panel, ScreenTitle, Sub } from "../ui";

const L = (t: number) => S5 + t;
const START_SCORE = 29;

const Chart: React.FC<{ f: number; w: number; h: number; P: boolean }> = ({ f, w, h, P }) => {
  const t = f - S5;
  const padT = 10;
  const padB = P ? 8 : 22;
  const padL = 6;
  const padR = P ? 8 : 12;
  const lo = 26;
  const hi = 40;
  const x = (i: number) => padL + (i * (w - padL - padR)) / 7;
  const y = (v: number) => padT + ((hi - v) / (hi - lo)) * (h - padT - padB);
  const pts = WEEK.trend.map((v, i) => ({ x: x(i), y: y(v) }));
  const draw = ease(t, 38, 70, Easing.inOut(Easing.cubic));
  const p8 = ease(t, 132, 150, Easing.inOut(Easing.cubic));
  const end = { x: pts[6].x + (x(7) - pts[6].x) * p8, y: pts[6].y + (y(WEEK.next) - pts[6].y) * p8 };
  const all = p8 > 0 ? [...pts, end] : pts;
  const line = all.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const area = `${line} L${all[all.length - 1].x.toFixed(2)},${h - padB} L${pts[0].x.toFixed(2)},${h - padB} Z`;
  const clipW = p8 > 0 ? w : pts[0].x + (pts[6].x - pts[0].x) * draw + 1;
  const dotAt = p8 > 0 ? end : pts[6];
  const dotShow = p8 > 0 ? 1 : ease(t, 68, 74);
  const halo = t >= 150 && t < 166 ? (t - 150) / 16 : -1;
  const id = P ? "p" : "d";
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`wk-g-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.cobalt} stopOpacity={0.18} />
          <stop offset="1" stopColor={C.cobalt} stopOpacity={0} />
        </linearGradient>
        <clipPath id={`wk-c-${id}`}>
          <rect x={-4} y={-10} width={clipW + 4} height={h + 20} />
        </clipPath>
      </defs>
      {[32, 36].map((v) => (
        <line key={v} x1={0} x2={w} y1={y(v)} y2={y(v)} stroke="#eeeef4" strokeWidth={1} />
      ))}
      <line x1={0} x2={w} y1={y(START_SCORE)} y2={y(START_SCORE)} stroke="#9a9bab" strokeWidth={1} strokeDasharray="3 4" />
      {P ? null : (
        <text x={w} y={y(START_SCORE) + 18} textAnchor="end" style={{ fontFamily: FONT_BODY, fontSize: 13.5, fill: C.adminSub }}>
          {WEEK.startLabel}
        </text>
      )}
      <g clipPath={`url(#wk-c-${id})`}>
        <path d={area} fill={`url(#wk-g-${id})`} />
        <path d={line} fill="none" stroke={C.cobalt} strokeWidth={P ? 2 : 2.5} strokeLinejoin="round" strokeLinecap="round" />
      </g>
      {halo >= 0 ? <circle cx={dotAt.x} cy={dotAt.y} r={4 + 10 * halo} fill={C.cobalt} opacity={0.35 * (1 - halo)} /> : null}
      <circle cx={dotAt.x} cy={dotAt.y} r={P ? 3.5 : 4.5} fill="#fff" stroke={C.cobalt} strokeWidth={2} opacity={dotShow} />
    </svg>
  );
};

// A mark cell, with the before/after change for "yn" (named, then not) and "ny" (not, then named).
const Cell: React.FC<{ f: number; m: string; size: number; P: boolean }> = ({ f, m, size, P }) => {
  const t = f - S5;
  if (m === "x") {
    return <span style={{ fontFamily: FONT_BODY, fontSize: P ? 11 : 13.5, color: C.adminSub, whiteSpace: "nowrap" }}>{WEEK.noOverview}</span>;
  }
  if (m === "ny") {
    const at = 136;
    const ring = t >= at && t < at + 30 ? Math.sin(((t - at) / 30) * Math.PI) : 0;
    const on = t >= at;
    return <Mark named={on} size={size} scale={on ? 0.6 + 0.4 * ease(t, at, at + 8) : 1} ring={ring} />;
  }
  if (m === "yn") {
    const at = 140;
    const ring = t >= at && t < at + 30 ? Math.sin(((t - at) / 30) * Math.PI) : 0;
    const k = ease(t, at, at + 8);
    return (
      <span style={{ display: "grid" }}>
        <span style={{ gridArea: "1 / 1", opacity: 1 - k }}>
          <Mark named size={size} ring={ring} />
        </span>
        <span style={{ gridArea: "1 / 1", opacity: k }}>
          <Mark named={false} size={size} ring={ring} />
        </span>
      </span>
    );
  }
  return <Mark named={m === "y"} size={size} />;
};

export const Weekly: React.FC<{ f: number; layout: Layout }> = ({ f, layout }) => {
  const P = layout === "phone";
  const t = f - S5;
  const score = t < 132 ? WEEK.trend[6] : count(f, L(132), L(150), WEEK.trend[6], WEEK.next);
  const checking = Math.round(400 * ease(t, 72, 130, Easing.linear));
  const statusOut = ease(t, 150, 158);
  const noteIn = ease(t, 160, 172);
  const breathe = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin((t / 30) * Math.PI * 2));
  const rows = P ? WEEK.rows.slice(0, 3) : WEEK.rows;
  const fs = P ? 13 : 14.5;

  const status = (
    <div style={{ position: "relative", height: P ? 36 : 22, fontFamily: FONT_BODY, fontSize: P ? 13 : 14.5, lineHeight: P ? 1.35 : 1.4 }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: P ? "flex-start" : "center", gap: 8, color: C.adminText, opacity: (t >= 72 ? 1 : 0.0) * (1 - statusOut) }}>
        <Dot color={C.cobalt} size={P ? 7 : 8} style={{ opacity: breathe, marginTop: P ? 6 : 0 }} />
        <span className="tnum">{WEEK.checking(checking)}</span>
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: P ? "flex-start" : "center", gap: 8, color: C.adminText, fontWeight: 500, opacity: noteIn, transform: `translateY(${(6 * (1 - noteIn)).toFixed(2)}px)` }}>
        <span style={{ width: P ? 16 : 18, height: P ? 16 : 18, borderRadius: "50%", background: C.warm100, boxShadow: `inset 0 0 0 1px ${C.lineSoft}`, display: "grid", placeItems: "center", fontSize: P ? 10 : 11, fontWeight: 700, color: C.ink2, flex: "none", marginTop: P ? 1 : 0 }}>i</span>
        <span>
          {WEEK.wobble[0]}
          {P ? <br /> : " "}
          {WEEK.wobble[1]}
        </span>
      </div>
    </div>
  );

  const scoreBlock = (
    <div style={{ display: "flex", flexDirection: "column", gap: P ? 2 : 4 }}>
      <H6 size={P ? 13.5 : 15}>{WEEK.scoreTitle}</H6>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: P ? 0 : 4 }}>
        <Kpi size={P ? 32 : 46}>{score}</Kpi>
        <span style={{ fontFamily: FONT_BODY, fontSize: P ? 13 : 15, color: C.adminSub }}>/100</span>
      </div>
      <span className="tnum" style={{ fontFamily: FONT_BODY, fontSize: P ? 13 : 15, fontWeight: 600, color: C.greenInk }}>
        {WEEK.since(score - START_SCORE)}
      </span>
    </div>
  );

  const colW = P ? 31 : 128;
  const table = (
    <Panel style={{ padding: P ? "6px 0 8px" : "6px 0 6px" }}>
      <div style={{ display: "grid", gridTemplateColumns: `minmax(0,1fr) repeat(4, ${colW}px)`, alignItems: "center", padding: P ? "0 8px 0 12px" : "0 12px 0 20px", borderBottom: "1px solid #ebebeb", height: P ? 30 : 40 }}>
        <span style={{ fontFamily: FONT_BODY, fontSize: P ? 12.5 : 14, fontWeight: 500, color: C.adminSub }}>{WEEK.qHead}</span>
        {ENGINES.map((e, i) => (
          <span key={e} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: C.adminSub, whiteSpace: "nowrap" }}>
            <Dot color={C[e]} size={P ? 9 : 8} />
            {P ? null : WEEK.colHead[i]}
          </span>
        ))}
      </div>
      {rows.map((r, ri) => (
        <div
          key={r.q}
          style={{
            display: "grid",
            gridTemplateColumns: `minmax(0,1fr) repeat(4, ${colW}px)`,
            alignItems: "center",
            padding: P ? "0 8px 0 12px" : "0 12px 0 20px",
            minHeight: P ? 38 : 50,
            borderBottom: ri < rows.length - 1 ? "1px solid #ebebeb" : undefined,
          }}
        >
          <span style={{ fontFamily: FONT_BODY, fontSize: fs, fontWeight: 500, color: C.adminText, lineHeight: 1.3, paddingRight: 8 }}>{r.q}</span>
          {r.marks.map((m, mi) => (
            <span key={mi} style={{ display: "flex", justifyContent: "center" }}>
              <Cell f={f} m={m} size={P ? 20 : 26} P={P} />
            </span>
          ))}
        </div>
      ))}
      {P ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", padding: "7px 12px 0", borderTop: "1px solid #ebebeb" }}>
          {ENGINES.map((e, i) => (
            <span key={e} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FONT_BODY, fontSize: 12.5, color: C.adminSub, whiteSpace: "nowrap" }}>
              <Dot color={C[e]} size={7} />
              {WEEK.colHead[i]}
            </span>
          ))}
        </div>
      ) : null}
    </Panel>
  );

  if (P) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
        <Panel style={{ padding: "11px 12px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {scoreBlock}
            <div style={{ marginLeft: "auto" }}>
              <Chart f={f} w={128} h={70} P />
            </div>
          </div>
          {status}
        </Panel>
        {table}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      <ScreenTitle title={WEEK.title} right={<Sub size={14}>{WEEK.note}</Sub>} />
      <Panel style={{ display: "flex", gap: 28, padding: "18px 22px 16px" }}>
        <div style={{ width: 230, flex: "none", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>{scoreBlock}</div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <Chart f={f} w={590} h={118} P={false} />
          {status}
        </div>
      </Panel>
      {table}
    </div>
  );
};
