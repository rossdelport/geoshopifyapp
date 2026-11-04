import { useEffect, useSyncExternalStore } from "react";
import pixelHead from "../../design/overview/pixel-head.js?raw";

// FirstPicked's Meta pixel on the React pages our ads and posts link to: the free check and the store reports
// (Ross, 4 Nov 2026: "when i start to run ads they will get in my pixel for targeting"). The same pixel code as the
// home page, giveaway and booking page (design/overview/pixel-head.js): it starts at once, except in Europe and the
// UK, where it waits for OK. The same cookie notice and the same saved choice ("geo-cookies"), so a visitor who
// answered on the home page isn't asked again.

declare global {
  interface Window {
    geoPixel?: () => void;
    GEO_ASK_FIRST?: boolean;
    fbq?: (...args: unknown[]) => void;
  }
}

const KEY = "geo-cookies";

// The home page's cookie notice, with its own class names (the free check already uses .ck for the page).
const CSS = `
.fp-ck{position:fixed;z-index:60;left:16px;bottom:16px;max-width:440px;display:flex;align-items:center;gap:16px;padding:12px 12px 12px 18px;border-radius:16px;background:#fff;box-shadow:0 0 0 1px rgba(18,18,40,.08),0 18px 40px -16px rgba(18,18,40,.35);font-family:Inter,system-ui,sans-serif;box-sizing:border-box}
.fp-ck p{margin:0;font-size:14px;line-height:1.45;color:#0e0e13}
.fp-ck a{color:#666972;text-decoration:underline;text-underline-offset:2px}
.fp-ck-btns{display:flex;gap:8px;flex:none}
.fp-ck button{height:38px;padding:0 15px;border-radius:9px;font:600 14px/1 Inter,system-ui,sans-serif;cursor:pointer}
.fp-ck-no{color:#25272e;background:#fff;border:1px solid #e2e2e8}
.fp-ck-ok{color:#fff;background:#6c5cf2;border:1px solid #5a49e6}
.fp-ck button:focus-visible{outline:2px solid #6c5cf2;outline-offset:2px}
@media (max-width:600px){.fp-ck{left:12px;right:12px;bottom:12px;max-width:none;flex-direction:column;align-items:stretch;gap:10px;padding:14px}.fp-ck-btns>*{flex:1}}
`;

// The notice reads this browser's saved choice, which the server can't see: the server and the first paint show no
// notice, then the browser shows it if this visitor hasn't picked yet.
const listeners = new Set<() => void>();
let answered = false; // picked on this page, even if the browser won't save it

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** The notice's words, or null when this visitor already said OK or No thanks. */
function question(): string | null {
  let choice: string | null = null;
  try {
    choice = localStorage.getItem(KEY);
  } catch {
    // storage blocked: ask
  }
  if (answered || choice === "yes" || choice === "no") return null;
  return window.GEO_ASK_FIRST ? "Can we use cookies to see which of our ads work?" : "We use cookies to see which of our ads work.";
}

function pick(value: "yes" | "no") {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // not saved: asks again next visit
  }
  answered = true;
  if (value === "yes") window.geoPixel?.();
  else window.fbq?.("consent", "revoke");
  listeners.forEach((l) => l());
}

export function MetaPixel() {
  const ask = useSyncExternalStore(subscribe, question, () => null);

  // The pixel starts once the page is open. Not as a <script> in the page: Meta's code puts its own script in front of
  // the first script it finds, which would be inside React's part of the page and break it. Once per tab: Meta counts
  // later page changes in the same tab by itself.
  useEffect(() => {
    if (typeof window.geoPixel === "function") return;
    const script = document.createElement("script");
    script.text = pixelHead;
    document.head.appendChild(script);
    listeners.forEach((l) => l()); // it decides whether to ask first (Europe and the UK)
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {ask ? (
        <div className="fp-ck" role="region" aria-label="Cookies">
          <p>
            {ask} <a href="/privacy#cookies">Privacy</a>
          </p>
          <div className="fp-ck-btns">
            <button type="button" className="fp-ck-no" onClick={() => pick("no")}>
              No thanks
            </button>
            <button type="button" className="fp-ck-ok" onClick={() => pick("yes")}>
              OK
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
