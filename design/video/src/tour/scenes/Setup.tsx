// Scene 1 (and the first 50 frames of scene 2): the app sets itself up. The four real setup steps, products
// read, questions written in topics, then the AI answers read one by one (Dashboard tab, no pointer).
import React from "react";
import { Easing } from "remotion";
import { FONT_BODY } from "../../fonts";
import { C } from "../../theme";
import { ENGINE_NAME, ENGINES, SETUP } from "../data";
import { Layout } from "../geometry";
import { count, rise, S2, tween } from "../timeline";
import { Bar, Dot, Panel, Pill, StepIcon } from "../ui";

// Global frames (scene 1 starts at 0).
const T = {
  s1: [8, 36],
  s2: [40, 100],
  chips: [48, 56, 64, 72, 80],
  summary: 104,
  s3: [112, S2 + 40],
  s4: [S2 + 40, S2 + 48],
};

function state(f: number, [a, b]: number[]): "idle" | "spin" | "done" {
  return f < a ? "idle" : f < b ? "spin" : "done";
}

// AI answers read: 0 to 140 during scene 1, then 140 to 400 in scene 2's first 40 frames.
export function answersRead(f: number): number {
  if (f < S2) return tween(f, T.s3[0], S2 - 1, 0, 140, Easing.linear);
  return tween(f, S2, S2 + 40, 140, 400, Easing.inOut(Easing.quad));
}

const Step: React.FC<{ f: number; span: number[]; label: string; right?: React.ReactNode; P: boolean; children?: React.ReactNode }> = ({ f, span, label, right, P, children }) => {
  const st = state(f, span);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: P ? 10 : 12, minHeight: P ? 22 : 26 }}>
        <StepIcon state={st} f={f} doneAt={span[1]} size={P ? 18 : 22} />
        <span style={{ fontFamily: FONT_BODY, fontSize: P ? 14 : 16, fontWeight: st === "idle" ? 500 : 600, color: st === "idle" ? C.adminSub : C.adminText, whiteSpace: "nowrap" }}>
          {label}
        </span>
        <span style={{ marginLeft: "auto" }}>{right}</span>
      </div>
      {children ? <div style={{ paddingLeft: P ? 28 : 34 }}>{children}</div> : null}
    </div>
  );
};

const QChip: React.FC<{ P: boolean; children: React.ReactNode; style?: React.CSSProperties }> = ({ P, children, style }) => (
  <Pill tone="grey" size={P ? 13 : 14} h={P ? 24 : 30} style={{ fontWeight: 500, ...style }}>
    {children}
  </Pill>
);

export const Setup: React.FC<{ f: number; layout: Layout }> = ({ f, layout }) => {
  const P = layout === "phone";
  const products = count(f, T.s1[0], T.s1[1], 0, SETUP.products);
  const read = answersRead(f);
  const running3 = state(f, T.s3) === "spin";
  const allChips = SETUP.topics.flatMap((t, ti) => t.chips.map((c, ci) => ({ c, ti, first: ci === 0 })));
  const shown = P ? allChips.filter((x) => x.c !== SETUP.topics[0].chips[1]) : allChips;
  const muted = { fontFamily: FONT_BODY, fontSize: P ? 13 : 14, color: C.adminSub } as const;

  return (
    <Panel style={{ padding: P ? "14px 14px" : "22px 26px", display: "flex", flexDirection: "column", gap: P ? 8 : 16 }}>
      <div style={{ fontFamily: FONT_BODY, fontSize: P ? 15 : 20, fontWeight: 700, color: C.adminText, letterSpacing: -0.2, marginBottom: P ? 0 : 4 }}>{SETUP.title}</div>

      <Step f={f} span={T.s1} label={SETUP.steps[0]} P={P} right={f >= T.s1[0] ? <span className="tnum" style={muted}>{products} {SETUP.productsUnit}</span> : null} />

      <Step f={f} span={T.s2} label={SETUP.steps[1]} P={P}>
        {P ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            {shown.map((x, i) => (
              <span key={x.c} style={rise(f, T.chips[i], 8)}>
                <QChip P>{x.c}</QChip>
              </span>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 26px", marginTop: 12 }}>
            {SETUP.topics.map((t, ti) => {
              const firstIndex = allChips.findIndex((x) => x.ti === ti);
              return (
                <div key={t.label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ ...rise(f, T.chips[firstIndex], 8), fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: C.text2 }}>{t.label}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {t.chips.map((c, ci) => (
                      <span key={c} style={rise(f, T.chips[firstIndex + ci], 8)}>
                        <QChip P={false}>{c}</QChip>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ ...rise(f, T.summary, 6), marginTop: P ? 5 : 12, fontFamily: FONT_BODY, fontSize: P ? 13 : 15, lineHeight: 1.4, color: C.adminSub }}>
          <b style={{ fontWeight: 650, color: C.adminText }}>{SETUP.summaryA}</b>
          {P ? <br /> : <span> &middot; </span>}
          {SETUP.summaryB}
        </div>
      </Step>

      <Step f={f} span={T.s3} label={SETUP.steps[2]} P={P}>
        <div style={{ display: "flex", alignItems: "center", gap: P ? 10 : 12, marginTop: P ? 5 : 10 }}>
          <Bar p={read / SETUP.answersTotal} color={C.cobalt} h={P ? 6 : 8} style={{ flex: P ? "1 1 auto" : "0 0 340px", minWidth: 0 }} />
          <span className="tnum" style={{ ...muted, whiteSpace: "nowrap", color: f >= T.s3[0] ? C.adminText : C.adminSub }}>{SETUP.answersRead(Math.round(read))}</span>
        </div>
        {P ? null : (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {ENGINES.map((e, i) => {
              const breathe = running3 ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(((f - i * 7) / 30) * Math.PI * 2)) : 1;
              return (
                <Pill key={e} tone="white" size={14} h={30}>
                  <Dot color={C[e]} style={{ opacity: breathe }} />
                  {ENGINE_NAME[e]}
                </Pill>
              );
            })}
          </div>
        )}
      </Step>

      <Step f={f} span={T.s4} label={SETUP.steps[3]} P={P} />
    </Panel>
  );
};
