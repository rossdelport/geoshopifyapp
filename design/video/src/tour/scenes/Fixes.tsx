// Scene 3: approve a fix. A before and after product description; "Approve & publish" turns into "Pushed to
// Shopify", the app says "Live in your store", and Undo shows that one click puts the old text back.
import React from "react";
import { FONT_BODY } from "../../fonts";
import { C } from "../../theme";
import { FIX } from "../data";
import { Layout } from "../geometry";
import { ease, rise, S3 } from "../timeline";
import { AMBER_BG, AMBER_INK, Btn, H6, Icon, IconName, Panel, Pill, ScreenTitle, Sub } from "../ui";

const L = (t: number) => S3 + t;

const Tile: React.FC<{ icon: IconName; size?: number }> = ({ icon, size = 38 }) => (
  <span style={{ width: size, height: size, borderRadius: 9, flex: "none", display: "grid", placeItems: "center", background: C.warm100, color: C.ink2, boxShadow: `inset 0 0 0 1px ${C.lineSoft}` }}>
    <Icon name={icon} size={size * 0.47} />
  </span>
);

// Waiting (amber) cross fades to Live (green) once the fix is approved.
const Status: React.FC<{ done: number; P: boolean }> = ({ done, P }) => {
  const size = P ? 12.5 : 14;
  const h = P ? 24 : 28;
  return (
    <span style={{ display: "grid", justifyItems: "end", flex: "none" }}>
      <span style={{ gridArea: "1 / 1", opacity: 1 - done, transform: `scale(${1 - 0.25 * done})` }}>
        <Pill tone="amber" size={size} h={h}>
          {FIX.waiting}
        </Pill>
      </span>
      <span style={{ gridArea: "1 / 1", opacity: done, transform: `scale(${0.75 + 0.25 * done})` }}>
        <Pill tone="green" size={size} h={h}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.green }} />
          {FIX.live}
        </Pill>
      </span>
    </span>
  );
};

