// The explainer's second half: what GEO does in the background (asks AI every week, sees who AI picks, rewrites
// product pages, writes guides, finds the sites AI trusts), the money, and the close. Made-up store and sample
// numbers only, so every scene with them carries the "Example" tag.
import React from "react";
import { AbsoluteFill, Freeze, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ExampleTag } from "../TestCard";
import { FONT_BODY } from "../fonts";
import { C, GRAD_BTN, SHADOW_LG } from "../theme";
import { Center, Coin, Cursor, Dark, Engine, Light, Rise, head, io, lilacText } from "./kit";
import { LogoReveal } from "./scenes-intro";

const TAG: React.CSSProperties = { position: "absolute", right: 28, top: 24 };
const cobalt = (t: string) => ({ t, style: { color: C.cobalt } });
const lilac = (t: string) => ({ t, style: lilacText });

export const EveryWeek: React.FC = () => {
  const f = useCurrentFrame();
  const words = ["we", "ask", "AI"];
  return (
    <Light>
      <Center>
        <span
          style={{
            ...head(140, C.cobalt),
            opacity: io(f, 0, 8, 0, 1),
            filter: `blur(${io(f, 0, 12, 14, 0)}px)`,
            transform: `translateY(${io(f, 24, 40, 0, -64)}px) scale(${io(f, 0, 12, 1.12, 1) * io(f, 24, 40, 1, 0.55)})`,
          }}
        >
          Every week,
        </span>
      </Center>
      <Center style={{ paddingTop: 60 }}>
        <span style={{ display: "inline-flex", gap: 22 }}>
          {words.map((w, i) => {
            const s = 38 + i * 6;
            return (
              <span
                key={w}
                style={{
                  ...head(84, w === "AI" ? C.cobalt : C.navy),
                  display: "inline-block",
                  opacity: io(f, s, s + 6, 0, 1),
                  transform: `translateY(${io(f, s, s + 14, 80, 0)}px) rotate(${io(f, s, s + 14, i % 2 ? 9 : -9, 0)}deg)`,
                }}
              >
                {w}
              </span>
            );
          })}
        </span>
      </Center>
    </Light>
  );
};

const ORBIT: { engine: Engine; r: number; a: number; size: number }[] = [
  { engine: "chatgpt", r: 300, a: 200, size: 66 },
  { engine: "gemini", r: 300, a: 330, size: 66 },
  { engine: "perplexity", r: 440, a: 290, size: 72 },
  { engine: "google", r: 440, a: 155, size: 72 },
  { engine: "claude", r: 440, a: 30, size: 72 },
];
const QUESTIONS = ["best beard oil for dry skin?", "unscented beard oil?", "beard gift under $80?"];

export const Orbit: React.FC = () => {
  const f = useCurrentFrame();
  const local = Math.max(0, f - 8);
  const qi = Math.min(QUESTIONS.length - 1, Math.floor(local / 38));
  const t = local - qi * 38;
  const last = qi === QUESTIONS.length - 1;
  const qOpacity = io(t, 0, 8, 0, 1) * (last ? 1 : io(t, 30, 38, 1, 0));
  return (
    <Dark dots={false}>
      <svg width={1280} height={800} style={{ position: "absolute", inset: 0 }}>
        {[180, 300, 440].map((r, i) => (
          <circle
            key={r}
            cx={640}
            cy={400}
            r={r * io(f, 0, 20, 0.85, 1)}
            fill="none"
            stroke="rgba(160, 175, 245, 0.35)"
            strokeWidth={1.6}
            strokeDasharray="2 10"
            strokeDashoffset={-f * (i % 2 ? 0.8 : -0.6)}
            opacity={io(f, i * 3, i * 3 + 14, 0, 1)}
          />
        ))}
      </svg>
      {ORBIT.map((o, i) => {
        const a = ((o.a + f * 0.45) * Math.PI) / 180;
        const s = io(f, 6 + i * 4, 18 + i * 4, 0, 1);
        return (
          <Coin
            key={o.engine}
            engine={o.engine}
            size={o.size}
            style={{
              position: "absolute",
              left: 640 + Math.cos(a) * o.r - o.size / 2,
              top: 400 + Math.sin(a) * o.r - o.size / 2,
              transform: `scale(${s})`,
              opacity: s,
            }}
          />
        );
      })}
      <Center>
        <span
          style={{
            fontFamily: FONT_BODY,
            fontSize: 32,
            fontWeight: 500,
            color: "#fff",
            padding: "20px 34px",
            borderRadius: 40,
            background: "linear-gradient(180deg, rgba(255,255,255,0.2), rgba(255,255,255,0.07))",
            border: "1.5px solid rgba(255,255,255,0.6)",
            boxShadow: "0 0 34px rgba(150, 165, 245, 0.45)",
            opacity: qOpacity,
            filter: `blur(${(1 - qOpacity) * 8}px)`,
            transform: `translateY(${(1 - qOpacity) * 10}px)`,
          }}
        >
          {QUESTIONS[qi]}
        </span>
      </Center>
    </Dark>
  );
};

