// Each client's plan (Ross, 17 Nov 2026): the checklist on the left (click a line: a green tick at its start and the
// words struck through; click again to undo), and on the right what runs for them today, next and later, each with
// why. Shown in a pop-up when Ross opens a brand card on the hub, and as the client's Checklist page. The rules and
// words are in lib/client-plan.ts. Styles: app/styles/client-plan.css.

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link, useFetcher, useRevalidator } from "react-router";
import type { ClientPlan } from "../lib/client-plan.server";
import { type CheckGroup, type CheckLine, type FlowItem, type Who, WHO_LABEL } from "../lib/client-plan";
import { dayLabel } from "../lib/guide-calendar";
import { BrandMark, StatusChip } from "./hub";
import type { ClientStatus } from "../lib/clients";

/** Where a client's plan lives: its page, and the data the pop-up loads. */
export const planUrl = (shopId: string) => `/dash/clients/${shopId}/checklist`;
/** One fetcher per client, shared by its brand card (which loads the plan on hover) and the pop-up. */
export const planKey = (shopId: string) => `client-plan-${shopId}`;

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** The green tick at the start of a line: an empty ring until it's done. */
function Tick({ done }: { done: boolean }) {
  return (
    <span className={`pl-tick${done ? " on" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 20 20">
        <path d="M5.8 10.4l2.9 2.9 5.6-6.1" />
      </svg>
    </span>
  );
}

function WhoTag({ who }: { who: Who }) {
  return <span className={`pl-who ${who}`}>{WHO_LABEL[who]}</span>;
}

/** "Due Mon 23 Nov", "Was due Mon 23 Nov", "Done Tue 17 Nov", "Ticks itself". */
function lineMeta(line: CheckLine, done: boolean, doneOn: string | null, firstDay: boolean) {
  if (done) return line.auto ? "Done" : doneOn ? `Done ${dayLabel(doneOn)}` : "Done";
  if (line.late) return `Was due ${dayLabel(line.dueDay)}`;
  return firstDay ? (line.auto ? "Ticks itself when it’s done" : null) : `Due ${dayLabel(line.dueDay)}`;
}

/** One line of the checklist. Ross's lines tick and untick on a click (saved straight away); the rest tick themselves. */
function CheckRow({ line, shopId, today, firstDay }: { line: CheckLine; shopId: string; today: string; firstDay: boolean }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const pending = fetcher.formData;
  const done = pending ? pending.get("done") === "1" : line.done;
  const doneOn = pending ? today : line.doneOn;
  const failed = fetcher.state === "idle" && fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  const meta = lineMeta(line, done, doneOn, firstDay);
  const body = (
    <>
      <Tick done={done} />
      <span className="pl-line-body">
        <span className="pl-line-text">
          <span>{line.text}</span>
        </span>
        <span className="pl-line-meta">
          <WhoTag who={line.who} />
          {meta ? <span className={!done && line.late ? "late" : undefined}>{meta}</span> : null}
        </span>
        <span className="pl-line-why">
          <span>{line.why}</span>
        </span>
        {failed ? (
          <span className="pl-line-err" role="alert">
            {failed}
          </span>
        ) : null}
      </span>
    </>
  );
  const cls = `pl-line${done ? " on" : ""}${line.auto ? " auto" : ""}`;
  return (
    <li className="pl-row">
      {line.auto ? (
        line.href && !done ? (
          <Link to={line.href} className={cls} title="This ticks itself when it’s done. Open it.">
            {body}
          </Link>
        ) : (
          <div className={cls} title={done ? "Ticked by itself" : "This ticks itself when it’s done"}>
            {body}
          </div>
        )
      ) : (
        <button
          type="button"
          className={cls}
          aria-pressed={done}
          onClick={() => fetcher.submit({ intent: "tick", key: line.key, done: done ? "0" : "1" }, { method: "post", action: planUrl(shopId) })}
        >
          {body}
        </button>
      )}
      {!line.auto && line.href && !done ? (
        <Link to={line.href} className="pl-open" aria-label={`Open: ${line.text}`}>
          Open
        </Link>
      ) : null}
    </li>
  );
}

/** A ring that fills green as the list gets done. */
function Ring({ done, total }: { done: number; total: number }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  const share = total ? done / total : 0;
  return (
    <span className={`pl-ring${done === total && total ? " full" : ""}`} role="img" aria-label={`${done} of ${total} done`}>
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r={r} className="pl-ring-track" />
        <circle cx="22" cy="22" r={r} className="pl-ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - share)} />
      </svg>
      <b aria-hidden="true">{Math.round(share * 100)}%</b>
    </span>
  );
}

const STATE_WORD: Record<FlowItem["state"], string> = { now: "Running now", done: "Done", today: "Today", planned: "Planned", you: "Needs you" };

function FlowStep({ item }: { item: FlowItem }) {
  return (
    <li className={`pl-step ${item.state}`}>
      <span className="pl-dot" aria-hidden="true">
        {item.state === "done" ? (
          <svg viewBox="0 0 20 20">
            <path d="M5.8 10.4l2.9 2.9 5.6-6.1" />
          </svg>
        ) : null}
      </span>
      <div className="pl-step-body">
        <div className="pl-step-top">
          <b>{item.title}</b>
          <span className="h-sr">{STATE_WORD[item.state]}. </span>
          <WhoTag who={item.who} />
        </div>
        {item.detail ? <p className="pl-step-detail">{item.detail}</p> : null}
        <p className="pl-step-when">{item.when}</p>
        <p className="pl-step-why">
          <span>Why</span>
          {item.why}
        </p>
        {item.href ? (
          <Link to={item.href} className="pl-step-open">
            {item.state === "you" ? "Do it" : "Open"}
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function FlowSection({ id, title, sub, items, empty }: { id: string; title: string; sub?: string; items: FlowItem[]; empty: string }) {
  return (
    <section className="pl-flow-sec" aria-labelledby={id}>
      <div className="pl-flow-head">
        <h3 id={id}>{title}</h3>
        {sub ? <span>{sub}</span> : null}
        {items.length ? <span className="pl-count">{items.length}</span> : null}
      </div>
      {items.length ? (
        <ol className="pl-steps">
          {items.map((i) => (
            <FlowStep key={i.key} item={i} />
          ))}
        </ol>
      ) : (
        <p className="pl-empty">{empty}</p>
      )}
    </section>
  );
}

/** One group of lines. A group that's all done folds away, so what's left is at the top; Show opens it again. */
function CheckGroupView({ group: g, shopId, today }: { group: CheckGroup; shopId: string; today: string }) {
  const all = g.done === g.lines.length;
  const [open, setOpen] = useState(!all); // set once: ticking the last line doesn't fold it away under the pointer
  const shown = open || !all;
  return (
    <div className={`pl-group ${g.key}`}>
      <div className="pl-group-head">
        <h4>{g.title}</h4>
        <span className={all ? "all" : undefined}>{all ? `All ${g.lines.length} done` : `${g.done} of ${g.lines.length}`}</span>
        {all ? (
          <button type="button" className="pl-group-toggle" aria-expanded={shown} onClick={() => setOpen(!shown)}>
            {shown ? "Hide" : "Show"}
          </button>
        ) : null}
      </div>
      {shown ? (
        <ul className="pl-lines">
          {g.lines.map((l) => (
            <CheckRow key={l.key} line={l} shopId={shopId} today={today} firstDay={g.key === "day1"} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The checklist beside the work: the pop-up's body, and the client's Checklist page. */
export function ClientPlanView({ plan }: { plan: ClientPlan }) {
  const { checklist, flow } = plan;
  const today = plan.today;
  return (
    <div className="pl-grid">
      <section className="pl-check" aria-labelledby={`pl-check-${plan.shopId}`}>
        <div className="pl-check-head">
          <Ring done={checklist.done} total={checklist.total} />
          <div>
            <h3 id={`pl-check-${plan.shopId}`}>Checklist</h3>
            <p>
              {checklist.done} of {checklist.total} done. Click a line when it’s done.
            </p>
          </div>
        </div>
        {checklist.groups.map((g) => (
          <CheckGroupView key={g.key} group={g} shopId={plan.shopId} today={today} />
        ))}
      </section>

      <div className="pl-flow">
        {flow.note ? <p className="pl-note">{flow.note}</p> : null}
        <FlowSection id={`pl-today-${plan.shopId}`} title="Doing today" items={flow.today} empty="Nothing else runs for them today." />
        <FlowSection id={`pl-next-${plan.shopId}`} title="Up next" sub="The next 7 days" items={flow.next} empty="Nothing planned for the next 7 days." />
        <FlowSection id={`pl-later-${plan.shopId}`} title="In the pipeline" sub="Later on" items={flow.later} empty="Nothing planned further out yet." />
      </div>
    </div>
  );
}

/** While setup, an AI check or a guide is running, look again every few seconds (the client's Checklist page). */
export function usePlanRefresh(busy: boolean) {
  const revalidator = useRevalidator();
  const state = useRef(revalidator.state);
  useEffect(() => {
    state.current = revalidator.state;
  });
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => !document.hidden && state.current === "idle" && revalidator.revalidate(), 6000);
    return () => clearInterval(t);
  }, [busy, revalidator]);
}

/** A skeleton of the pop-up's body while its data comes in. */
function PlanSkeleton() {
  return (
    <div className="pl-grid" aria-hidden="true">
      <div className="pl-check">
        <div className="pl-check-head">
          <span className="w-sk pl-sk-ring" />
          <div className="pl-sk-col">
            <span className="w-sk" style={{ width: 110, height: 16 }} />
            <span className="w-sk" style={{ width: 210, height: 12 }} />
          </div>
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="pl-sk-line">
            <span className="w-sk pl-sk-tick" />
            <span className="w-sk" style={{ width: `${70 - (i % 3) * 12}%`, height: 13 }} />
          </div>
        ))}
      </div>
      <div className="pl-flow">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="pl-sk-col" style={{ gap: 10 }}>
            <span className="w-sk" style={{ width: 120, height: 15 }} />
            <span className="w-sk" style={{ width: "92%", height: 54, borderRadius: 10 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export interface PlanCard {
  shopId: string;
  name: string;
  host: string;
  status: ClientStatus;
  month: number;
}

/**
 * The pop-up for one client, over the hub: who they are, then the checklist beside the work. It opens at once with
 * what the card knows, then fills in (straight away when the card loaded it on hover). Esc, the cross or a click
 * outside closes it.
 */
export function ClientPlanDialog({ card, onClose }: { card: PlanCard; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const fetcher = useFetcher<ClientPlan>({ key: planKey(card.shopId) });
  const [closing, setClosing] = useState(false);
  const load = useRef(fetcher.load);
  const state = useRef(fetcher.state);
  useEffect(() => {
    load.current = fetcher.load;
    state.current = fetcher.state;
  });
  const plan = fetcher.data;

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    load.current(planUrl(card.shopId)); // fresh numbers every time it opens
  }, [card.shopId]);

  // Setup, an AI check or a guide running: look again every few seconds.
  const busy = Boolean(plan?.busy);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => !document.hidden && state.current === "idle" && load.current(planUrl(card.shopId)), 6000);
    return () => clearInterval(t);
  }, [busy, card.shopId]);

  const close = () => {
    if (closing) return;
    if (reduceMotion()) return ref.current?.close();
    setClosing(true);
    setTimeout(() => ref.current?.close(), 160);
  };
  const onBackdrop = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) close();
  };

  return (
    // A click on the dimmed backdrop closes it; from the keyboard, Esc and the Close button do the same.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      className={`pl-dialog${closing ? " closing" : ""}`}
      aria-labelledby={`pl-title-${card.shopId}`}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={onBackdrop}
    >
      <div className="pl-sheet">
        <header className="pl-head">
          <BrandMark name={card.name} size={44} />
          <div className="pl-head-name">
            <h2 id={`pl-title-${card.shopId}`}>{card.name}</h2>
            <p>
              <a href={`https://${card.host}`} target="_blank" rel="noreferrer">
                {card.host} ↗
              </a>
              <StatusChip status={card.status} />
              {card.month ? <span className="pl-head-month">Month {card.month}</span> : null}
              {plan?.local ? <span className="pl-head-month">{plan.area ? `Local business, ${plan.area}` : "Local business"}</span> : null}
            </p>
          </div>
          <div className="pl-head-acts">
            <Link to={`/dash/clients/${card.shopId}`} className="w-btn w-btn-ghost w-btn-sm">
              Open their page
            </Link>
            <button type="button" className="pl-x" onClick={close} aria-label="Close">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
              </svg>
            </button>
          </div>
        </header>
        <div className="pl-scroll">{plan && plan.shopId === card.shopId ? <ClientPlanView plan={plan} /> : <PlanSkeleton />}</div>
      </div>
    </dialog>
  );
}