const BA: React.FC<{ label: string; after?: boolean; P: boolean; style?: React.CSSProperties; sweep?: number; children: React.ReactNode }> = ({ label, after, P, style, sweep = -1, children }) => (
  <div
    style={{
      position: "relative",
      overflow: "hidden",
      borderRadius: 10,
      padding: P ? "26px 11px 9px" : "34px 14px 14px",
      fontFamily: FONT_BODY,
      fontSize: P ? 13 : 16,
      lineHeight: 1.5,
      background: after ? "#fbfffc" : "#f7f7f7",
      color: after ? C.adminText : "#6b6b6b",
      boxShadow: after ? "inset 0 0 0 1px rgba(31,157,85,.3)" : "inset 0 0 0 1px #e8e8e8",
      ...style,
    }}
  >
    <span style={{ position: "absolute", top: P ? 8 : 11, left: P ? 11 : 14, fontSize: P ? 11 : 13, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", lineHeight: 1.2, color: after ? C.greenInk : "#7a7a7a" }}>{label}</span>
    {children}
    {sweep >= 0 && sweep <= 1 ? (
      <span style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg, transparent 25%, rgba(108,214,140,.32) 50%, transparent 75%)", transform: `translateX(${(-100 + 200 * sweep).toFixed(1)}%)` }} />
    ) : null}
  </div>
);

export const Fixes: React.FC<{ f: number; layout: Layout }> = ({ f, layout }) => {
  const P = layout === "phone";
  const t = f - S3;
  const done = ease(t, 100, 116);
  const hover = t >= 86 && t < 100 ? ease(t, 86, 92) : 0;
  const pressed = t >= 96 && t < 100 ? 0.97 : 1;
  const sweep = t >= 100 && t <= 120 ? (t - 100) / 20 : -1;
  // on phones the toast sits above the buttons, so it leaves before the Undo tooltip appears there
  const toast = ease(t, 112, 124) * (1 - (P ? ease(t, 162, 172) : ease(t, 190, 200)));
  const undoIn = ease(t, 124, 136);
  const tip = rise(f, L(178), 6, 10);
  const btnSize = P ? 13 : 15;
  const btnH = P ? 36 : 40;

  const approve = (
    <span data-pt="approve" style={{ position: "relative", display: "inline-grid", flex: "none", transform: `scale(${pressed})` }}>
      <Btn size={btnSize} h={btnH} style={{ width: P ? 172 : 200, padding: 0 }}>
        {" "}
      </Btn>
      {/* green layer for "Pushed to Shopify", and a light layer for hover */}
      <span style={{ position: "absolute", inset: 0, borderRadius: 9, background: C.greenInk, opacity: done, boxShadow: "0 0 0 1px #0f5c32" }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: 9, background: "#fff", opacity: 0.06 * hover }} />
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.white, fontFamily: FONT_BODY, fontSize: btnSize, fontWeight: 600, opacity: 1 - done, transform: `translateY(${(-10 * done).toFixed(2)}px)` }}>
        {FIX.approve}
      </span>
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: C.white, fontFamily: FONT_BODY, fontSize: btnSize, fontWeight: 600, opacity: done, transform: `translateY(${(10 * (1 - done)).toFixed(2)}px)` }}>
        <Icon name="check" size={P ? 14 : 16} stroke={2.6} />
        {FIX.pushed}
      </span>
    </span>
  );

  const second = (
    <span style={{ display: "grid", flex: "none" }}>
      <span style={{ gridArea: "1 / 1", opacity: 1 - ease(t, 100, 108) }}>
        <Btn tone="light" size={btnSize} h={btnH}>
          {FIX.edit}
        </Btn>
      </span>
      <span data-pt="undo" style={{ gridArea: "1 / 1", opacity: undoIn, transform: `translateX(${(-8 * (1 - undoIn)).toFixed(2)}px)`, position: "relative" }}>
        <Btn tone="light" size={btnSize} h={btnH} style={{ padding: "0 14px" }}>
          <Icon name="undo" size={P ? 14 : 16} stroke={2} />
          {FIX.undo}
        </Btn>
        {f >= L(178) ? (
          <span
            style={{
              ...tip,
              position: "absolute",
              bottom: btnH + 10,
              left: P ? "auto" : "50%",
              right: P ? -40 : "auto",
              marginLeft: P ? 0 : -130,
              width: P ? 200 : 260,
              display: "flex",
              justifyContent: P ? "flex-end" : "center",
            }}
          >
            <span style={{ position: "relative", padding: P ? "7px 10px" : "8px 12px", borderRadius: 8, background: "#1a1a1a", color: "#f3f3f3", fontFamily: FONT_BODY, fontSize: P ? 13 : 14, fontWeight: 500, whiteSpace: "nowrap", boxShadow: "0 6px 16px -6px rgba(0,0,0,.4)" }}>
              {FIX.tooltip}
              <i style={{ position: "absolute", left: P ? "auto" : "50%", right: P ? 74 : "auto", marginLeft: P ? 0 : -5, bottom: -5, width: 10, height: 10, background: "#1a1a1a", transform: "rotate(45deg)", borderRadius: 2 }} />
            </span>
          </span>
        ) : null}
      </span>
    </span>
  );

  const toastEl =
    toast > 0 ? (
      <div style={{ position: "absolute", left: 0, right: 0, bottom: P ? 96 : 18, display: "flex", justifyContent: "center", opacity: toast, transform: `translateY(${(10 * (1 - Math.min(1, ease(t, 112, 124)))).toFixed(2)}px)` }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: P ? "9px 14px" : "11px 18px", borderRadius: 10, background: "#1a1a1a", color: C.white, fontFamily: FONT_BODY, fontSize: P ? 13.5 : 15, fontWeight: 600, boxShadow: "0 12px 28px -10px rgba(0,0,0,.45)" }}>
          <span style={{ width: P ? 18 : 20, height: P ? 18 : 20, borderRadius: "50%", background: C.green, color: "#0b3d1d", display: "grid", placeItems: "center" }}>
            <Icon name="check" size={P ? 11 : 12} stroke={3.2} />
          </span>
          {FIX.toast}
        </span>
      </div>
    ) : null;

  const card = (
    <Panel style={{ padding: P ? "13px 13px 14px" : "20px 22px", display: "flex", flexDirection: "column", gap: P ? 9 : 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {P ? null : <Tile icon="file" />}
        <div style={{ display: "flex", flexDirection: "column", marginRight: "auto", lineHeight: 1.3, minWidth: 0 }}>
          <b style={{ fontFamily: FONT_BODY, fontSize: P ? 14 : 16, fontWeight: 650, color: C.adminText, whiteSpace: "nowrap" }}>{FIX.kind}</b>
          <span style={{ fontFamily: FONT_BODY, fontSize: P ? 13 : 14, color: C.adminSub }}>{FIX.product}</span>
        </div>
        <Status done={done} P={P} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: P ? "1fr" : "1fr 1fr", gap: P ? 7 : 12 }}>
        <BA label={FIX.before} P={P} style={{ opacity: 1 - 0.5 * done }}>
          {FIX.beforeText}
        </BA>
        <BA label={FIX.after} after P={P} sweep={sweep}>
          {FIX.afterText}
        </BA>
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: P ? 13 : 15, lineHeight: 1.45, color: C.adminSub }}>
        <b style={{ color: C.adminText, fontWeight: 650 }}>{FIX.whyLabel}</b>
        {FIX.why}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: P ? 1 : 2 }}>
        {approve}
        {second}
      </div>
    </Panel>
  );

  if (P) {
    return (
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
        <ScreenTitle title={FIX.title} size={16} style={{ minHeight: 22 }} right={<Sub size={13}>{FIX.note}</Sub>} />
        {card}
        {toastEl}
      </div>
    );
  }
  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
      <ScreenTitle title={FIX.title} right={<Sub size={14}>{FIX.note}</Sub>} />
      {card}
      {FIX.more.map((m, i) => (
        <Panel key={m.kind} style={{ padding: "13px 22px", display: "flex", alignItems: "center", gap: 12 }}>
          <Tile icon={i === 0 ? "help" : "title"} size={34} />
          <div style={{ display: "flex", flexDirection: "column", marginRight: "auto", lineHeight: 1.3 }}>
            <H6 size={15}>{m.kind}</H6>
            <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.adminSub }}>{m.product}</span>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", height: 28, padding: "0 11px", borderRadius: 100, background: AMBER_BG, color: AMBER_INK, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 500 }}>{FIX.waiting}</span>
        </Panel>
      ))}
      {toastEl}
    </div>
  );
};
