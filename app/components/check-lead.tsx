// Free product check: the "Get your full report" email popup and what opens it.
// The action plan is only ever sent by email (getCheckView blanks it from the page), so every locked
// part of the report opens this popup. It also opens once per check per browser session when a
// visitor moves to leave (desktop: the mouse leaves through the top of the window) or comes back
// after switching tabs. Saving posts to /check/:id/email (urlencoded email + honeypot) and the server
// emails the full report as a PDF. Styles: app/styles/check.css (ck-lead-*, ck-lock).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRevalidator } from "react-router";
import type { CheckEmailResult, CheckLeadState, CheckPlanTeaser, CheckView } from "../lib/check-types";
import { BAD_EMAIL_ERROR, REPORT_CONSENT_TEXT, TIPS_CONSENT_TEXT, TIPS_FIELD } from "../lib/check-consent";

/** What opened the popup: leaving (exit, away), a locked part of the report (plan, fix) or a button (ask). */
export type LeadReason = "exit" | "away" | "plan" | "fix" | "ask";

export type LeadView = Pick<CheckView, "id" | "status" | "lead" | "plan">;

interface LeadApi {
  lead: CheckLeadState;
  running: boolean;
  open: (reason: LeadReason) => void;
}

const NO_LEAD: CheckLeadState = { status: "none", maskedEmail: null };
const LeadContext = createContext<LeadApi | null>(null);
const RANK: Record<CheckLeadState["status"], number> = { none: 0, pending: 1, sent: 2 };

/** The email state and a way to open the popup. Without a LeadProvider (failed pages) it does nothing. */
export function useLead(): LeadApi {
  return useContext(LeadContext) ?? { lead: NO_LEAD, running: false, open: () => {} };
}

/** The server's state wins once it knows as much as our own reply did (it refreshes after every save). */
function pickLead(server: CheckLeadState | undefined, mine: CheckLeadState | null): CheckLeadState {
  const s = server ?? NO_LEAD;
  if (!mine) return s;
  return RANK[mine.status] > RANK[s.status] ? mine : s;
}

const isLead = (v: unknown): v is CheckLeadState =>
  !!v && typeof v === "object" && ["none", "pending", "sent"].includes((v as CheckLeadState).status);

// ---------- leaving the page ----------

const MIN_ON_PAGE_MS = 4000; // exit intent only after 4 s on the page
const MIN_AWAY_MS = 3000; // a tab switch counts when they were away 3 s or more
const OWN_LINK_MS = 1000; // a tab hidden this soon after clicking one of our new-tab links: they're reading, not leaving
const promptedKey = (id: string) => `geo-check-lead:${id}`;

function wasPrompted(id: string): boolean {
  try {
    return window.sessionStorage.getItem(promptedKey(id)) === "1";
  } catch {
    return false;
  }
}
function markPrompted(id: string) {
  try {
    window.sessionStorage.setItem(promptedKey(id), "1");
  } catch {
    // private mode or storage blocked: it may ask again on the next visit, which is fine
  }
}

/** Opens the popup once per check per browser session when the visitor moves to leave or comes back. */
function useLeaveIntent(id: string, armed: boolean, open: (reason: LeadReason) => void) {
  const since = useRef(0);
  useEffect(() => {
    since.current = Date.now();
  }, []);
  useEffect(() => {
    if (!armed || wasPrompted(id)) return;
    let hiddenAt = 0;
    let linkAt = 0;
    const fire = (reason: LeadReason) => {
      if (wasPrompted(id)) return;
      markPrompted(id);
      open(reason);
    };
    // Desktop: the mouse leaves the window through the top edge (towards the tabs or the address bar).
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget || e.clientY > 0) return;
      if (Date.now() - since.current < MIN_ON_PAGE_MS) return;
      fire("exit");
    };
    // Our own links that open a new tab (the sites AI cited, a fact's source): reading them isn't leaving.
    const onClick = (e: MouseEvent) => {
      const link = e.target instanceof Element ? e.target.closest("a[target=_blank]") : null;
      if (link) linkAt = Date.now();
    };
    // Any device: they switched tab or app and came back.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now() - linkAt < OWN_LINK_MS ? 0 : Date.now();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt >= MIN_AWAY_MS) fire("away");
      hiddenAt = 0;
    };
    const mouse = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (mouse) document.addEventListener("mouseout", onOut);
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [armed, id, open]);
}

// ---------- the provider (wraps the whole check page) ----------

