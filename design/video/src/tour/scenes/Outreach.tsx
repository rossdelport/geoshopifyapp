// Scene 4: every month. New guide pages (one live, one waiting for the store's OK) and sites to pitch, each
// with an email already drafted. One opens into the draft with the app's real "Open in my email" and
// "Copy email" buttons. No forum rows, no reviews: nothing is posted for the store.
import React from "react";
import { FONT_BODY } from "../../fonts";
import { C } from "../../theme";
import { MONTH } from "../data";
import { Layout } from "../geometry";
import { ease, rise, S4 } from "../timeline";
import { Btn, H6, Icon, Panel, Pill, ScreenTitle, Sub } from "../ui";

const L = (t: number) => S4 + t;

const Guide: React.FC<{ f: number; i: number; P: boolean }> = ({ f, i, P }) => {
  const g = MONTH.guides[i];
  return (
    <div style={{ ...rise(f, L(40 + i * 8), 8), padding: P ? "8px 10px" : "13px 14px", borderRadius: 10, boxShadow: `inset 0 0 0 1px ${C.line}`, display: "flex", flexDirection: "column", gap: P ? 3 : 5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        {P ? null : <Icon name="book" size={15} color={C.adminSub} />}
        {P ? null : <span style={{ fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 600, color: C.adminSub }}>{MONTH.guideLabel}</span>}
        {P ? <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 650, color: C.adminText, lineHeight: 1.35 }}>{g.title}</span> : null}
        <span style={{ marginLeft: "auto" }}>
          {g.live ? (
            <Pill tone="green" size={P ? 12.5 : 13.5} h={P ? 22 : 26}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.green }} />
              Live
            </Pill>
          ) : (
            <Pill tone="amber" size={P ? 12.5 : 13.5} h={P ? 22 : 26}>
              Waiting
            </Pill>
          )}
        </span>
      </div>
      {P ? null : <div style={{ fontFamily: FONT_BODY, fontSize: 16, fontWeight: 650, color: C.adminText, lineHeight: 1.35 }}>{g.title}</div>}
      {g.meta ? <div style={{ fontFamily: FONT_BODY, fontSize: P ? 13 : 14, color: C.adminSub, display: "flex", alignItems: "center", gap: 6 }}>{P ? null : <Icon name="link" size={14} />}{g.meta}</div> : null}
    </div>
  );
};

const Ready: React.FC<{ P: boolean }> = ({ P }) => (
  <Pill tone="grey" size={P ? 12.5 : 13.5} h={P ? 22 : 26}>
    <Icon name="mail" size={P ? 12 : 13} />
    {MONTH.ready}
  </Pill>
);

const Draft: React.FC<{ P: boolean }> = ({ P }) => {
  const fs = P ? 13 : 14.5;
  const lab = { fontFamily: FONT_BODY, fontSize: fs, fontWeight: 600, color: C.adminSub } as const;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: P ? 6 : 8, fontFamily: FONT_BODY, fontSize: fs, color: C.adminText, lineHeight: 1.45 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={lab}>{MONTH.toLabel}</span>
        <span>{MONTH.to}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 4, fontSize: P ? 12.5 : 13.5, fontWeight: 600, color: C.greenInk }}>
          <Icon name="check" size={P ? 12 : 13} stroke={2.6} />
          {MONTH.found}
        </span>
      </div>
      <div>
        <span style={lab}>{MONTH.subjectLabel}</span> <b style={{ fontWeight: 600 }}>{MONTH.subject}</b>
      </div>
      <div
        style={{
          maxHeight: `${(P ? 3 : 2.9) * 1.5}em`,
          overflow: "hidden",
          lineHeight: 1.5,
          color: "#3a3a3a",
          WebkitMaskImage: "linear-gradient(180deg, #000 55%, transparent 100%)",
          maskImage: "linear-gradient(180deg, #000 55%, transparent 100%)",
        }}
      >
        {MONTH.body}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: P ? 2 : 4 }}>
        <Btn size={P ? 13 : 14} h={P ? 34 : 38} style={{ padding: P ? "0 12px" : "0 15px" }}>
          <Icon name="open" size={P ? 14 : 15} stroke={2} />
          {MONTH.open}
        </Btn>
        <span data-pt="copy">
          <Btn tone="light" size={P ? 13 : 14} h={P ? 34 : 38} style={{ padding: P ? "0 12px" : "0 15px" }}>
            <Icon name="copy" size={P ? 14 : 15} stroke={2} />
            {MONTH.copy}
          </Btn>
        </span>
      </div>
    </div>
  );
};

