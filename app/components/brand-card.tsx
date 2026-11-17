// One client's card on the agency hub's front page (Ross, 5 Nov 2026): who they are, how the work is going (AI score
// and sales from AI, or how far setup is), how far their checklist is, what was done this week, the next guide and the
// first thing that needs Ross. The whole card is one link to the client, so nothing inside it is a link or a button.
// A click opens the client's pop-up (Ross, 17 Nov 2026: "i click into the card and it will show them in the pop up"),
// loaded on hover so it opens full; a click with Ctrl or Cmd still opens their page. Styles: app/styles/hub-pages.css.

import type { MouseEvent } from "react";
import { Link, useFetcher } from "react-router";
import { planKey, planUrl } from "./client-plan";
import { checklistLine } from "../lib/client-plan";
import { BrandMark, Delta, HealthDot, Sparkline, StatusChip } from "./hub";
import type { ClientCard } from "../lib/clients";
import { formatMoney } from "../lib/format";
import { cardAlert, nextGuideLine, salesLine, setupStep, termLine, weekLine } from "../lib/hub-pages";

function SettingUp({ card }: { card: ClientCard }) {
  const { step, of, label } = setupStep(card.onboarding, card.local);
  // Setup that stopped shows its red line at the bottom of the card; here it stops spinning.
  const stopped = card.alerts.some((a) => a.key === "setup" && a.tone === "no");
  return (
    <div className="hp-card-setup">
      <span className="hp-num-label">{stopped ? "Setup stopped" : "Setting up"}</span>
      <span className="hp-step">
        {stopped ? null : <span className="w-spin" aria-hidden="true" />}
        <span className="h-sr">
          Step {step} of {of}:{" "}
        </span>
        {label}
      </span>
      <span className="hp-segs" aria-hidden="true">
        {Array.from({ length: of }, (_, i) => (
          <i key={i} className={i + 1 < step ? "done" : i + 1 === step ? "now" : undefined} />
        ))}
      </span>
    </div>
  );
}

function Numbers({ card }: { card: ClientCard }) {
  const counted = card.tracking || card.sales.orders > 0; // orders can come in without the tracking code (a Shopify connection)
  return (
    <div className="hp-card-nums">
      <div className="hp-num">
        <span className="hp-num-label">AI score</span>
        {card.score === null ? (
          <span className="hp-num-none">Not checked yet</span>
        ) : (
          <>
            <span className="hp-num-big">
              {card.score}
              <small>/100</small>
            </span>
            {card.scoreStart !== null ? (
              <span className="hp-num-sub">
                <Delta value={card.score - card.scoreStart} /> since they joined
              </span>
            ) : null}
            <Sparkline values={card.trend} width={96} height={24} />
          </>
        )}
      </div>
      <div className="hp-num">
        <span className="hp-num-label">Sales from AI</span>
        {counted ? <span className="hp-num-big">{formatMoney(card.sales.revenue, card.currency)}</span> : <span className="hp-num-none">Not counted yet</span>}
        {counted ? <span className="hp-num-sub">{salesLine(card.sales, card.tracking)}</span> : null}
        {card.tracking || card.local ? null : <span className="hp-num-warn">Tracking code not on yet</span>}
      </div>
    </div>
  );
}

/** "First 24 hours  ▬▬▬▭▭  4/10": a thin green bar for how far their checklist is. */
function ChecklistBar({ card }: { card: ClientCard }) {
  const c = checklistLine(card.checklist);
  return (
    <div className="hp-card-check">
      <span>{c.label}</span>
      <span className="hp-check-bar" aria-hidden="true">
        <i style={{ width: `${c.total ? Math.round((c.done / c.total) * 100) : 0}%` }} />
      </span>
      <b>
        {c.done}/{c.total}
        <span className="h-sr"> done</span>
      </b>
    </div>
  );
}

export function BrandCard({ card, today, onOpen }: { card: ClientCard; today: string; onOpen?: (card: ClientCard) => void }) {
  const alert = cardAlert(card.alerts);
  const active = card.status === "active";
  const plan = useFetcher({ key: planKey(card.shopId) });
  // Load the pop-up's data as the pointer comes near, so it opens with everything in it.
  const warm = () => {
    if (onOpen && plan.state === "idle" && !plan.data) plan.load(planUrl(card.shopId));
  };
  const open = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onOpen || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpen(card);
  };
  return (
    <Link
      to={`/dash/clients/${card.shopId}`}
      prefetch={onOpen ? "none" : "intent"}
      className="hp-card"
      onClick={open}
      onPointerEnter={warm}
      onFocus={warm}
      aria-haspopup={onOpen ? "dialog" : undefined}
    >
      <div className="hp-card-top">
        <BrandMark name={card.name} size={40} />
        <span className="hp-card-name">
          <b>{card.name}</b>
          <span>{card.host}</span>
        </span>
        {active ? <HealthDot health={card.health} /> : <StatusChip status={card.status} />}
      </div>
      <p className="hp-card-term">{termLine(card, today)}</p>

      {card.onboarding !== "done" ? <SettingUp card={card} /> : <Numbers card={card} />}

      {card.status === "ended" ? null : <ChecklistBar card={card} />}

      <dl className="hp-card-facts">
        <div>
          <dt>This week</dt>
          <dd>{weekLine(card.week, active ? undefined : "Nothing this week")}</dd>
        </div>
        <div>
          <dt>Next guide</dt>
          <dd className="hp-clamp">{nextGuideLine(card.next, card.status, today)}</dd>
        </div>
      </dl>

      {alert ? (
        <p className={`hp-card-alert ${alert.first.tone}`}>
          <span>
            {alert.first.text}
            {alert.more ? <span className="hp-more"> and {alert.more} more</span> : null}
          </span>
        </p>
      ) : null}
    </Link>
  );
}
