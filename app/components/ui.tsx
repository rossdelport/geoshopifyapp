// Small visual building blocks used across the app.

import type { ReactNode } from "react";

export const ENGINE_COLORS: Record<string, string> = {
  chatgpt: "#10a37f",
  gemini: "#4285f4",
  perplexity: "#20808d",
  aio: "#f29900",
  claude: "#d97757",
  copilot: "#0078d4",
  meta_ai: "#0866ff",
  other_ai: "#8c9196",
  ours: "#7c5cff",
  survey: "#b98900",
};

export function EnginePill({ engine, label, off }: { engine: string; label: string; off?: boolean }) {
  return (
    <span className={`geo-pill${off ? " geo-pill--off" : ""}`}>
      <i style={{ background: ENGINE_COLORS[engine] ?? "#8c9196" }} />
      {label}
    </span>
  );
}

export function ScoreRing({ score, size = 116, caption = "out of 100" }: { score: number | null; size?: number; caption?: string }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const value = Math.max(0, Math.min(100, score ?? 0));
  const color = value >= 60 ? "#0f7a55" : value >= 30 ? "#2c6ecb" : value >= 10 ? "#b98900" : "#c4314b";
  return (
    <div className="geo-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f1f2" strokeWidth="12" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`}
          style={{ transition: "stroke-dasharray .8s ease" }}
        />
      </svg>
      <div className="geo-ring__num">
        <div>
          <b>{score === null ? "–" : Math.round(value)}</b>
          <span>{caption}</span>
        </div>
      </div>
    </div>
  );
}

export function Sparkline({ values, width = 220, height = 48 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) {
    return <div className="geo-small">The trend line appears after your next scan.</div>;
  }
  const max = Math.max(100, ...values);
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 4 - (v / max) * (height - 8)]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ maxWidth: width, height }} aria-label="Score trend">
      <polygon points={area} fill="rgba(16,163,127,0.10)" />
      <polyline points={line} fill="none" stroke="#10a37f" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3.5" fill="#0f7a55" />
    </svg>
  );
}

export function SplitBar({ parts }: { parts: { key: string; label: string; value: number }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return null;
  return (
    <div>
      <div className="geo-split" role="img" aria-label="Split by AI assistant">
        {parts.map((p) => (
          <span key={p.key} style={{ width: `${(p.value / total) * 100}%`, background: ENGINE_COLORS[p.key] ?? "#8c9196" }} />
        ))}
      </div>
      <div className="geo-legend">
        {parts.map((p) => (
          <span key={p.key}>
            <i style={{ background: ENGINE_COLORS[p.key] ?? "#8c9196" }} />
            {p.label} · {Math.round((p.value / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function Bar({ value, tone = "you" }: { value: number; tone?: "you" | "them" }) {
  return (
    <div className={`geo-bar geo-bar--${tone}`}>
      <span style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="geo-empty">
      <b>{title}</b>
      {children}
    </div>
  );
}

export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="geo-steps">
      {steps.map((s, i) => (
        <li key={s} className={i < current ? "done" : i === current ? "now" : ""}>
          <span className="dot">{i < current ? "✓" : i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

/** Highlight the merchant's brand in an AI answer. */
export function HighlightedAnswer({ text, names }: { text: string; names: string[] }) {
  const clean = names.filter((n) => n.length >= 3);
  if (!clean.length) return <div className="geo-answer">{text}</div>;
  const re = new RegExp(`(${clean.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(re);
  return (
    <div className="geo-answer">
      {parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part))}
    </div>
  );
}
