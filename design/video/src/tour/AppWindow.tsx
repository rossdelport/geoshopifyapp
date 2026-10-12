// The one app window that stays on screen from scene 1 to 6: dark Shopify admin bar, the GEO sidebar (desktop)
// or tab strip (phone), and the grey main area where the screens change. Only the active tab, its sliding white
// pill and the Fixes badge change between scenes; the window itself never moves (it fades out for the end card).
import React from "react";
import { FONT_BODY } from "../fonts";
import { C, SHADOW_LG } from "../theme";
import { STORE, TABS } from "./data";
import { geo, Layout, PHONE, phoneTabWidths, SIDE, STRIP } from "./geometry";
import { badgeState, tabState } from "./timeline";
import { Icon, IconName } from "./ui";

const TAB_ICONS: IconName[] = ["dashboard", "question", "users", "wand", "send"];

const Badge: React.FC<{ n: number; scale: number; small?: boolean }> = ({ n, scale, small }) => (
  <b
    style={{
      minWidth: small ? 17 : 20,
      height: small ? 17 : 20,
      padding: small ? "0 4px" : "0 6px",
      borderRadius: 10,
      background: C.navy,
      color: C.white,
      fontFamily: FONT_BODY,
      fontSize: small ? 10.5 : 12,
      fontWeight: 700,
      lineHeight: small ? "17px" : "20px",
      textAlign: "center",
      transform: `scale(${scale})`,
      boxShadow: small ? `0 0 0 2px #ebebeb` : undefined,
    }}
    className="tnum"
  >
    {n}
  </b>
);

const GeoMark: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <span style={{ position: "relative", width: size, height: size, flex: "none" }}>
    <i style={{ position: "absolute", left: 0, top: 0, width: size * 0.67, height: size * 0.67, borderRadius: "50%", background: C.peri300 }} />
    <i style={{ position: "absolute", right: 0, bottom: 0, width: size * 0.67, height: size * 0.67, borderRadius: "50%", background: C.cobalt, mixBlendMode: "multiply" }} />
  </span>
);

