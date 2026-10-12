// Scene 6: the money. Sales, orders and clicks from AI against the store's starting point, split by assistant,
// with the honest fine print. Then the monthly email report slides in.
import React from "react";
import { FONT_BODY, FONT_HEAD } from "../../fonts";
import { C, SHADOW_LG } from "../../theme";
import { MONEY, money, num } from "../data";
import { Layout } from "../geometry";
import { count, ease, rise, S6, tween } from "../timeline";
import { Bar, Btn, engineColor, H6, Icon, IconName, Kpi, Panel, Pill, ScreenTitle } from "../ui";

const L = (t: number) => S6 + t;
const KPI_ICONS: IconName[] = ["dollar", "bag", "cursor"];
const KPI_TIMES = [
  [40, 84],
  [44, 84],
  [48, 88],
];

const Seg: React.FC<{ P: boolean }> = ({ P }) => (
  <span style={{ display: "inline-grid", gridTemplateColumns: "1fr 1fr", padding: 2, borderRadius: 9, background: "#e3e3e3" }}>
    {MONEY.seg.map((s, i) => (
      <span
        key={s}
        style={{
          padding: P ? "5px 9px" : "7px 13px",
          borderRadius: 7,
          fontFamily: FONT_BODY,
          fontSize: P ? 12 : 13.5,
          fontWeight: 600,
          lineHeight: 1.15,
          whiteSpace: "nowrap",
          textAlign: "center",
          color: i === 0 ? C.adminText : C.adminSub,
          background: i === 0 ? C.white : undefined,
          boxShadow: i === 0 ? "0 1px 2px rgba(0,0,0,.14), 0 0 0 .5px rgba(0,0,0,.06)" : undefined,
        }}
      >
        {s}
      </span>
    ))}
  </span>
);

function kpiValue(f: number, i: number): string {
  const k = MONEY.kpis[i];
  const v = count(f, L(KPI_TIMES[i][0]), L(KPI_TIMES[i][1]), 0, k.value);
  return k.money ? money(v) : num(v);
}

const KpiLabel: React.FC<{ i: number; P: boolean }> = ({ i, P }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT_BODY, fontSize: P ? 13 : 14, fontWeight: 600, color: C.adminSub, whiteSpace: "nowrap" }}>
    {P ? null : <Icon name={KPI_ICONS[i]} size={15} />}
    {MONEY.kpis[i].label}
  </span>
);

const VsChip: React.FC<{ f: number; P: boolean }> = ({ f, P }) => (
  <span style={rise(f, L(92), 6)}>
    <Pill tone="green" size={P ? 13 : 14} h={P ? 24 : 28} style={{ fontWeight: 600 }}>
      {MONEY.vs}
    </Pill>
  </span>
);

const Before: React.FC<{ f: number; P: boolean }> = ({ f, P }) => (
  <div style={{ ...rise(f, L(98), 6), fontFamily: FONT_BODY, fontSize: P ? 13 : 14.5, lineHeight: 1.4, color: C.adminSub }}>
    <b style={{ fontWeight: 600, color: C.adminText }}>{MONEY.beforeA}</b>
    {MONEY.beforeB}
  </div>
);

const Sources: React.FC<{ f: number; P: boolean }> = ({ f, P }) => {
  const max = MONEY.sources[0].value;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: P ? 5 : 11 }}>
      {MONEY.sources.map((s, i) => {
        const p = ease(f, L(70 + i * 6), L(100 + i * 6));
        return (
          <div key={s.name} style={{ display: "grid", gridTemplateColumns: P ? "84px minmax(0,1fr) 50px" : "104px minmax(0,1fr) 66px", alignItems: "center", gap: P ? 8 : 12, fontFamily: FONT_BODY, fontSize: P ? 13 : 14.5, color: C.adminText, height: P ? 18 : 22 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
              <i style={{ width: 8, height: 8, borderRadius: "50%", background: engineColor(s.color as never), flex: "none" }} />
              {s.name}
            </span>
            <Bar p={(p * s.value) / max} color={engineColor(s.color as never)} h={P ? 7 : 9} />
            <b className="tnum" style={{ textAlign: "right", fontWeight: 600 }}>
              {money(tween(f, L(70 + i * 6), L(100 + i * 6), 0, s.value))}
            </b>
          </div>
        );
      })}
    </div>
  );
};

const Fine: React.FC<{ f: number; P: boolean }> = ({ f, P }) => (
  <div style={{ ...rise(f, L(110), 6), display: "flex", alignItems: "flex-start", gap: 8, fontFamily: FONT_BODY, fontSize: P ? 13 : 14, lineHeight: 1.4, color: C.adminSub }}>
    <span style={{ width: P ? 16 : 18, height: P ? 16 : 18, marginTop: 1, borderRadius: "50%", background: C.white, boxShadow: `inset 0 0 0 1px ${C.lineSoft}`, display: "grid", placeItems: "center", fontSize: P ? 10 : 11, fontWeight: 700, color: C.ink2, flex: "none" }}>i</span>
    <span>{MONEY.fine}</span>
  </div>
);

