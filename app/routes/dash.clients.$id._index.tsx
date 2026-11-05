import { useEffect } from "react";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useRevalidator } from "react-router";
import db from "../db.server";
import { requireClient } from "../lib/clients.server";
import { clientCard } from "../lib/hub.server";
import { workLog } from "../lib/work-log.server";
import { byDay } from "../lib/work-log";
import { activeScan, topCompetitors } from "../lib/dashboard.server";
import { scanHasWorker } from "../lib/scan.server";
import { shopifyConnected } from "../lib/guide-calendar.server";
import { STATE_LABEL, STATE_TONE, dayLabel, localDay, slotState } from "../lib/guide-calendar";
import { type ClientStatus, STATUS_LABEL, formatFee, hubDay, isClientStatus, monthOneEnds, monthStartDay, refundUntil } from "../lib/clients";
import { ENGINE_LABELS, type Engine, getPlan } from "../lib/plans";
import { formatMoney, formatPct } from "../lib/format";
import { shareOf } from "../lib/store-stats";
import { ICONS, PageHead, Stat } from "../components/web";
import { AlertList, ClientActionButton, Delta, LogDays, Sparkline } from "../components/hub";
import styles from "../styles/client-pages.css?url";

// One client's Overview in the agency hub (Ross, 5 Nov 2026): the page Ross opens to know where a client stands and what
// to do next. What needs him first, then this month's sales and visits from AI, the AI score and the month of the work,
// then the last 7 days of work beside what's coming up, who AI names instead and the client's contact details.

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, client } = await requireClient(request);
  const name = shop.name || shop.primaryDomain || shop.domain;
  const host = shop.primaryDomain || shop.domain;
  if (!client) return { view: "none" as const, shopId: shop.id, name, host };

  const contact = {
    status: (isClientStatus(client.status) ? client.status : "active") as ClientStatus,
    contactName: client.contactName,
    email: client.email,
    phone: client.phone,
    feeAud: client.feeAud,
    startedOn: client.startedOn,
    notes: client.notes,
  };

  if (shop.onboarding !== "done") {
    const [scan, job] = await Promise.all([
      activeScan(shop.id),
      db.job.findFirst({ where: { shopId: shop.id, type: "onboard" }, orderBy: { createdAt: "desc" }, select: { status: true } }),
    ]);
    // Setup's job gave up, or its first AI check has nothing running it: it would never finish on its own.
    const stuck = shop.onboarding === "scanning" && job?.status === "done" && (!scan || !(await scanHasWorker(scan.id)));
    const plan = getPlan(shop.plan);
    return {
      view: "setup" as const,
      shopId: shop.id,
      name,
      host,
      contact,
      onboarding: shop.onboarding,
      setupFailed: job?.status === "failed" || stuck,
      scan: scan ? { done: scan.done, total: scan.total } : null,
      scanLabel: `Asking ${listNames(plan.engines.map((e) => ENGINE_LABELS[e as Engine] ?? "AI"))} (${plan.runsPerScan === 1 ? "once each" : "twice each"})`,
    };
  }

  const now = new Date();
  const today = hubDay(now);
  const storeToday = localDay(now, shop.country); // guide days are on the store's own calendar
  const [card, log, upcoming, competitors, connected, scan, storeMonth] = await Promise.all([
    clientCard(shop.id, now),
    workLog([shop.id], hubDay(now, 6), today),
    db.guideSlot.findMany({
      where: { shopId: shop.id, status: { in: ["planned", "writing", "ready"] }, day: { gte: storeToday } },
      orderBy: { day: "asc" },
      take: 5,
      select: { id: true, day: true, status: true, approvedAt: true, question: { select: { text: true } }, fix: { select: { targetTitle: true } } },
    }),
    topCompetitors(shop.id, 5),
    shopifyConnected(shop),
    activeScan(shop.id).then(async (s) => (s && (await scanHasWorker(s.id)) ? s : null)),
    // All their sales this month, for the share from AI (the daily totals are saved by UTC day).
    db.orderDay.aggregate({ where: { shopId: shop.id, date: { gte: new Date(`${monthStartDay(today)}T00:00:00Z`) } }, _sum: { revenue: true } }),
  ]);
  if (!card) return { view: "none" as const, shopId: shop.id, name, host }; // stopped being a client a moment ago

  return {
    view: "client" as const,
    shopId: shop.id,
    name,
    host,
    contact,
    today,
    yesterday: hubDay(now, 1),
    storeToday,
    card,
    salesShare: shareOf(card.sales.revenue, storeMonth._sum.revenue ?? 0),
    checking: Boolean(scan),
    week: byDay(log),
    upcoming: upcoming.map((s) => {
      const state = slotState(s, s.day, storeToday, connected);
      return { id: s.id, day: s.day, title: s.fix?.targetTitle ?? s.question?.text ?? "Guide page", state, label: STATE_LABEL[state], tone: STATE_TONE[state] };
    }),
    competitors,
  };
};

/** "ChatGPT, Gemini and Perplexity". */
const listNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "");

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