const Sidebar: React.FC<{ f: number }> = ({ f }) => {
  const tab = tabState(f);
  const badge = badgeState(f);
  const step = SIDE.tabH + SIDE.tabGap;
  return (
    <div style={{ width: 190, flex: "none", background: C.adminNav, padding: `${SIDE.padTop}px ${SIDE.padX}px` }}>
      <div style={{ height: SIDE.brandH, marginBottom: SIDE.brandGap, display: "flex", alignItems: "center", gap: 9, padding: "0 10px", fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 700, letterSpacing: ".03em", color: C.adminText }}>
        <GeoMark />
        GEO
      </div>
      <div style={{ position: "relative" }}>
        <i
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: SIDE.tabH,
            borderRadius: 8,
            background: C.white,
            boxShadow: "0 1px 0 rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.03)",
            transform: `translateY(${(tab.pill * step).toFixed(2)}px)`,
          }}
        />
        {TABS.map((name, i) => {
          const on = tab.active === i;
          return (
            <div
              key={name}
              style={{
                position: "relative",
                height: SIDE.tabH,
                marginBottom: SIDE.tabGap,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 10px",
                fontFamily: FONT_BODY,
                fontSize: 14,
                fontWeight: on ? 650 : 500,
                color: on ? "#1a1a1a" : "#4a4a4a",
                whiteSpace: "nowrap",
              }}
            >
              <Icon name={TAB_ICONS[i]} size={16} color={on ? C.navy : "currentColor"} />
              <span>{name}</span>
              {i === 3 && badge.n > 0 ? (
                <span style={{ marginLeft: "auto" }}>
                  <Badge n={badge.n} scale={badge.scale} />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Phone: a strip of five icon tabs; the active one widens to show its name.
export function phoneActiveness(f: number): number[] {
  const t = tabState(f);
  return [0, 1, 2, 3, 4].map((i) => {
    if (t.from === t.to) return i === t.to ? 1 : 0;
    return i === t.to ? t.p : i === t.from ? 1 - t.p : 0;
  });
}

const TabStrip: React.FC<{ f: number }> = ({ f }) => {
  const t = tabState(f);
  const act = phoneActiveness(f);
  const widths = phoneTabWidths(act);
  const lefts: number[] = [];
  let x = 0;
  for (const w of widths) {
    lefts.push(x);
    x += w + STRIP.gap;
  }
  // the pill slides from the old tab's box to the new one's
  const pillL = lefts[t.from] + (lefts[t.to] - lefts[t.from]) * t.p;
  const pillW = widths[t.from] + (widths[t.to] - widths[t.from]) * t.p;
  const badge = badgeState(f);
  return (
    <div style={{ height: PHONE.win.strip, flex: "none", background: C.adminNav, padding: STRIP.pad, boxShadow: "inset 0 -1px 0 #e0e0e0", position: "relative" }}>
      <div style={{ position: "relative", height: PHONE.win.strip - 2 * STRIP.pad }}>
        <i style={{ position: "absolute", top: 0, height: PHONE.win.strip - 2 * STRIP.pad, left: pillL, width: pillW, borderRadius: 8, background: C.white, boxShadow: "0 1px 0 rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.03)" }} />
        {TABS.map((name, i) => (
          <div
            key={name}
            style={{
              position: "absolute",
              top: 0,
              left: lefts[i],
              width: widths[i],
              height: PHONE.win.strip - 2 * STRIP.pad,
              display: "flex",
              alignItems: "center",
              gap: i === 3 && badge.n > 0 ? 15 : 7,
              paddingLeft: (STRIP.wIcon - 18) / 2,
              overflow: "visible",
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 650,
              color: t.active === i ? "#1a1a1a" : "#4a4a4a",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ position: "relative" }}>
              <Icon name={TAB_ICONS[i]} size={18} color={t.active === i ? C.navy : "currentColor"} />
              {i === 3 && badge.n > 0 ? (
                <span style={{ position: "absolute", left: 11, top: -7 }}>
                  <Badge n={badge.n} scale={badge.scale} small />
                </span>
              ) : null}
            </span>
            <span style={{ opacity: act[i], overflow: "hidden" }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AppWindow: React.FC<{ f: number; layout: Layout; style?: React.CSSProperties; children?: React.ReactNode }> = ({ f, layout, style, children }) => {
  const g = geo(layout);
  const w = g.win;
  const P = layout === "phone";
  return (
    <div
      style={{
        position: "absolute",
        left: w.x,
        top: w.y,
        width: w.w,
        height: w.h,
        padding: w.pad,
        borderRadius: w.r,
        background: C.white,
        boxShadow: `0 0 0 1px rgba(11,12,43,.05), ${SHADOW_LG}`,
        ...style,
      }}
    >
      <div style={{ height: "100%", borderRadius: w.r - w.pad, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 0 0 1px rgba(11,12,43,.06)" }}>
        <div style={{ height: w.top, flex: "none", background: C.adminTop, display: "flex", alignItems: "center", gap: P ? 8 : 10, padding: P ? "0 10px" : "0 14px" }}>
          <i
            style={{
              width: P ? 20 : 22,
              height: P ? 20 : 22,
              borderRadius: 6,
              background: "#7fdc9a",
              color: "#0b3d1d",
              display: "grid",
              placeItems: "center",
              fontStyle: "normal",
              fontFamily: FONT_BODY,
              fontSize: P ? 9 : 10,
              fontWeight: 700,
              letterSpacing: ".02em",
            }}
          >
            {STORE.mono}
          </i>
          <span style={{ fontFamily: FONT_BODY, fontSize: P ? 13 : 14, fontWeight: 600, color: "#e3e3e3", whiteSpace: "nowrap" }}>{STORE.name}</span>
        </div>
        {P ? <TabStrip f={f} /> : null}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {P ? null : <Sidebar f={f} />}
          <div style={{ flex: 1, position: "relative", background: C.adminMain, minWidth: 0, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: w.mainPad }}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
