// Small shared pieces for the GEO web app pages (usegeo.app/login, /start, /dash).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigation } from "react-router";

// useLayoutEffect warns on the server; this runs it only in the browser.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function Logo({ to }: { to?: string }) {
  // Inside the app the logo goes to the dashboard without reloading; on the sign-in pages it goes to the website.
  return to ? (
    <Link className="w-logo" to={to} prefetch="intent">
      <i aria-hidden="true" />
      GEO
    </Link>
  ) : (
    <a className="w-logo" href="/">
      <i aria-hidden="true" />
      GEO
    </a>
  );
}

/** One white card on a quiet grey page: sign in, check your email, add your store. */
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
  spark: "M10 2.5l1.8 4.7 4.7 1.8-4.7 1.8L10 15.5l-1.8-4.7L3.5 9l4.7-1.8zM15.5 13.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z",
  check: "M5 10.5l3 3 7-7",
};

/** True once a page has been loading for a moment, so quick loads swap straight to the new page without a skeleton
 * flashing in between. `key` is the loading navigation's key (null when nothing is loading). */
export function useSlowLoad(key: string | null, delay = 140) {
  const [late, setLate] = useState<string | null>(null);
  useEffect(() => {
    if (!key) return;
    const t = setTimeout(() => setLate(key), delay);
    return () => clearTimeout(t);
  }, [key, delay]);
  return key !== null && late === key;
}

/** The thin purple bar across the top while a page loads (styles: .w-loadbar). */
export function LoadBar() {
  const busy = useNavigation().state !== "idle";
  return <div className="w-loadbar" data-state={busy ? "loading" : "done"} aria-hidden="true" />;
}

/** A button that copies text and says "Copied" for a moment. */
export function CopyButton({ text, label = "Copy", className = "w-btn w-btn-ghost w-btn-sm", onFail }: { text: string; label?: string; className?: string; onFail?: () => void }) {
  const [done, setDone] = useState(false);
  const [used, setUsed] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 2000);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setUsed(true);
          setDone(true);
        } catch {
          onFail?.(); // no clipboard (an old browser or a frame): the text is on screen to select
        }
      }}
    >
      <span key={done ? "done" : "copy"} className={used ? "w-swap" : undefined}>
        {done ? (
          <>
            <Icon d={ICONS.check} /> Copied
          </>
        ) : (
          label
        )}
      </span>
    </button>
  );
}

export type TabItem = { to: string; label: string; count?: number; active: boolean };

/** Tabs on a grey track; a white pill slides to the chosen one (styles: .w-tabs). */
export function Tabs({ items, label, className }: { items: TabItem[]; label: string; className?: string }) {
  const bar = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  const at = items.findIndex((t) => t.active);
  const sig = items.map((t) => `${t.label}${t.count ?? ""}`).join("|");

  useIsoLayoutEffect(() => {
    const nav = bar.current;
    const p = pill.current;
    const tab = nav?.querySelectorAll<HTMLElement>("a")[at];
    if (!nav || !p || !tab) {
      nav?.removeAttribute("data-ready");
      placed.current = false;
      return;
    }
    let last = "";
    const place = (animate: boolean) => {
      const now = `${tab.offsetLeft},${tab.offsetWidth}`;
      if (now === last) return;
      last = now;
      if (!animate) p.style.transition = "none";
      p.style.transform = `translateX(${tab.offsetLeft}px)`;
      p.style.width = `${tab.offsetWidth}px`;
      if (!animate) {
        void p.offsetWidth;
        p.style.transition = "";
      }
    };
    place(placed.current); // slide when the tab changes; jump into place the first time
    placed.current = true;
    nav.setAttribute("data-ready", "");
    // Fonts loading or a count changing resizes the tab: follow it without animating.
    const ro = new ResizeObserver(() => place(false));
    ro.observe(tab);
    return () => ro.disconnect();
  }, [at, sig]);

  return (
    <nav ref={bar} className={`w-tabs${className ? ` ${className}` : ""}`} aria-label={label}>
      <span ref={pill} className="w-tabs-pill" aria-hidden="true" />
      {items.map((t) => (
        <Link key={t.to} to={t.to} prefetch="intent" preventScrollReset className={t.active ? "active" : undefined} aria-current={t.active ? "page" : undefined}>
          {t.label}
          {t.count !== undefined ? <span>{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/* ---------- Skeletons: grey shapes in a page's layout while its data loads ---------- */

const Sk = ({ w = "100%", h = 12, r }: { w?: number | string; h?: number; r?: number }) => (
  <span className="w-sk" style={{ width: w, height: h, borderRadius: r }} />
);

function SkHead({ title = 150, chips = 1, intro = false }: { title?: number; chips?: number; intro?: boolean }) {
  return (
    <>
      <div className="w-skel-bar">
        <Sk w={title} h={16} />
        <span style={{ display: "flex", gap: 8 }}>
          {Array.from({ length: chips }, (_, i) => (
            <Sk key={i} w={i ? 92 : 120} h={28} r={999} />
          ))}
        </span>
      </div>
      {intro ? (
        <div className="w-sk-col" style={{ maxWidth: 620 }}>
          <Sk />
          <Sk w="62%" />
        </div>
      ) : null}
    </>
  );
}

function SkStats({ n = 4 }: { n?: number }) {
  return (
    <div className="w-stats">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="w-stat">
          <Sk w={84} h={11} />
          <Sk w={i ? 56 : 110} h={26} />
          <Sk w="78%" h={10} />
        </div>
      ))}
    </div>
  );
}

function SkTable({ rows = 6 }: { rows?: number }) {
  const widths = ["86%", "64%", "92%", "71%", "80%", "58%", "88%", "67%"];
  return (
    <div className="w-box w-skel-rows">
      <div className="head">
        <Sk w="34%" h={10} />
        <Sk w="50%" h={10} />
        <Sk w="44%" h={10} />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i}>
          <Sk w={widths[i % widths.length]} />
          <Sk w="46%" />
          <Sk w="62%" />
        </div>
      ))}
    </div>
  );
}

