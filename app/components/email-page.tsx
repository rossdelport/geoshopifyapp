// The small pages our report emails link to (/unsubscribe, /tips): a white card on the lilac gradient
// with the GEO mark. Inline styles, so they need no stylesheet. No login.

import type { ReactNode } from "react";

export const EMAIL_PAGE_FONTS = [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Geist:wght@500;600&family=Inter:wght@400;500;600&display=swap" },
];

export const emailPage = {
  page: {
    minHeight: "100vh",
    margin: 0,
    padding: "64px 16px",
    boxSizing: "border-box" as const,
    background: "linear-gradient(180deg, #efecfd 0%, #e2e2fc 55%, #bfc9fa 100%)",
    fontFamily: "Inter, system-ui, sans-serif",
    color: "#30313d",
  },
  card: {
    maxWidth: 440,
    margin: "0 auto",
    background: "#fff",
    borderRadius: 20,
    padding: "32px 28px",
    boxShadow: "0 24px 48px -24px rgba(56, 64, 160, 0.28), 0 8px 16px -10px rgba(56, 64, 160, 0.14)",
  },
  logo: { display: "inline-flex", alignItems: "center", gap: 8, color: "#0b0c2b", textDecoration: "none", fontFamily: "Geist, Inter, sans-serif", fontWeight: 600, fontSize: 18, marginBottom: 20 },
  h1: { fontFamily: "Geist, Inter, sans-serif", fontSize: 24, lineHeight: 1.25, color: "#0b0c2b", margin: "0 0 10px" },
  p: { fontSize: 15, lineHeight: 1.6, margin: "0 0 18px", color: "#45466e" },
  button: {
    appearance: "none" as const,
    border: 0,
    borderRadius: 999,
    background: "linear-gradient(180deg, #373868 0%, #15163c 100%)",
    color: "#fff",
    font: "600 15px Inter, system-ui, sans-serif",
    padding: "13px 22px",
    cursor: "pointer",
  },
  link: { color: "#4050b0" },
};

export function EmailPage({ children }: { children: ReactNode }) {
  return (
    <main style={emailPage.page}>
      <div style={emailPage.card}>
        <a href="/" style={emailPage.logo} aria-label="GEO home">
          <svg width="22" height="22" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="13.5" cy="13.5" r="13.5" fill="#9faaf2" />
            <circle cx="26.5" cy="26.5" r="13.5" fill="#4050b0" />
          </svg>
          GEO
        </a>
        {children}
      </div>
    </main>
  );
}
