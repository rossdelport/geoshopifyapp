// The words above the window: a grey time chip ("Day one"), the Done-for-you note when the plans differ, and
// the big caption. Each scene's set cross fades into the next (out rising 8 px, in from 8 px below).
import React from "react";
import { FONT_BODY, FONT_HEAD } from "../fonts";
import { C } from "../theme";
import { SCENE_COPY } from "./data";
import { geo, Layout, PHONE } from "./geometry";
import { CAPTION_STARTS, S7, swap } from "./timeline";

export const Chip: React.FC<{ h: number; size: number; children?: React.ReactNode }> = ({ h, size, children }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      height: h,
      padding: "0 12px",
      borderRadius: 100,
      background: C.warm100,
      boxShadow: `inset 0 0 0 1px ${C.lineSoft}`,
      color: C.ink2,
      fontFamily: FONT_BODY,
      fontSize: size,
      fontWeight: 600,
      lineHeight: 1,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);

export const Note: React.FC<{ h: number; size: number; note: [string, string] }> = ({ h, size, note }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      height: h,
      padding: "0 12px",
      borderRadius: 100,
      background: C.white,
      boxShadow: `inset 0 0 0 1px ${C.lineSoft}`,
      fontFamily: FONT_BODY,
      fontSize: size,
      lineHeight: 1,
      whiteSpace: "nowrap",
    }}
  >
    <b style={{ fontWeight: 650, color: C.navy }}>{note[0]}</b>
    <span style={{ fontWeight: 500, color: C.text2, whiteSpace: "pre" }}>{note[1]}</span>
  </span>
);

// One scene's chip, note and caption, fully shown (used by the cross fade below).
export const CaptionSet: React.FC<{ i: number; layout: Layout }> = ({ i, layout }) => {
  const g = geo(layout);
  const copy = SCENE_COPY[i];
  const P = layout === "phone";
  const capY = P ? (copy.note ? PHONE.caption.yWithNote : PHONE.caption.y) : g.caption.y;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: g.chips.x,
          top: g.chips.y,
          display: "flex",
          flexDirection: P ? "column" : "row",
          alignItems: "flex-start",
          gap: g.chips.gap,
        }}
      >
        <Chip h={g.chips.h} size={g.chips.font}>
          {copy.chip}
        </Chip>
        {copy.note ? <Note h={g.chips.h} size={g.chips.font} note={copy.note} /> : null}
      </div>
      <div
        style={{
          position: "absolute",
          left: g.caption.x,
          top: capY,
          width: g.caption.w,
          fontFamily: FONT_HEAD,
          fontWeight: 500,
          color: C.navy,
          fontSize: g.caption.size,
          lineHeight: g.caption.lh,
          letterSpacing: g.caption.ls,
          whiteSpace: P ? "normal" : "nowrap",
          textWrap: "balance",
        }}
      >
        {copy.caption}
      </div>
    </>
  );
};

export const Captions: React.FC<{ f: number; layout: Layout }> = ({ f, layout }) => (
  <>
    {SCENE_COPY.map((_, i) => {
      const start = CAPTION_STARTS[i];
      const end = CAPTION_STARTS[i + 1];
      // scene 1 is the loop's landing picture, so it is simply there at frame 0; the last set leaves with the
      // window when the end card starts
      const style = swap(f, i === 0 ? null : start - 3, end === S7 ? S7 : end - 7);
      if (!style) return null;
      return (
        <div key={i} style={{ position: "absolute", inset: 0, ...style }}>
          <CaptionSet i={i} layout={layout} />
        </div>
      );
    })}
  </>
);
