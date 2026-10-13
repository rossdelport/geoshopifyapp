// The explainer's first half: the shift (shoppers ask AI now), the stakes (AI picks a few brands) and the
// GEO logo. Each scene draws only itself and counts frames from its own start.
import React from "react";
import { AbsoluteFill, spring, useVideoConfig } from "remotion";
import { ExampleTag } from "../TestCard";
import { FONT_BODY } from "../fonts";
import { C, SHADOW_LG } from "../theme";
import { Center, Coin, Dark, GeoMark, Light, Rise, StreakIn, head, io, lilacText, useF } from "./kit";

const TAG: React.CSSProperties = { position: "absolute", right: 28, top: 24 };

/** "Shoppers" streaks in, then "don’t just" rises beside it (one screen, Ross 13 Oct 2026). The line starts with
 *  "Shoppers" in the middle and slides left to make room. */
export const Shoppers: React.FC = () => {
  const f = useF();
  const p = io(f, 3, 17, 0, 1);
  const x = (1 - p) * -220;
  const word = head(100, "#fff", { textShadow: "0 0 24px rgba(150, 165, 245, 0.35)" });
  return (
    <Dark>
      <Center>
        <div style={{ display: "flex", alignItems: "baseline", gap: 28, transform: `translateX(${io(f, 16, 30, 236, 0)}px)` }}>
          <span style={{ position: "relative", display: "inline-block" }}>
            {[5, 4, 3, 2, 1].map((k) => (
              <span
                key={k}
                style={{
                  ...word,
                  position: "absolute",
                  left: 0,
                  top: 0,
                  color: "#7d8cf0",
                  textShadow: "none",
                  opacity: (1 - p) * (0.5 - k * 0.07),
                  filter: `blur(${4 + k * 2}px)`,
                  transform: `translateX(${x - k * 26 * (1 - p)}px) scaleX(${1 + (1 - p) * 0.5})`,
                }}
              >
                Shoppers
              </span>
            ))}
            <span
              style={{
                ...word,
                display: "inline-block",
                opacity: io(f, 3, 9, 0, 1),
                filter: `blur(${(1 - p) * 6}px)`,
                transform: `translateX(${x}px) scaleX(${1 + (1 - p) * 0.25})`,
              }}
            >
              Shoppers
            </span>
          </span>
          <Rise words={["don’t", "just"].map((t) => ({ t, style: lilacText }))} style={head(100, "#fff")} at={20} />
        </div>
      </Center>
    </Dark>
  );
};

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

// "They ask": a chat window where a shopper asks and the AI starts answering (Ross: "more like a chat interface").
const CHAT: { who: "you" | "ai"; text?: string; at: number; answerAt?: number }[] = [
  { who: "you", text: "Which beard oil should I buy?", at: 10 },
  { who: "ai", at: 22, answerAt: 38 },
  { who: "you", text: "Something for dry skin?", at: 50 },
  { who: "ai", at: 62 },
];

const Typing: React.FC<{ f: number }> = ({ f }) => (
  <span style={{ display: "inline-flex", gap: 6, padding: "4px 2px" }}>
    {[0, 1, 2].map((k) => (
      <i key={k} style={{ width: 9, height: 9, borderRadius: "50%", background: C.muted, opacity: 0.35 + 0.65 * Math.max(0, Math.sin((f - k * 4) / 3)) }} />
    ))}
  </span>
);

export const TheyAsk: React.FC = () => {
  const f = useF();
  const pop = (at: number): React.CSSProperties => ({
    opacity: io(f, at, at + 6, 0, 1),
    transform: `translateY(${io(f, at, at + 10, 16, 0)}px) scale(${io(f, at, at + 10, 0.88, 1)})`,
  });
  return (
    <Light>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
        <Rise words={["They", "ask"]} style={head(76, C.navy)} at={0} />
        <div
          style={{
            marginTop: 30,
            width: 640,
            height: 470,
            display: "flex",
            flexDirection: "column",
            borderRadius: 28,
            overflow: "hidden",
            background: "#fff",
            boxShadow: SHADOW_LG,
            fontFamily: FONT_BODY,
            opacity: io(f, 2, 12, 0, 1),
            transform: `translateY(${io(f, 2, 22, 50, 0)}px)`,
          }}
        >
          <div style={{ height: 62, flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "0 22px", borderBottom: `1px solid ${C.line}` }}>
            <span style={{ width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", background: "radial-gradient(circle at 35% 30%, #9ea9f5, #4050b0)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                <path d="M12 2.5c.6 5 4.5 8.9 9.5 9.5-5 .6-8.9 4.5-9.5 9.5-.6-5-4.5-8.9-9.5-9.5 5-.6 8.9-4.5 9.5-9.5Z" />
              </svg>
            </span>
            <span style={{ fontSize: 18, fontWeight: 600, color: C.navy }}>AI assistant</span>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 14, padding: "18px 22px", background: "#fbfbfe" }}>
            {CHAT.filter((m) => f >= m.at).map((m) =>
              m.who === "you" ? (
                <div key={m.at} style={{ alignSelf: "flex-end", transformOrigin: "100% 100%", ...pop(m.at) }}>
                  <span style={{ display: "block", fontSize: 22, fontWeight: 500, color: "#fff", padding: "13px 20px", borderRadius: "22px 22px 6px 22px", background: "linear-gradient(180deg, #6878d8, #4050b0)" }}>
                    {m.text}
                  </span>
                </div>
              ) : (
                <div key={m.at} style={{ alignSelf: "flex-start", transformOrigin: "0% 100%", ...pop(m.at) }}>
                  <span style={{ display: "block", padding: "14px 20px", borderRadius: "22px 22px 22px 6px", background: C.warm100 }}>
                    {m.answerAt !== undefined && f >= m.answerAt ? (
                      <span style={{ display: "flex", flexDirection: "column", gap: 9, width: 300, padding: "4px 0" }}>
                        {[100, 88, 64].map((w, i) => (
                          <i key={i} style={{ display: "block", height: 10, borderRadius: 5, background: "#d9d9e3", width: `${io(f, m.answerAt! + i * 4, m.answerAt! + 10 + i * 4, 0, w)}%` }} />
                        ))}
                      </span>
                    ) : (
                      <Typing f={f} />
                    )}
                  </span>
                </div>
              ),
            )}
          </div>
          <div style={{ height: 70, flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "0 16px 0 22px", borderTop: `1px solid ${C.line}` }}>
            <span style={{ flex: 1, fontSize: 18, color: C.muted }}>Ask anything</span>
            <span style={{ width: 42, height: 42, borderRadius: "50%", display: "grid", placeItems: "center", background: C.navy }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5" />
                <path d="m5 12 7-7 7 7" />
              </svg>
            </span>
          </div>
        </div>
      </AbsoluteFill>
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
        <Rise words={["AI", "then", "picks", { t: "a few", style: { color: C.cobalt } }, "brands."]} style={head(60, C.navy)} at={0} />
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
