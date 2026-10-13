// The explainer's first half: the shift (shoppers ask AI now), the stakes (AI picks a few brands) and the
// GEO logo. Each scene draws only itself and counts frames from its own start.
import React from "react";
import { AbsoluteFill, spring, useVideoConfig } from "remotion";
import { ExampleTag } from "../TestCard";
import { FONT_BODY } from "../fonts";
import { C, SHADOW_LG } from "../theme";
import { Center, Coin, Dark, GeoMark, Light, Rise, StreakIn, head, io, lilacText, useF } from "./kit";

const TAG: React.CSSProperties = { position: "absolute", right: 28, top: 24 };

export const Shoppers: React.FC = () => (
  <Dark>
    <StreakIn text="Shoppers" size={104} at={3} />
  </Dark>
);

export const DontJust: React.FC = () => (
  <Light>
    <Center>
      <Rise words={["don’t", "just"]} style={head(84, C.cobalt)} at={1} />
    </Center>
  </Light>
);

const SearchIcon: React.FC = () => (
  <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
  </svg>
);

export const SearchBar: React.FC = () => {
  const f = useF();
  const text = "Google it";
  const n = Math.floor(io(f, 14, 34, 0, text.length, (t) => t));
  const caret = f < 44 && Math.floor(f / 8) % 2 === 0;
  return (
    <Dark>
      <Center>
        <div
          style={{
            width: 700,
            height: 116,
            borderRadius: 58,
            display: "flex",
            alignItems: "center",
            gap: 22,
            padding: "0 16px 0 34px",
            background: "linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.12) 100%)",
            border: "2px solid rgba(255,255,255,0.8)",
            boxShadow: `0 0 ${io(f, 0, 20, 10, 46)}px rgba(170, 185, 255, 0.6), inset 0 0 24px rgba(255,255,255,0.2)`,
            transform: `translateX(${io(f, 0, 20, 180, 0)}px) scale(${io(f, 0, 20, 0.92, 1)})`,
            opacity: io(f, 0, 8, 0, 1),
          }}
        >
          <SearchIcon />
          <span style={{ ...head(60, "#fff"), flex: 1, textShadow: "0 0 20px rgba(150,165,245,0.5)" }}>
            {text.slice(0, n)}
            <span style={{ opacity: caret ? 0.9 : 0, fontWeight: 400 }}>|</span>
          </span>
          <span
            style={{
              width: 84,
              height: 84,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: "rgba(255,255,255,0.14)",
              boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.5)",
            }}
          >
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinejoin="round">
              <path d="M3.5 4 21 12 3.5 20l2.5-8Z" />
              <path d="M6 12h7" />
            </svg>
          </span>
        </div>
      </Center>
    </Dark>
  );
};

export const Anymore: React.FC = () => (
  <Dark>
    <Center>
      <Rise words={["anymore."]} style={head(92, "#fff", { textShadow: "0 0 26px rgba(150,165,245,0.4)" })} at={1} />
    </Center>
  </Dark>
);

const BUBBLES = [
  { x: -170, y: -190, w: 130, h: 54, blue: false, rot: -5, at: 0 },
  { x: 110, y: -150, w: 200, h: 52, blue: true, rot: 3, at: 5 },
  { x: -120, y: -80, w: 180, h: 56, blue: false, rot: 2, at: 10 },
  { x: 130, y: -20, w: 170, h: 50, blue: true, rot: -3, at: 15 },
  { x: -40, y: 40, w: 150, h: 48, blue: false, rot: -2, at: 20 },
];

const bubble = (blue: boolean): React.CSSProperties => ({
  borderRadius: 18,
  background: blue ? "linear-gradient(180deg, #b4c4ff 0%, #8597f2 100%)" : "linear-gradient(180deg, #c3c3cd 0%, #9d9dab 100%)",
  boxShadow: "inset 0 -5px 0 rgba(0,0,0,0.08), inset 0 2px 0 rgba(255,255,255,0.35), 0 16px 26px -14px rgba(11,12,43,0.4)",
});

export const TheyAsk: React.FC = () => {
  const f = useF();
  const { fps } = useVideoConfig();
  const drop = (at: number) => spring({ frame: f - at, fps, config: { damping: 11, mass: 0.7 } });
  const groupY = io(f, 0, 96, 70, -40, (t) => t);
  const pill = (text: string, x: number, y: number, rot: number, at: number) => {
    const p = drop(at);
    return (
      <span
        style={{
          position: "absolute",
          left: 640 + x,
          top: 400 + y + groupY - (1 - p) * 420,
          transform: `translate(-50%, -50%) rotate(${rot * p}deg)`,
          ...head(48, C.navy),
          padding: "12px 34px 14px",
          borderRadius: 18,
          background: "linear-gradient(180deg, #ffffff 0%, #f1f1f6 100%)",
          boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.05), 0 18px 30px -14px rgba(11,12,43,0.35)",
          opacity: f >= at ? 1 : 0,
        }}
      >
        {text}
      </span>
    );
  };
  return (
    <Light>
      {BUBBLES.map((b, i) => {
        const p = drop(b.at);
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: 640 + b.x,
              top: 400 + b.y + groupY - (1 - p) * 420,
              width: b.w,
              height: b.h,
              transform: `translate(-50%, -50%) rotate(${b.rot}deg)`,
              opacity: f >= b.at ? 1 : 0,
              ...bubble(b.blue),
            }}
          />
        );
      })}
      {pill("They", -110, 130, -4, 32)}
      {pill("ask", 80, 160, 5, 44)}
    </Light>
  );
};

