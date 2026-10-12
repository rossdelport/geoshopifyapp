// Scene 2: the starting point. Score out of 100 with a score for each AI, who AI recommends instead, and the
// sites AI trusts. Saved as the starting point. (Dashboard tab; the Fixes badge appears in AppWindow.)
import React from "react";
import { FONT_BODY } from "../../fonts";
import { C } from "../../theme";
import { ENGINE_NAME, START } from "../data";
import { Layout } from "../geometry";
import { count, ease, rise, S2, swap } from "../timeline";
import { Bar, Dot, H6, Kpi, Panel, Pill, RIVAL_BAR, ScreenTitle, Sub, TRACK } from "../ui";

const L = (t: number) => S2 + t; // scene 2 local frame to global

const Ring: React.FC<{ f: number; size: number; stroke: number; numSize: number }> = ({ f, size, stroke, numSize }) => {
  const score = count(f, L(64), L(104), 0, START.score);
  const p = ease(f, L(64), L(104)) * (START.score / 100);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.cobalt} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * p).toFixed(2)} ${c}`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <Kpi size={numSize}>{score}</Kpi>
        <span style={{ fontFamily: FONT_BODY, fontSize: numSize * 0.32, color: C.adminSub, lineHeight: 1 }}>{START.scoreOf}</span>
      </div>
    </div>
  );
};

// Rival rows: name and share on one line, the bar under it. "You" gets a navy chip, a warm row and the purple bar.
const Rivals: React.FC<{ f: number; P: boolean; rows: typeof START.rivals }> = ({ f, P, rows }) => {
  const ring = Math.sin(Math.min(1, Math.max(0, (f - L(200)) / 30)) * Math.PI);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: P ? 4 : 8 }}>
      {rows.map((r, i) => {
        const p = ease(f, L(80) + i * 5, L(110) + i * 5) * (r.pct / 100);
        return (
          <div
            key={r.name}
            style={{
              padding: P ? "5px 8px" : "8px 10px",
              borderRadius: 9,
              background: r.you ? C.warm50 : undefined,
              boxShadow: r.you ? `inset 0 0 0 1px ${C.lineSoft}${ring > 0 ? `, 0 0 0 ${(1.5 * ring).toFixed(2)}px rgba(11,12,43,${(0.55 * ring).toFixed(3)})` : ""}` : undefined,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: FONT_BODY, fontSize: P ? 13 : 15, color: C.adminText, fontWeight: r.you ? 600 : 400, whiteSpace: "nowrap" }}>
              {r.name}
              {r.you ? (
                <em style={{ fontStyle: "normal", padding: "2px 6px", borderRadius: 5, background: C.navy, color: C.white, fontSize: P ? 11 : 12, fontWeight: 700, lineHeight: 1.3 }}>{START.you}</em>
              ) : null}
              <b className="tnum" style={{ marginLeft: "auto", fontWeight: 650 }}>
                {Math.round(p * 100)}%
              </b>
            </div>
            <Bar p={p} color={r.you ? C.cobalt : RIVAL_BAR} h={P ? 5 : 9} style={{ marginTop: P ? 4 : 7 }} />
          </div>
        );
      })}
    </div>
  );
};

const Sites: React.FC<{ f: number; P: boolean; start: number }> = ({ f, P, start }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: P ? 6 : 10 }}>
    {START.sites.map((s, i) => (
      <div
        key={s.domain}
        style={{
          ...rise(f, start + i * 6, 8),
          padding: P ? "7px 10px" : "10px 12px",
          borderRadius: 10,
          boxShadow: `inset 0 0 0 1px ${C.line}`,
          display: "flex",
          flexDirection: P ? "row" : "column",
          alignItems: P ? "center" : "stretch",
          gap: P ? 8 : 7,
        }}
      >
        <span style={{ fontFamily: FONT_BODY, fontSize: P ? 13 : 15, fontWeight: 600, color: C.adminText, whiteSpace: "nowrap" }}>{s.domain}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: P ? "auto" : 0 }}>
          <Pill tone={"own" in s ? "green" : "grey"} size={P ? 12.5 : 14} h={P ? 22 : 26}>
            {s.type}
          </Pill>
          {P ? null : (
            <span className="tnum" style={{ marginLeft: "auto", fontFamily: FONT_BODY, fontSize: 14, color: C.adminSub }}>
              {s.count}
            </span>
          )}
        </div>
      </div>
    ))}
  </div>
);

const EnginePills: React.FC<{ f: number; P: boolean }> = ({ f, P }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: P ? 3 : 7 }}>
    {START.engineScores.map(([e, n], i) =>
      P ? (
        <div key={e} style={{ ...rise(f, L(96) + i * 6, 6), display: "flex", alignItems: "center", gap: 7, fontFamily: FONT_BODY, fontSize: 13, color: C.adminText, height: 20 }}>
          <Dot color={C[e]} />
          {ENGINE_NAME[e]}
          <b className="tnum" style={{ marginLeft: "auto", fontWeight: 650 }}>
            {n}
          </b>
        </div>
      ) : (
        <span key={e} style={rise(f, L(96) + i * 6, 6)}>
          <Pill tone="white" size={14} h={30} style={{ width: "100%" }}>
            <Dot color={C[e]} />
            {ENGINE_NAME[e]}
            <b className="tnum" style={{ marginLeft: "auto", fontWeight: 650, color: C.adminText }}>
              {n}
            </b>
          </Pill>
        </span>
      ),
    )}
  </div>
);

export const Results: React.FC<{ f: number; layout: Layout }> = ({ f, layout }) => {
  const P = layout === "phone";
  if (P) {
    const showB = swap(f, null, L(160));
    const showC = swap(f, L(164), null);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
        <Panel style={{ padding: "12px 12px", display: "flex", gap: 12, alignItems: "center" }}>
          <Ring f={f} size={84} stroke={8} numSize={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <H6 size={13.5} style={{ marginBottom: 5 }}>
              {START.scoreTitle}
            </H6>
            <EnginePills f={f} P />
          </div>
        </Panel>
        <div style={{ position: "relative", flex: 1 }}>
          {showB ? (
            <Panel style={{ position: "absolute", inset: 0, padding: "11px 8px 8px", ...showB }}>
              <H6 size={13.5} style={{ padding: "0 4px", marginBottom: 6 }}>
                {START.rivalsTitle}
              </H6>
              <Rivals f={f} P rows={START.rivals.slice(0, 4)} />
            </Panel>
          ) : null}
          {showC ? (
            <Panel style={{ position: "absolute", inset: 0, padding: "11px 12px 8px", ...showC }}>
              <H6 size={13.5} style={{ marginBottom: 2 }}>
                {START.sitesTitle}
              </H6>
              <Sub size={13} style={{ marginBottom: 8 }}>
                {START.sitesSub}
              </Sub>
              <Sites f={f} P start={L(170)} />
            </Panel>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      <ScreenTitle title={START.title} right={<Sub size={14}>{START.note}</Sub>} />
      <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
        <Panel style={{ width: 256, flex: "none", display: "flex", flexDirection: "column", gap: 14 }}>
          <H6>{START.scoreTitle}</H6>
          <Ring f={f} size={124} stroke={11} numSize={42} />
          <EnginePills f={f} P={false} />
          <Sub size={14} style={{ ...rise(f, L(110), 6) }}>
            {START.scoreLine}
          </Sub>
        </Panel>
        <Panel style={{ flex: 1, padding: "18px 12px 14px" }}>
          <div style={{ padding: "0 10px" }}>
            <H6>{START.rivalsTitle}</H6>
            <Sub size={14} style={{ marginTop: 2, marginBottom: 10 }}>
              {START.rivalsSub}
            </Sub>
          </div>
          <Rivals f={f} P={false} rows={START.rivals} />
        </Panel>
        <Panel style={{ width: 290, flex: "none" }}>
          <H6>{START.sitesTitle}</H6>
          <Sub size={14} style={{ marginTop: 2, marginBottom: 12 }}>
            {START.sitesSub}
          </Sub>
          <Sites f={f} P={false} start={L(110)} />
        </Panel>
      </div>
    </div>
  );
};
