// Small shared pieces for the GEO web app pages (usegeo.app/login, /start, /dash).
import type { ReactNode } from "react";

export function Logo() {
  return (
    <a className="w-logo" href="/">
      <i aria-hidden="true" />
      GEO
    </a>
  );
}

/** One white card on the lilac gradient: sign in, check your email, add your store. */
export function Solo({ children }: { children: ReactNode }) {
  return (
    <div className="w">
      <main className="w-solo">
        <div className="w-card">
          <Logo />
          {children}
        </div>
      </main>
    </div>
  );
}

/** A simple line icon from one SVG path (20 × 20). */
export function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** The bar at the top of every dashboard page: its name on the left, small facts or buttons on the right. */
export function PageHead({ title, intro, right }: { title: string; intro?: ReactNode; right?: ReactNode }) {
  return (
    <>
      <header className="w-bar">
        <h1>{title}</h1>
        {right ? <div className="w-bar-right">{right}</div> : null}
      </header>
      {intro ? <p className="w-intro">{intro}</p> : null}
    </>
  );
}

/** One number card: a label with its icon, the number, and a line on what it means. */
export function Stat({ label, icon, value, caption, hero }: { label: string; icon: string; value: ReactNode; caption: ReactNode; hero?: boolean }) {
  return (
    <section className={`w-stat${hero ? " hero" : ""}`}>
      <div className="w-stat-top">
        <span>{label}</span>
        <Icon d={icon} />
      </div>
      <div className="w-stat-num">{value}</div>
      <div className="w-stat-cap">{caption}</div>
    </section>
  );
}

export const ICONS = {
  home: "M3 10.5 10 4l7 6.5V17h-5v-4H8v4H3z",
  question: "M7.5 7.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M10 15h.01M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  shield: "M10 2.5 3.5 5v4.5c0 4 2.8 7 6.5 8 3.7-1 6.5-4 6.5-8V5zM7 10l2 2 4-4",
  code: "M7 6 3 10l4 4M13 6l4 4-4 4",
  mail: "M3 5h14v10H3zM3 5l7 6 7-6",
  money: "M10 2.5v15M13.5 5.5H8.3a2.3 2.3 0 0 0 0 4.6h3.4a2.3 2.3 0 0 1 0 4.6H6",
  bag: "M4 7h12l-1 10H5zM7 7V5.5a3 3 0 0 1 6 0V7",
  click: "M8 3v3M3 8h3M4.5 4.5l2 2M9 9l7.5 3-3.2 1.3L12 16.5z",
  gauge: "M3.5 14a6.5 6.5 0 1 1 13 0M10 14l3-4",
  user: "M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 17.5a6.5 6.5 0 0 1 13 0",
  send: "M17.5 2.5 9 11M17.5 2.5 12 17.5 9 11 2.5 8z",
  out: "M8 3H4v14h4M13 6l4 4-4 4M17 10H8",
  chat: "M3.5 4.5h13v9h-7l-4 3v-3h-2z",
};