export const Outreach: React.FC<{ f: number; layout: Layout }> = ({ f, layout }) => {
  const P = layout === "phone";
  const t = f - S4;
  const open = ease(t, 122, 140);

  if (P) {
    const sheet = ease(t, 122, 142);
    return (
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
        <Panel style={{ padding: "10px 11px 11px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7 }}>
            <H6 size={13.5}>{MONTH.guidesTitle}</H6>
            <Sub size={13}>{MONTH.guidesNote}</Sub>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <Guide f={f} i={0} P />
            <Guide f={f} i={1} P />
          </div>
        </Panel>
        <Panel style={{ padding: "10px 11px 11px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7 }}>
            <H6 size={13.5}>{MONTH.pitchTitle}</H6>
            <Sub size={13}>{MONTH.pitchNote}</Sub>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {MONTH.pitches.map((p, i) => (
              <div key={p.site} data-pt={i === 0 ? "pitch" : undefined} style={{ ...rise(f, L(56 + i * 6), 8), padding: "7px 10px", borderRadius: 10, boxShadow: `inset 0 0 0 1px ${C.line}`, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: C.adminText, whiteSpace: "nowrap" }}>{p.site}</span>
                <span style={{ marginLeft: "auto" }}>
                  <Ready P />
                </span>
              </div>
            ))}
          </div>
        </Panel>
        {sheet > 0 ? (
          <>
            <div style={{ position: "absolute", inset: -12, background: `rgba(26,26,26,${(0.18 * sheet).toFixed(3)})` }} />
            <div
              style={{
                position: "absolute",
                left: -12,
                right: -12,
                bottom: -12,
                height: 262,
                transform: `translateY(${((1 - sheet) * 270).toFixed(1)}px)`,
                background: C.white,
                borderRadius: "16px 16px 0 0",
                boxShadow: "0 -12px 30px -12px rgba(0,0,0,.25)",
                padding: "10px 16px 16px",
                borderLeft: `3px solid ${C.cobalt}`,
              }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#dedede", margin: "0 auto 10px" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <span style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 650, color: C.adminText }}>{MONTH.pitches[0].site}</span>
                <span style={{ marginLeft: "auto" }}>
                  <Ready P />
                </span>
              </div>
              <Draft P />
            </div>
          </>
        ) : null}
      </div>
    );
  }

  const DRAFT_H = 190;
  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
      <ScreenTitle title={MONTH.title} />
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <Panel style={{ width: 340, flex: "none" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <H6>{MONTH.guidesTitle}</H6>
            <Sub size={14}>{MONTH.guidesNote}</Sub>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Guide f={f} i={0} P={false} />
            <Guide f={f} i={1} P={false} />
          </div>
        </Panel>
        <Panel style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <H6>{MONTH.pitchTitle}</H6>
            <Sub size={14}>{MONTH.pitchNote}</Sub>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {MONTH.pitches.map((p, i) => (
              <div
                key={p.site}
                style={{
                  ...rise(f, L(56 + i * 6), 8),
                  borderRadius: 10,
                  boxShadow: i === 0 && open > 0 ? `inset 0 0 0 1px ${C.lineSoft}, 0 4px 14px -8px rgba(11,12,43,${(0.25 * open).toFixed(3)})` : `inset 0 0 0 1px ${C.line}`,
                  overflow: "hidden",
                }}
              >
                <div data-pt={i === 0 ? "pitch" : undefined} style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.35 }}>
                    <span style={{ fontFamily: FONT_BODY, fontSize: 15, fontWeight: 600, color: C.adminText }}>{p.site}</span>
                    <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.adminSub }}>{p.what}</span>
                  </div>
                  <span style={{ marginLeft: "auto" }}>
                    <Ready P={false} />
                  </span>
                </div>
                {i === 0 && open > 0 ? (
                  <div style={{ height: DRAFT_H * open, overflow: "hidden" }}>
                    <div style={{ margin: "0 14px 14px", padding: "12px 14px", borderRadius: 8, background: C.warm50, borderLeft: `3px solid ${C.cobalt}`, opacity: ease(t, 128, 142) }}>
                      <Draft P={false} />
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
};