const PICKS = [
  { name: "Ridgeback", x: 250, streams: 8 },
  { name: "Saltbush", x: 510, streams: 6 },
  { name: "Banksia", x: 770, streams: 4 },
  { name: "You", x: 1030, streams: 1 },
];

export const WhoPicks: React.FC = () => {
  const f = useCurrentFrame();
  const chipY = 590;
  const glow = io(f, 52, 70, 0, 1);
  return (
    <Dark>
      <ExampleTag style={TAG} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 108 }}>
        <Rise words={["We", "see", "who", "AI", "picks."]} style={head(60, "#fff")} at={0} />
      </AbsoluteFill>
      <svg width={1280} height={800} style={{ position: "absolute", inset: 0, opacity: io(f, 8, 22, 0, 1) }}>
        {PICKS.flatMap((p, j) =>
          Array.from({ length: p.streams }, (_, k) => {
            const sx = p.x + (k - (p.streams - 1) / 2) * 52 + (j - 1.5) * 40;
            return (
              <path
                key={`${j}-${k}`}
                d={`M ${sx} 210 C ${sx} 380, ${p.x} 400, ${p.x} ${chipY - 34}`}
                fill="none"
                stroke="#a8c4ff"
                strokeOpacity={0.85}
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeDasharray="0.5 10"
                strokeDashoffset={-f * 2.4 + k * 4}
              />
            );
          }),
        )}
      </svg>
      {PICKS.map((p, j) => {
        const you = p.name === "You";
        const s = io(f, 12 + j * 4, 24 + j * 4, 0, 1);
        return (
          <span
            key={p.name}
            style={{
              position: "absolute",
              left: p.x,
              top: chipY,
              transform: `translate(-50%, -50%) scale(${0.8 + s * 0.2})`,
              opacity: s,
              ...head(28, you ? "#d9d4ff" : C.navy, { letterSpacing: "-0.5px" }),
              padding: "16px 30px",
              borderRadius: 18,
              background: you ? "rgba(201, 194, 255, 0.08)" : "linear-gradient(180deg, #ffffff, #eef0fb)",
              border: you ? "2px dashed rgba(201, 194, 255, 0.85)" : "2px solid transparent",
              boxShadow: you ? `0 0 ${glow * 40}px rgba(160, 150, 255, ${glow * 0.7})` : "0 0 24px rgba(150, 175, 255, 0.35)",
            }}
          >
            {p.name}
          </span>
        );
      })}
    </Dark>
  );
};