export function LeadProvider({ view, children }: { view: LeadView; children: ReactNode }) {
  const [reason, setReason] = useState<LeadReason | null>(null);
  const [mine, setMine] = useState<CheckLeadState | null>(null);
  const page = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null); // what had focus before the popup opened
  const revalidator = useRevalidator();
  const lead = pickLead(view.lead, mine);
  const running = view.status !== "done" && view.status !== "failed";
  const isOpen = reason !== null;

  const open = useCallback((why: LeadReason) => {
    setReason((now) => {
      if (!now) returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      return now ?? why;
    });
  }, []);
  const close = useCallback(() => setReason(null), []);
  const saved = useCallback(
    (next: CheckLeadState) => {
      setMine(next);
      if (revalidator.state === "idle") revalidator.revalidate();
    },
    [revalidator],
  );

  useLeaveIntent(view.id, lead.status === "none" && !isOpen, open);

  // While open: the page behind can't be reached or scrolled; on close, focus goes back where it was.
  useEffect(() => {
    if (!isOpen) return;
    const before = returnTo.current;
    const el = page.current;
    const html = document.documentElement;
    const was = { overflow: html.style.overflow, paddingRight: html.style.paddingRight };
    const scrollbar = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    if (scrollbar > 0) html.style.paddingRight = `${scrollbar}px`;
    el?.setAttribute("inert", "");
    el?.setAttribute("aria-hidden", "true");
    return () => {
      el?.removeAttribute("inert");
      el?.removeAttribute("aria-hidden");
      html.style.overflow = was.overflow;
      html.style.paddingRight = was.paddingRight;
      if (before && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, [isOpen]);

  const api = useMemo(() => ({ lead, running, open }), [lead, running, open]);
  return (
    <LeadContext.Provider value={api}>
      <div ref={page}>{children}</div>
      {reason ? (
        <LeadDialog id={view.id} reason={reason} lead={lead} running={running} plan={view.plan} onClose={close} onSaved={saved} />
      ) : null}
    </LeadContext.Provider>
  );
}

// ---------- the popup ----------

const LEAD_IMAGE = "/home/img/clay-coins.jpg";
const GENERIC = "Something went wrong. Please try again.";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "1, 2 and 3" (no serial comma). */
export function joinList(parts: string[]): string {
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : (parts[0] ?? "");
}

/** "4 steps: 1 fix for your page, 3 sites to get featured on and 3 rivals to study." (counts only) */
export function planLine(plan: CheckPlanTeaser | null): string {
  if (!plan) return "Step-by-step fixes for your page, and the sites to get featured on.";
  const parts = [
    plan.pageFixes ? plural(plan.pageFixes, "fix for your page", "fixes for your page") : null,
    plan.sitesToPitch ? plural(plan.sitesToPitch, "site to get featured on", "sites to get featured on") : null,
    plan.rivalsToStudy ? plural(plan.rivalsToStudy, "rival to study", "rivals to study") : null,
  ].filter((p): p is string => Boolean(p));
  const steps = plural(Math.max(1, plan.steps), "step", "steps");
  return parts.length ? `${steps}: ${joinList(parts)}.` : `${steps}, based on what the AI said and your page.`;
}

/** What's in the email, as three short ticks (counts when we have them). */
function insideList(plan: CheckPlanTeaser | null): string[] {
  return [
    plan ? `Your action plan: ${plural(Math.max(1, plan.steps), "step", "steps")}, in order` : "Your step-by-step action plan",
    plan?.sitesToPitch ? plural(plan.sitesToPitch, "site to get featured on", "sites to get featured on") : "The sites to get featured on",
    plan?.pageFixes ? plural(plan.pageFixes, "fix for your product page", "fixes for your product page") : "The fixes for your product page",
  ];
}

export const LockIcon = ({ className = "ck-lock" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4.5" y="10.5" width="15" height="10" rx="3" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const MailIcon = ({ className = "ck-mail" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5.5" width="18" height="13" rx="3" />
    <path d="m4 7.5 8 5.5 8-5.5" />
  </svg>
);

/** A page with a folded corner and lines: the PDF. */
const DocIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);

const TickIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 5 5 9-10" />
  </svg>
);

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

function eyebrowFor(reason: LeadReason, running: boolean): string {
  if (reason === "away") return "Welcome back";
  if (running) return "Your check is still running";
  if (reason === "exit") return "Before you go";
  return "Your action plan is ready";
}

export function LeadDialog({
  id,
  reason,
  lead,
  running,
  plan,
  onClose,
  onSaved,
}: {
  id: string;
  reason: LeadReason;
  lead: CheckLeadState;
  running: boolean;
  plan: CheckPlanTeaser | null;
  onClose: () => void;
  onSaved: (lead: CheckLeadState) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(lead.status === "none");
  const [busy, setBusy] = useState(false);
  // "email": the address itself is the problem (the box turns red); "other": a limit, the network, the server.
  const [error, setError] = useState<{ text: string; kind: "email" | "other" } | null>(null);
  const [shown, setShown] = useState(false);

  // First focus: the email box on desktop; the dialog itself on touch screens (no surprise keyboard).
  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setShown(true));
    const mouse = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (editing && mouse && input.current) input.current.focus({ preventScroll: true });
    else box.current?.focus({ preventScroll: true });
    return () => window.cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc closes from anywhere on the page; Tab and Shift+Tab stay inside the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      const el = box.current;
      if (e.key !== "Tab" || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!el.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === el)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError({ text: email ? "Please check your email address." : "Please enter your email address.", kind: "email" });
      input.current?.focus();
      return;
    }
    const body = new URLSearchParams({ email, website: String(form.get("website") ?? "") });
    if (form.get(TIPS_FIELD) === "1") body.set(TIPS_FIELD, "1");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/check/${encodeURIComponent(id)}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body,
        credentials: "same-origin",
      });
      const result = (await res.json().catch(() => null)) as CheckEmailResult | null;
      if (result?.ok && isLead(result.lead)) {
        onSaved(result.lead);
        setEditing(false);
        window.requestAnimationFrame(() => box.current?.focus({ preventScroll: true }));
      } else {
        const text = result && !result.ok && result.error ? result.error : GENERIC;
        setError({ text, kind: text === BAD_EMAIL_ERROR ? "email" : "other" });
        if (text === BAD_EMAIL_ERROR) input.current?.focus();
      }
    } catch {
      setError({ text: "We couldn’t send that. Please check your connection and try again.", kind: "other" });
    } finally {
      setBusy(false);
    }
  }

  const to = lead.maskedEmail ? <b>{lead.maskedEmail}</b> : "your inbox";
  const done = !editing && lead.status !== "none";
  // Saved while the check still runs: the email goes when it finishes. Once done, it's on its way.
  const waiting = lead.status === "pending" && running;

  return (
    <div
      className={`ck-lead-back${shown ? " is-in" : ""}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={box}
        className="ck-lead-dlg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ck-lead-h"
        aria-describedby="ck-lead-d"
        tabIndex={-1}
      >
        <button type="button" className="ck-lead-x" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <div className="ck-lead-art" aria-hidden="true">
          <img src={LEAD_IMAGE} alt="" width={1024} height={1024} />
          <span className="ck-lead-pdf">
            <DocIcon className="ck-lead-pdf-ic" />
            PDF report
          </span>
        </div>

        {done ? (
          <div className="ck-lead-body ck-lead-done" aria-live="polite">
            <span className="ck-lead-tick">
              <TickIcon />
            </span>
            <h2 id="ck-lead-h" className="ck-lead-h">
              Check your inbox
            </h2>
            <p id="ck-lead-d" className="ck-lead-p">
              {waiting ? (
                <>Done. Your report will be on its way to {to} as soon as your check finishes.</>
              ) : (
                <>Done. Your report is on its way to {to}.</>
              )}
            </p>
            <p className="ck-lead-note">
              {waiting
                ? "You can close this page. We’ll send it the moment the report is ready."
                : "It can take a minute to arrive. Check the promotions tab too."}
            </p>
            <div className="ck-lead-actions">
              <button type="button" className="ck-btn ck-btn-dark ck-lead-btn" onClick={onClose}>
                {running ? "Back to my check" : "Back to my report"}
              </button>
              <button type="button" className="ck-lead-link" onClick={() => setEditing(true)}>
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          <div className="ck-lead-body">
            <p className="ck-lead-eyebrow">{eyebrowFor(reason, running)}</p>
            <h2 id="ck-lead-h" className="ck-lead-h">
              {running ? "Get your full report" : "Get your action plan"}
            </h2>
            <p id="ck-lead-d" className="ck-lead-p">
              {running
                ? "We’ll email it as a PDF the moment your check finishes, so you don’t have to wait here. Inside:"
                : "Emailed to you as a PDF, with your full report. Inside:"}
            </p>
            <ul className="ck-lead-list">
              {insideList(plan).map((item) => (
                <li key={item}>
                  <span className="ck-lead-li-tick">
                    <TickIcon />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <form className="ck-lead-form" onSubmit={submit} noValidate>
              <label className="ck-lead-field">
                <span className="ck-sr">Your email</span>
                <MailIcon className="ck-lead-field-ic" />
                <input
                  ref={input}
                  type="email"
                  name="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={254}
                  required
                  placeholder="you@yourstore.com"
                  aria-invalid={error?.kind === "email" ? true : undefined}
                  aria-describedby={error ? "ck-lead-err" : undefined}
                />
              </label>
              {/* Spam trap: people never see or fill this. */}
              <div className="ck-sr" aria-hidden="true">
                <label>
                  Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              {/* Optional and unticked: asking for the report never signs anyone up for tips. */}
              <label className="ck-lead-tips">
                <input type="checkbox" name={TIPS_FIELD} value="1" />
                <span className="ck-lead-box" aria-hidden="true">
                  <TickIcon />
                </span>
                <span>{TIPS_CONSENT_TEXT}</span>
              </label>
              {error ? (
                <p id="ck-lead-err" className="ck-lead-err" role="alert">
                  {error.text}
                </p>
              ) : null}
              <button type="submit" className="ck-btn ck-btn-dark ck-lead-btn" disabled={busy}>
                {busy ? "Sending…" : running ? "Email me the full report" : "Email me my action plan"}
              </button>
              <p className="ck-lead-consent">
                {REPORT_CONSENT_TEXT}{" "}
                <a href="/privacy" target="_blank" rel="noopener">
                  Privacy
                </a>
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
