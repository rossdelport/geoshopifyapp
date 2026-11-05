// One client's card on the agency hub's front page (Ross, 5 Nov 2026): who they are, how the work is going (AI score
// and sales from AI, or how far setup is), what was done this week, the next guide and the first thing that needs Ross.
// The whole card is one link to the client, so nothing inside it is a link or a button. Styles: app/styles/hub-pages.css.

import { Link } from "react-router";
import { BrandMark, Delta, HealthDot, Sparkline, StatusChip } from "./hub";
import type { ClientCard } from "../lib/clients";
import { formatMoney } from "../lib/format";
import { cardAlert, nextGuideLine, salesLine, setupStep, termLine, weekLine } from "../lib/hub-pages";

function SettingUp({ card }: { card: ClientCard }) {
  const { step, of, label } = setupStep(card.onboarding);
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
        {card.tracking ? null : <span className="hp-num-warn">Tracking code not on yet</span>}
      </div>
    </div>
  );
}

export function BrandCard({ card, today }: { card: ClientCard; today: string }) {
  const alert = cardAlert(card.alerts);
  const active = card.status === "active";
  return (
    <Link to={`/dash/clients/${card.shopId}`} prefetch="intent" className="hp-card">
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