export const Rewrite: React.FC = () => {
  const f = useCurrentFrame();
  const newTitle = "Beard Oil for Dry Skin, Unscented";
  const n = Math.floor(io(f, 36, 62, 0, newTitle.length, (t) => t));
  const press = io(f, 92, 96, 0, 1) * io(f, 98, 104, 1, 0);
  const done = f >= 98;
  const cx = io(f, 68, 92, 760, 418);
  const cy = io(f, 68, 92, 520, 342);
  return (
    <Light>
      <ExampleTag style={TAG} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 92 }}>
        <Rise words={["We", "rewrite", "your", cobalt("product pages")]} style={head(56, C.navy)} at={0} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 200, perspective: 1600 }}>
        <div
          style={{
            position: "relative",
            width: 720,
            height: 410,
            padding: 28,
            display: "flex",
            gap: 30,
            borderRadius: 28,
            background: "#fff",
            boxShadow: SHADOW_LG,
            fontFamily: FONT_BODY,
            opacity: io(f, 4, 14, 0, 1),
            transform: `translateY(${io(f, 4, 30, 70, 0)}px) rotateY(${io(f, 4, 34, -22, -6)}deg) rotateX(${io(f, 4, 34, 12, 3)}deg)`,
          }}
        >
          <Img src={staticFile("guide-beard-oil.jpg")} style={{ width: 250, height: 354, objectFit: "cover", borderRadius: 18, flex: "none" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: C.muted }}>Product title</span>
            <span style={{ position: "relative", alignSelf: "flex-start", ...head(28, C.navy), opacity: io(f, 30, 40, 1, 0.35) }}>
              Beard Oil 30ml
              <i style={{ position: "absolute", left: 0, top: "54%", height: 3, borderRadius: 2, background: C.red, width: `${io(f, 18, 30, 0, 100)}%` }} />
            </span>
            <span style={{ ...head(28, C.cobalt, { whiteSpace: "normal" }), minHeight: 64 }}>
              {newTitle.slice(0, n)}
              {f >= 36 && f < 70 && Math.floor(f / 7) % 2 === 0 ? "|" : ""}
            </span>
            <span
              style={{
                marginTop: 4,
                padding: "13px 16px",
                borderRadius: 14,
                background: C.lilac50,
                fontSize: 18,
                fontWeight: 500,
                color: C.navy,
                opacity: io(f, 58, 68, 0, 1),
                transform: `translateX(${io(f, 58, 72, -24, 0)}px)`,
              }}
            >
              <b style={{ color: C.cobalt, marginRight: 10 }}>FAQ</b>Is it OK for sensitive skin?
            </span>
          </div>
          <span
            style={{
              position: "absolute",
              left: 338,
              top: 318,
              height: 54,
              padding: "0 28px",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              borderRadius: 999,
              fontSize: 19,
              fontWeight: 600,
              color: done ? C.greenInk : "#fff",
              background: done ? C.greenBg : GRAD_BTN,
              boxShadow: done ? `inset 0 0 0 1.5px ${C.green}` : "0 10px 22px -10px rgba(21,22,60,0.6)",
              transform: `scale(${1 - press * 0.06 + (done ? io(f, 98, 104, 0.06, 0) : 0)})`,
              opacity: io(f, 64, 72, 0, 1),
            }}
          >
            {done ? "✓  Live on your store" : "Approve"}
          </span>
          <div style={{ opacity: io(f, 66, 72, 0, 1) * io(f, 116, 124, 1, 0) }}>
            <Cursor x={cx} y={cy} press={press} />
          </div>
        </div>
      </AbsoluteFill>
    </Light>
  );
};