const STEPS: { key: string; label: string }[] = [
  { key: "profiling", label: "Reading their products" },
  { key: "questions", label: "Writing the buying questions shoppers ask AI" },
  { key: "scanning", label: "Asking the AI assistants" }, // replaced by the plan's own list (scanLabel)
];

const EMPTY_ALERTS: Record<ClientStatus, string> = {
  active: "All good. Nothing needs you for this client.",
  paused: "The work is paused, so nothing needs you.",
  ended: "The work has ended, so nothing needs you.",
};

type Contact = {
  status: ClientStatus;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  feeAud: number;
  startedOn: string;
  notes: string | null;
};

function NotAdded() {
  return <span className="w-note">Not added</span>;
}

/** The client's contact details, fee and Ross's notes, with a link to change them. */
function ClientBox({ base, c }: { base: string; c: Contact }) {
  const emails = c.email ? c.email.split(/,\s*/).filter(Boolean) : [];
  return (
    <section className="w-sec" aria-labelledby="client-h">
      <div className="cp-head">
        <h2 id="client-h">Client</h2>
        <Link to={`${base}/details`} prefetch="intent">
          Edit details
        </Link>
      </div>
      <div className="w-box w-box-pad">
        <dl className="w-facts cp-facts">
          <dt>Contact</dt>
          <dd>{c.contactName ?? <NotAdded />}</dd>
          <dt>Email</dt>
          <dd>
            {emails.length ? (
              <span className="cp-links">
                {emails.map((e) => (
                  <a key={e} href={`mailto:${e}`}>
                    {e}
                  </a>
                ))}
              </span>
            ) : (
              <NotAdded />
            )}
          </dd>
          <dt>Phone</dt>
          <dd>{c.phone ? <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a> : <NotAdded />}</dd>
          <dt>Fee</dt>
          <dd>{formatFee(c.feeAud)} a month</dd>
          <dt>Started</dt>
          <dd>{dayLabel(c.startedOn, "long")}</dd>
          <dt>Notes</dt>
          <dd className="cp-notes">{c.notes ?? <NotAdded />}</dd>
        </dl>
      </div>
    </section>
  );
}

/** Which month of the work they're in, the fee, and in the first weeks, when the refund can still be asked for. */
function MonthStat({ c, month, today }: { c: Contact; month: number; today: string }) {
  const ends = monthOneEnds(c.startedOn);
  const refund = refundUntil(c.startedOn);
  const fee = `${formatFee(c.feeAud)} a month.`;
  if (!month) {
    return <Stat label="The work" icon={ICONS.calendar} value="Not started" caption={`Starts ${dayLabel(c.startedOn)}. ${fee}`} />;
  }
  return (
    <Stat
      label="The work"
      icon={ICONS.calendar}
      value={`Month ${month}`}
      caption={
        <>
          {fee} Started {dayLabel(c.startedOn)}.
          {c.status !== "active" ? <span className="cp-cap-line">{STATUS_LABEL[c.status]}, so nothing new runs.</span> : null}
          {month === 1 ? <span className="cp-cap-line">First month ends {dayLabel(ends)}.</span> : null}
          {today <= refund ? <span className="cp-cap-line">They can ask for a refund until {dayLabel(refund)}.</span> : null}
        </>
      }
    />
  );
}