export const BigAI: React.FC = () => {
  const f = useF();
  const tiles = Array.from({ length: 24 }, (_, i) => i);
  return (
    <Dark dots={false}>
      <AbsoluteFill
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          alignContent: "center",
          opacity: io(f, 0, 20, 0, 1),
          transform: `scale(${io(f, 0, 52, 1.08, 1, (t) => t)})`,
        }}
      >
        {tiles.map((i) => (
          <span key={i} style={{ ...head(150, "transparent"), textAlign: "center", WebkitTextStroke: "1.5px rgba(140, 155, 235, 0.16)" }}>
            AI
          </span>
        ))}
      </AbsoluteFill>
      <Center>
        <span
          style={{
            ...head(280, "transparent", { letterSpacing: "-8px", lineHeight: 1 }),
            backgroundImage: "linear-gradient(180deg, #ffffff 30%, #9097c9 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            filter: `blur(${io(f, 0, 12, 16, 0)}px) drop-shadow(0 10px 40px rgba(125,140,240,0.35))`,
            transform: `scale(${io(f, 0, 16, 1.35, 1) * io(f, 16, 52, 1, 1.05, (t) => t)})`,
            opacity: io(f, 0, 6, 0, 1),
          }}
        >
          AI
        </span>
      </Center>
    </Dark>
  );
};

const RIVALS = ["Ridgeback Beard Co.", "Saltbush Beard Co.", "Banksia Beard Co."];

export const AIPicks: React.FC = () => {
  const f = useF();
  const show = (at: number): React.CSSProperties => ({
    opacity: io(f, at, at + 8, 0, 1),
    transform: `translateY(${io(f, at, at + 12, 14, 0)}px)`,
  });
  return (
    <Light>
      <ExampleTag style={TAG} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 118 }}>
        <Rise words={["AI", "picks", { t: "a few", style: { color: C.cobalt } }, "brands."]} style={head(60, C.navy)} at={0} />
        <div
          style={{
            marginTop: 44,
            width: 620,
            padding: "26px 28px 30px",
            borderRadius: 26,
            background: "#fff",
            boxShadow: SHADOW_LG,
            fontFamily: FONT_BODY,
            ...show(6),
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end", ...show(14) }}>
            <span style={{ fontSize: 21, fontWeight: 500, color: C.navy, background: C.lilac50, padding: "11px 18px", borderRadius: "18px 18px 4px 18px" }}>
              best beard oil for dry skin?
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, ...show(24) }}>
            <Coin engine="chatgpt" size={30} style={{ boxShadow: `inset 0 0 0 1px ${C.line}` }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>ChatGPT</span>
          </div>
          {RIVALS.map((name, i) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14, ...show(32 + i * 8) }}>
              <span
                style={{ width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", background: C.lilac100, color: C.cobalt, fontSize: 17, fontWeight: 700 }}
              >
                {i + 1}
              </span>
              <span style={{ ...head(25, C.navy), letterSpacing: "-0.4px" }}>{name}</span>
              <span style={{ flex: 1, height: 10, borderRadius: 5, background: C.warm100, marginLeft: 8 }} />
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </Light>
  );
};

export const IsYours: React.FC = () => (
  <Dark>
    <Center>
      <Rise words={["Is", { t: "yours", style: lilacText }, "one", "of", "them?"]} style={head(80, "#fff")} at={2} stagger={5} />
    </Center>
  </Dark>
);

export const Introducing: React.FC = () => (
  <Dark>
    <StreakIn text="Introducing" size={64} at={2} />
  </Dark>
);

/** A lilac circle opens from the middle and the GEO logo comes together on it. */
export const LogoReveal: React.FC<{ tagAt?: number }> = ({ tagAt = 44 }) => {
  const f = useF();
  const { fps } = useVideoConfig();
  const r = io(f, 0, 24, 0, 900);
  const join = spring({ frame: f - 10, fps, config: { damping: 14, mass: 0.8 } });
  return (
    <Dark>
      <div
        style={{
          position: "absolute",
          left: 640 - r,
          top: 400 - r,
          width: r * 2,
          height: r * 2,
          borderRadius: "50%",
          background: "radial-gradient(circle, #f7f5ff 0%, #ebe8fd 55%, #d3d9fb 100%)",
          boxShadow: "0 0 140px 30px rgba(125, 140, 240, 0.55)",
        }}
      />
      <Center>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <GeoMark size={132} spread={1 + (1 - join) * 1.6} style={{ opacity: io(f, 8, 14, 0, 1), transform: `scale(${0.7 + join * 0.3})` }} />
          <Rise words={["G", "E", "O"]} gap={0} stagger={3} at={20} style={head(136, C.navy, { letterSpacing: "-3px" })} />
        </div>
        <div style={{ marginTop: 22 }}>
          <Rise words={["Get", "recommended", "by", "AI"]} at={tagAt} stagger={3} style={head(32, C.text, { fontWeight: 500, letterSpacing: "-0.6px" })} />
        </div>
      </Center>
    </Dark>
  );
};