export const Guides: React.FC = () => {
  const f = useCurrentFrame();
  const lines = [94, 88, 91, 62];
  return (
    <Light>
      <ExampleTag style={TAG} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 92 }}>
        <Rise words={["We", "write", cobalt("buying guides")]} style={head(56, C.navy)} at={0} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 196, perspective: 1600 }}>
        <div
          style={{
            width: 800,
            borderRadius: 26,
            background: "#fff",
            boxShadow: SHADOW_LG,
            overflow: "hidden",
            fontFamily: FONT_BODY,
            opacity: io(f, 4, 14, 0, 1),
            transform: `translateY(${io(f, 4, 32, 140, 0)}px) rotateX(${io(f, 4, 34, 22, 0)}deg)`,
          }}
        >
          <div style={{ height: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 18px", background: C.warm50, borderBottom: `1px solid ${C.line}` }}>
            {[0, 1, 2].map((i) => (
              <i key={i} style={{ width: 11, height: 11, borderRadius: "50%", background: "#e2e2e6" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 30, padding: "30px 34px 36px" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: C.cobalt }}>Guide</span>
              <span style={{ ...head(38, C.navy, { whiteSpace: "normal", lineHeight: 1.12 }) }}>Best beard oil for dry skin</span>
              {lines.map((w, i) => (
                <i key={i} style={{ display: "block", height: 12, borderRadius: 6, background: C.warm100, width: `${io(f, 26 + i * 6, 40 + i * 6, 0, w)}%` }} />
              ))}
            </div>
            <Img
              src={staticFile("guide-beard-oil.jpg")}
              style={{ width: 250, height: 210, objectFit: "cover", borderRadius: 18, flex: "none", opacity: io(f, 20, 32, 0, 1) }}
            />
          </div>
        </div>
      </AbsoluteFill>
    </Light>
  );
};

const SITES = [
  { name: "The Groom Guide", x: 300, y: 340 },
  { name: "Beard Weekly", x: 640, y: 300 },
  { name: "Present Picks", x: 980, y: 340 },
];

export const Sites: React.FC = () => {
  const f = useCurrentFrame();
  const mail = { x: 640, y: 600 };
  return (
    <Dark>
      <ExampleTag style={TAG} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 100 }}>
        <Rise words={["We", "find", "the", "sites", lilac("AI trusts")]} style={head(58, "#fff")} at={0} />
      </AbsoluteFill>
      <svg width={1280} height={800} style={{ position: "absolute", inset: 0 }}>
        {SITES.map((s, i) => (
          <path
            key={s.name}
            d={`M ${mail.x} ${mail.y - 40} C ${mail.x} ${mail.y - 140}, ${s.x} ${s.y + 170}, ${s.x} ${s.y + 60}`}
            fill="none"
            stroke="#a8c4ff"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeDasharray="0.5 10"
            strokeDashoffset={f * 2.4}
            opacity={io(f, 50 + i * 4, 60 + i * 4, 0, 0.9)}
          />
        ))}
      </svg>
      {SITES.map((s, i) => {
        const p = io(f, 10 + i * 6, 24 + i * 6, 0, 1);
        const sent = f >= 62 + i * 6;
        return (
          <div
            key={s.name}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y,
              width: 270,
              padding: "20px 22px",
              borderRadius: 20,
              background: "linear-gradient(180deg, rgba(255,255,255,0.13), rgba(255,255,255,0.05))",
              border: "1px solid rgba(255,255,255,0.22)",
              boxShadow: sent ? "0 0 30px rgba(120, 220, 160, 0.35)" : "0 0 30px rgba(125,140,240,0.2)",
              transform: `translate(-50%, -50%) translateY(${(1 - p) * 30}px)`,
              opacity: p,
              fontFamily: FONT_BODY,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.14)", color: "#fff", fontWeight: 700, fontSize: 17 }}>
                {s.name[s.name.startsWith("The ") ? 4 : 0]}
              </span>
              <span style={{ ...head(22, "#fff", { letterSpacing: "-0.3px" }) }}>{s.name}</span>
              {sent && <span style={{ marginLeft: "auto", color: C.green, fontSize: 22, fontWeight: 700 }}>✓</span>}
            </div>
            <i style={{ display: "block", height: 9, borderRadius: 5, background: "rgba(255,255,255,0.14)", marginTop: 16, width: "92%" }} />
            <i style={{ display: "block", height: 9, borderRadius: 5, background: "rgba(255,255,255,0.14)", marginTop: 9, width: "64%" }} />
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: mail.x,
          top: mail.y,
          transform: `translate(-50%, -50%) translateY(${io(f, 36, 50, 60, 0)}px)`,
          opacity: io(f, 36, 46, 0, 1),
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 26px",
          borderRadius: 18,
          background: "#fff",
          boxShadow: "0 0 40px rgba(150, 165, 245, 0.5)",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.cobalt} strokeWidth="1.9" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m4 7 8 6 8-6" />
        </svg>
        <span style={head(25, C.navy, { letterSpacing: "-0.4px" })}>Pitch written</span>
      </div>
    </Dark>
  );
};

const SOURCES: { engine: Engine; label: string; pct: number }[] = [
  { engine: "chatgpt", label: "ChatGPT", pct: 62 },
  { engine: "perplexity", label: "Perplexity", pct: 21 },
  { engine: "gemini", label: "Gemini", pct: 17 },
];

export const Money: React.FC = () => {
  const f = useCurrentFrame();
  const revenue = Math.round(io(f, 18, 66, 0, 4280));
  const orders = Math.round(io(f, 18, 66, 0, 37));
  const clicks = Math.round(io(f, 18, 66, 0, 612));
  const pill: React.CSSProperties = { padding: "9px 16px", borderRadius: 999, background: C.lilac50, color: C.navy, fontSize: 18, fontWeight: 600 };
  return (
    <Light>
      <ExampleTag style={TAG} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 86 }}>
        <Rise words={["You", "see", "the", cobalt("sales from AI.")]} style={head(56, C.navy)} at={0} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 196, perspective: 1500 }}>
        <div
          style={{
            width: 860,
            padding: "34px 38px",
            display: "flex",
            gap: 40,
            borderRadius: 28,
            background: "#fff",
            boxShadow: SHADOW_LG,
            fontFamily: FONT_BODY,
            opacity: io(f, 4, 14, 0, 1),
            transform: `translateY(${io(f, 4, 34, 90, 0)}px) rotateX(${io(f, 4, 36, 30, 4)}deg) rotateY(${io(f, 4, 36, -12, -3)}deg) scale(${io(f, 4, 36, 0.9, 1)})`,
          }}
        >
          <div style={{ flex: 1.1, display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: C.muted }}>Money from AI · this month</span>
            <span className="tnum" style={head(92, C.navy, { letterSpacing: "-3px", lineHeight: 1.05 })}>
              ${revenue.toLocaleString("en-US")}
            </span>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <span className="tnum" style={pill}>{orders} orders</span>
              <span className="tnum" style={pill}>{clicks} clicks</span>
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18, justifyContent: "center" }}>
            {SOURCES.map((s, i) => (
              <div key={s.engine} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Coin engine={s.engine} size={34} style={{ boxShadow: `inset 0 0 0 1px ${C.line}` }} />
                <span style={{ width: 96, fontSize: 17, fontWeight: 600, color: C.navy }}>{s.label}</span>
                <span style={{ flex: 1, height: 12, borderRadius: 6, background: C.warm100, overflow: "hidden" }}>
                  <i
                    style={{
                      display: "block",
                      height: "100%",
                      borderRadius: 6,
                      background: "linear-gradient(90deg, #9ea9f5, #4050b0)",
                      width: `${io(f, 30 + i * 6, 70 + i * 6, 0, s.pct)}%`,
                    }}
                  />
                </span>
                <span className="tnum" style={{ width: 44, textAlign: "right", fontSize: 16, fontWeight: 600, color: C.text }}>
                  {Math.round(io(f, 30 + i * 6, 70 + i * 6, 0, s.pct))}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </Light>
  );
};

export const Slogan: React.FC = () => (
  <Dark>
    <Center style={{ gap: 6 }}>
      <Rise words={["Shoppers", "ask."]} style={head(76, "#fff")} at={0} />
      <Rise words={["AI", "recommends."]} style={head(76, "#fff")} at={20} />
      {/* the gradient goes on each word: on the line it wouldn't paint the words (they have their own blur) */}
      <Rise words={["You", "get", "the", "sale."].map((t) => ({ t, style: lilacText }))} style={head(76, "#fff")} at={40} />
    </Center>
  </Dark>
);

export const Join: React.FC = () => {
  const f = useCurrentFrame();
  const site = "usegeo.app";
  return (
    <Dark>
      <Center>
        <div style={{ display: "flex", alignItems: "baseline", gap: 30 }}>
          <Rise words={["Join", "the", "waitlist"]} style={head(64, "#fff")} at={0} />
          <span style={head(64, "#d4dbff", { textShadow: "0 0 18px rgba(125,140,240,0.9), 0 0 42px rgba(125,140,240,0.5)" })}>
            {site.split("").map((ch, i) => (
              <span key={i} style={{ opacity: io(f, 18 + i * 2, 24 + i * 2, 0, 1), filter: `blur(${io(f, 18 + i * 2, 26 + i * 2, 8, 0)}px)` }}>
                {ch}
              </span>
            ))}
          </span>
        </div>
      </Center>
    </Dark>
  );
};

/** The logo end card, which fades back to the opening's dark background so the loop joins up. */
export const EndCard: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = io(f, duration - 16, duration, 0, 1, (t) => t);
  const pop = spring({ frame: f, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${0.98 + pop * 0.02})` }}>
        <LogoReveal tagAt={30} />
      </div>
      {/* the opening's first frame, frozen, so the last frame leads straight back into frame 0 */}
      <AbsoluteFill style={{ opacity: out }}>
        <Freeze frame={0}>
          <Dark />
        </Freeze>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