export default function ClientOverview() {
  const data = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const base = `/dash/clients/${data.shopId}`;

  // Refresh while setup or an AI check runs: every few seconds during setup, less often for a check (it takes minutes).
  const every = data.view === "setup" ? 4000 : data.view === "client" && data.checking ? 10000 : 0;
  useEffect(() => {
    if (!every) return;
    const t = setInterval(() => !document.hidden && revalidator.state === "idle" && revalidator.revalidate(), every);
    return () => clearInterval(t);
  }, [every, revalidator]);

  if (data.view === "none") {
    return (
      <>
        <PageHead title="Overview" />
        <section className="w-panel">
          <h2>This store isn’t one of your clients.</h2>
          <Link to={`/dash/clients/new?store=${encodeURIComponent(data.host)}`} className="w-btn cp-cta" prefetch="intent">
            Make them a client
          </Link>
        </section>
      </>
    );
  }

  if (data.view === "setup") {
    const at = Math.max(0, STEPS.findIndex((s) => s.key === data.onboarding));
    const pct = data.scan && data.scan.total ? Math.round((data.scan.done / data.scan.total) * 100) : 0;
    return (
      <>
        <PageHead title="Overview" intro="Their store is being set up. This takes a few minutes. You can leave this page and come back." />
        <section className="w-panel" aria-live="polite" aria-labelledby="setup-h">
          <h2 id="setup-h">Setting up {data.name}</h2>
          <ol className="w-steps">
            {STEPS.map((s, i) => (
              <li key={s.key} className={i < at ? "done" : i === at && !data.setupFailed ? "now" : undefined}>
                {s.key === "scanning" ? data.scanLabel : s.label}
              </li>
            ))}
          </ol>
          {data.onboarding === "scanning" && data.scan ? (
            <>
              <div className="w-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="AI answers read">
                <span style={{ width: `${pct}%` }} />
              </div>
              <p className="w-note">
                {data.scan.done} of {data.scan.total} AI answers read
              </p>
            </>
          ) : null}
          {data.setupFailed ? (
            <div className="w-err" role="alert" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <span>Setup stopped partway.</span>
              <ClientActionButton shopId={data.shopId} intent="retry-setup" label="Try again" className="w-btn w-btn-sm" />
            </div>
          ) : null}
        </section>
        <ClientBox base={base} c={data.contact} />
      </>
    );
  }

  const { card, contact } = data;
  const topShare = Math.max(...data.competitors.map((c) => c.share), 0.01); // the bars are against the most named brand
  const tracking = card.tracking || card.sales.orders > 0;
  const notYet = (
    <Link to={`${base}/tracking`} prefetch="intent">
      Tracking code not on yet
    </Link>
  );
  return (
    <>
      <PageHead
        title="Overview"
        right={
          <>
            {data.checking ? <span className="w-chip live">Checking AI now</span> : null}
            <ClientActionButton shopId={data.shopId} intent="check-now" label="Check AI now" />
            <ClientActionButton shopId={data.shopId} intent="report" extra={{ kind: "week" }} label="Make weekly report" />
          </>
        }
      />

      <section className="w-sec" aria-labelledby="needs-h">
        <div className="w-sec-head">
          <h2 id="needs-h">Needs you</h2>
        </div>
        <div className="w-box">
          <AlertList alerts={card.alerts.map((a) => ({ ...a, shopId: data.shopId }))} empty={EMPTY_ALERTS[contact.status]} />
        </div>
      </section>

      <div className="w-stats">
        <Stat
          hero
          label="Sales from AI"
          icon={ICONS.money}
          value={tracking ? formatMoney(card.sales.revenue, card.currency) : "–"}
          caption={
            tracking
              ? `This month: ${plural(card.sales.orders, "order", "orders")}${data.salesShare !== null ? `, ${formatPct(data.salesShare)} of all their sales` : ""}.`
              : notYet
          }
        />
        <Stat
          label="Visits from AI"
          icon={ICONS.click}
          value={tracking ? card.sales.visits.toLocaleString("en-US") : "–"}
          caption={tracking ? "This month, from links in AI answers." : notYet}
        />
        <Stat
          label="AI score"
          icon={ICONS.gauge}
          value={
            card.score !== null ? (
              <>
                {card.score}
                <small> / 100</small>
              </>
            ) : (
              "–"
            )
          }
          caption={
            card.score !== null ? (
              <span className="cp-score-cap">
                {card.scoreStart !== null ? (
                  <span>
                    <Delta value={card.score - card.scoreStart} /> since they joined
                  </span>
                ) : null}
                <Sparkline values={card.trend} />
              </span>
            ) : (
              "No AI check yet."
            )
          }
        />
        <MonthStat c={contact} month={card.month} today={data.today} />
      </div>

      <div className="w-two">
        <section className="w-sec" aria-labelledby="week-h">
          <div className="cp-head">
            <h2 id="week-h">This week</h2>
            <Link to={`${base}/log`} prefetch="intent">
              See the full work log
            </Link>
          </div>
          {data.week.length ? (
            <LogDays days={data.week} today={data.today} yesterday={data.yesterday} />
          ) : (
            <div className="w-box">
              <p className="w-empty">Nothing in the last 7 days.</p>
            </div>
          )}
        </section>

        <div className="cp-col">
          <section className="w-sec" aria-labelledby="up-h">
            <div className="cp-head">
              <h2 id="up-h">Coming up</h2>
              <Link to={`${base}/guides`} prefetch="intent">
                Guide calendar
              </Link>
            </div>
            <div className="w-box">
              {data.upcoming.length ? (
                <ul className="cp-up">
                  {data.upcoming.map((s) => (
                    <li key={s.id}>
                      <Link to={`${base}/guides/${s.id}`} className="cp-up-row" prefetch="intent">
                        <span className="cp-up-day">{s.day === data.storeToday ? "Today" : dayLabel(s.day)}</span>
                        <span className="cp-up-title">{s.title}</span>
                        <span className={`w-pill${s.tone ? ` ${s.tone}` : ""}`}>{s.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="w-empty">No guide days planned yet. Open the guide calendar to plan them.</p>
              )}
            </div>
          </section>

          <section className="w-sec" aria-labelledby="who-h">
            <div className="w-sec-head">
              <h2 id="who-h">Who AI names instead</h2>
              <p>Share of answers in the last AI check that name each brand.</p>
            </div>
            <div className="w-box">
              {data.competitors.length ? (
                <ul className="w-rank">
                  {data.competitors.map((c) => (
                    <li key={c.brand}>
                      <span>{c.brand}</span>
                      <span>{formatPct(c.share)}</span>
                      <span className="bar">
                        <span style={{ width: `${(c.share / topShare) * 100}%` }} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="w-empty">No other brand named yet.</p>
              )}
            </div>
          </section>

          <ClientBox base={base} c={contact} />
        </div>
      </div>
    </>
  );
}
