// A still with every face the page loads, used to check the video renders text exactly like the site
// (see README: "Check the fonts"). Not part of the home page video.
import React from "react";
import { AbsoluteFill } from "remotion";
import { FONT_BODY, FONT_HEAD } from "./fonts";

const LINE = "Sales from AI: US$1,240 · 38% “Example” ÀÉÎ ąčę";

export const SPECIMEN_ROWS: { family: "head" | "body"; weight: number; size: number }[] = [
  { family: "head", weight: 400, size: 30 },
  { family: "head", weight: 500, size: 48 },
  { family: "head", weight: 600, size: 26 },
  { family: "body", weight: 400, size: 16 },
  { family: "body", weight: 500, size: 13.5 },
  { family: "body", weight: 600, size: 11 },
  { family: "body", weight: 650, size: 13 },
  { family: "body", weight: 700, size: 18 },
];

export const FontSpecimen: React.FC = () => (
  <AbsoluteFill style={{ background: "#ffffff", color: "#0b0c2b", padding: 32, gap: 10 }}>
    {SPECIMEN_ROWS.map((r) => (
      <div
        key={`${r.family}-${r.weight}-${r.size}`}
        style={{ fontFamily: r.family === "head" ? FONT_HEAD : FONT_BODY, fontWeight: r.weight, fontSize: r.size, lineHeight: 1.3, whiteSpace: "nowrap" }}
      >
        {LINE}
      </div>
    ))}
  </AbsoluteFill>
);