const Email: React.FC<{ P: boolean }> = ({ P }) => {
  const e = MONEY.email;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: P ? 8 : 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: P ? 30 : 36, height: P ? 30 : 36, borderRadius: 9, background: C.warm100, boxShadow: `inset 0 0 0 1px ${C.lineSoft}`, color: C.ink2, display: "grid", placeItems: "center", flex: "none" }}>
          <Icon name="mail" size={P ? 15 : 18} />
        </span>
        <span style={{ fontFamily: FONT_BODY, fontSize: P ? 12.5 : 14, lineHeight: 1.35, color: C.adminSub, textWrap: "balance" }}>{e.from}</span>
      </div>
      <div style={{ fontFamily: FONT_HEAD, fontSize: P ? 19 : 25, fontWeight: 600, letterSpacing: P ? -0.4 : -0.6, color: C.navy, lineHeight: 1.2 }}>{e.heading}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: P ? 6 : 8 }}>
        {e.tiles.map((tl) => (
          <div key={tl.label} style={{ padding: P ? "8px 8px" : "11px 12px", borderRadius: 10, background: C.warm50, boxShadow: `inset 0 0 0 1px ${C.lineSoft}` }}>
            <Kpi size={P ? 18 : 25}>{tl.value}</Kpi>
            <div style={{ marginTop: 3, fontFamily: FONT_BODY, fontSize: P ? 12 : 13.5, lineHeight: 1.25, color: C.adminSub }}>{tl.label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: P ? 13 : 15, lineHeight: 1.45, color: C.adminText, fontWeight: 500 }}>{e.score}</div>
      {P ? null : <div style={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.45, color: C.adminSub, textWrap: "pretty" }}>{e.fixes}</div>}
      <div>
        <Btn size={P ? 13 : 14.5} h={P ? 34 : 40} style={{ background: "#1a1a1a", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }}>
          {e.button}
        </Btn>
      </div>
    </div>
  );
};

export const Money: React.FC<{ f: number; layout: Layout }> = ({ f, layout }) => {
  const P = layout === "phone";
  const t = f - S6;
  const card = ease(t, 160, 184);
  const solid = ease(t, 160, 168);

  if (P) {
    return (
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
        <Panel style={{ padding: "12px 13px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <KpiLabel i={0} P />
              <Kpi size={33}>{kpiValue(f, 0)}</Kpi>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: 4, paddingBottom: 2, minWidth: 122 }}>
              {[1, 2].map((i) => (
                <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <KpiLabel i={i} P />
                  <Kpi size={18} style={{ marginLeft: "auto" }}>
                    {kpiValue(f, i)}
                  </Kpi>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <VsChip f={f} P />
          </div>
          <div style={{ marginTop: 9, paddingTop: 8, borderTop: "1px solid #ebebeb" }}>
            <Before f={f} P />
          </div>
        </Panel>
        <Panel style={{ padding: "11px 13px 12px" }}>
          <H6 size={13.5} style={{ marginBottom: 8 }}>
            {MONEY.srcTitle}
          </H6>
          <Sources f={f} P />
        </Panel>
        <div style={{ padding: "0 4px" }}>
          <Fine f={f} P />
        </div>
        {card > 0 ? (
          <>
            <div style={{ position: "absolute", inset: -12, background: `rgba(255,255,255,${(0.35 * card).toFixed(3)})` }} />
            <div
              style={{
                position: "absolute",
                left: -12,
                right: -12,
                bottom: -12,
                // short enough that the green "vs before you joined" chip above it stays whole
                height: 262,
                transform: `translateY(${((1 - card) * 290).toFixed(1)}px)`,
                background: C.white,
                borderRadius: "16px 16px 0 0",
                boxShadow: "0 -12px 30px -12px rgba(0,0,0,.25)",
                padding: "16px 16px 16px",
              }}
            >
              <Email P />
            </div>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
      <ScreenTitle title={MONEY.title} right={<Seg P={false} />} />
      <Panel style={{ padding: "18px 22px 14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
          {MONEY.kpis.map((k, i) => (
            <div key={k.label} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, paddingLeft: i ? 22 : 0, borderLeft: i ? "1px solid #ebebeb" : undefined }}>
              <KpiLabel i={i} P={false} />
              <Kpi size={42}>{kpiValue(f, i)}</Kpi>
              {i === 0 ? <VsChip f={f} P={false} /> : null}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, paddingTop: 11, borderTop: "1px solid #ebebeb" }}>
          <Before f={f} P={false} />
        </div>
      </Panel>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(0,1fr)", gap: 14 }}>
        <Panel>
          <H6 style={{ marginBottom: 14 }}>{MONEY.srcTitle}</H6>
          <Sources f={f} P={false} />
        </Panel>
        <Panel>
          <H6 style={{ marginBottom: 12 }}>{MONEY.prodTitle}</H6>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {MONEY.products.map((p, i) => (
              <div key={p.name} style={{ ...rise(f, L(80 + i * 6), 6), display: "flex", alignItems: "center", gap: 10, height: 32, fontFamily: FONT_BODY, fontSize: 14.5, color: C.adminText, borderBottom: i < 2 ? "1px solid #f0f0f0" : undefined }}>
                <span>{p.name}</span>
                <b className="tnum" style={{ marginLeft: "auto", fontWeight: 600 }}>
                  {p.n}
                </b>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Fine f={f} P={false} />
      {card > 0 ? (
        <>
          <div style={{ position: "absolute", inset: -22, background: `rgba(255,255,255,${(0.3 * card).toFixed(3)})` }} />
          <div
            style={{
              position: "absolute",
              right: -4,
              top: 26,
              width: 430,
              opacity: solid,
              transform: `translateX(${((1 - card) * 40).toFixed(1)}px)`,
              background: C.white,
              borderRadius: 16,
              boxShadow: `0 0 0 1px rgba(11,12,43,.06), ${SHADOW_LG}`,
              padding: "22px 24px 24px",
            }}
          >
            <Email P={false} />
          </div>
        </>
      ) : null}
    </div>
  );
};