function SkBox({ lines = 4 }: { lines?: number }) {
  return (
    <div className="w-box w-box-pad w-sk-col">
      <Sk w={140} h={14} />
      {Array.from({ length: lines }, (_, i) => (
        <Sk key={i} w={`${92 - i * 9}%`} h={8} r={999} />
      ))}
    </div>
  );
}

/** Which skeleton a page gets, from its address. */
export function skeletonFor(path: string): string {
  const part = path.split("/")[2] ?? "";
  return ["questions", "sites", "reddit", "tracking", "ask", "admin"].includes(part) ? part : "home";
}

export function PageSkeleton({ path }: { path: string }) {
  const kind = skeletonFor(path);
  let body: ReactNode;
  if (kind === "questions") body = <><SkHead intro /><SkTable rows={8} /></>;
  else if (kind === "sites") body = <><SkHead intro chips={2} /><SkStats /><div className="w-box w-box-pad w-sk-col" style={{ gap: 22 }}>{Array.from({ length: 4 }, (_, i) => <div key={i} className="w-sk-col"><Sk w={180} h={15} /><Sk w="58%" h={10} /><Sk w={240} h={20} r={999} /></div>)}</div></>;
  else if (kind === "reddit")
    body = (
      <>
        <SkHead intro chips={2} />
        <div className="w-rd">
          <div className="w-box w-sk-col" style={{ padding: 12, gap: 18 }}>
            <Sk w={190} h={30} r={10} />
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="w-sk-col" style={{ gap: 7 }}>
                <Sk w={120} h={10} />
                <Sk w={`${88 - (i % 3) * 12}%`} h={13} />
                <Sk w="94%" h={9} />
              </div>
            ))}
          </div>
          <div className="w-box w-rd-detail w-sk-col" style={{ gap: 14 }}>
            <Sk w={220} h={10} />
            <Sk w="70%" h={18} />
            <Sk h={96} r={10} />
            <Sk w={90} h={13} />
            <Sk h={150} r={10} />
            <span style={{ display: "flex", gap: 10 }}>
              <Sk w={160} h={32} r={8} />
              <Sk w={130} h={32} r={8} />
            </span>
          </div>
        </div>
      </>
    );
  else if (kind === "tracking") body = <><SkHead intro /><SkBox lines={5} /><div className="w-box w-box-pad w-sk-col"><Sk w={120} h={14} /><Sk h={220} r={10} /></div></>;
  else if (kind === "ask")
    body = (
      <>
        <SkHead chips={0} />
        <div className="w-sk-col" style={{ justifyItems: "center", paddingTop: "12vh", gap: 12 }}>
          <Sk w={40} h={40} r={999} />
          <Sk w={120} h={18} />
          <Sk w={300} h={11} />
          <div className="w-ask-starts">
            {Array.from({ length: 4 }, (_, i) => (
              <Sk key={i} h={66} r={12} />
            ))}
          </div>
        </div>
      </>
    );
  else if (kind === "admin") body = <><SkHead chips={1} /><Sk w={420} h={34} r={10} /><SkStats /><SkTable rows={5} /></>;
  else body = <><SkHead chips={1} /><div className="w-sk-col" style={{ gap: 6 }}><Sk w={190} h={14} /><Sk w={320} h={10} /></div><SkStats /><SkTable rows={4} /><div className="w-two"><SkBox /><SkBox /></div></>;
  return (
    <div className="w-skel-page" aria-busy="true" aria-label="Loading">
      {body}
    </div>
  );
}

/** Skeleton for a page inside the admin area, under its tabs. */
export function AdminSkeleton() {
  return (
    <div className="w-skel-page" aria-busy="true" aria-label="Loading">
      <SkStats />
      <SkTable rows={5} />
    </div>
  );
}
