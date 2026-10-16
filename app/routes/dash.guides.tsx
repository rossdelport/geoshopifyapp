import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Link, useFetcher, useLoaderData } from "react-router";
import { requireWebShop } from "../lib/web-auth.server";
import { getPlan } from "../lib/plans";
import { autofillCalendar, monthView } from "../lib/guide-calendar.server";
import { STATE_LABEL, STATE_TONE, WEEKDAYS, calendarWeeks, dayLabel, isMonth, localDay, monthLabel, monthOf, monthsApart, shiftMonth } from "../lib/guide-calendar";
import { GUIDE_KIND_LABELS, type GuideKind } from "../lib/guide";
import { formatNumber } from "../lib/format";
import { PageHead } from "../components/web";

// usegeo.app/dash/guides: the guide calendar. One guide page per day slot, each answering a buying question AI
// doesn't name the store for, written two days before its day and live on the day (lib/guide-calendar.server.ts).
// A month view like RankPill's article calendar (Ross, 2026-10-16), in GEO's style; click a day to read the page.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await requireWebShop(request);
  const plan = getPlan(shop.plan);
  const today = localDay(new Date(), shop.country);
  const asked = new URL(request.url).searchParams.get("m") ?? "";
  const month = isMonth(asked) && Math.abs(monthsApart(asked, monthOf(today))) <= 12 ? asked : monthOf(today);
  const view = plan.guidePagesPerMonth ? await monthView(shop, month) : null;
  return {
    plan: { name: plan.name, perMonth: plan.guidePagesPerMonth, doneForYou: plan.doneForYou },
    today,
    month,
    offset: monthsApart(month, monthOf(today)), // the arrows stop a year either side of today
    weeks: calendarWeeks(month),
    slots: view?.slots ?? [],
    connected: view?.connected ?? false,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await requireWebShop(request);
  const form = await request.formData();
  if (form.get("intent") === "autofill") return { ok: true as const, made: await autofillCalendar(shop.id) };
  return { ok: false as const, error: "Unknown action" };
};

const kindLabel = (kind: string | null) => (kind && kind in GUIDE_KIND_LABELS ? GUIDE_KIND_LABELS[kind as GuideKind] : "Guide page");

export default function Guides() {
  const { plan, today, month, offset, weeks, slots, connected } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const filling = fetcher.state !== "idle";
  const byDay = new Map(slots.map((s) => [s.day, s]));
  const planned = slots.filter((s) => s.state !== "failed").length;
  const thisMonth = month === monthOf(today);
  const searches = slots.reduce((n, s) => n + (s.question?.volume ?? 0), 0);

  if (!plan.perMonth) {
    return (
      <>
        <PageHead title="Guide calendar" intro="Guide pages are buying guides on your own website, one per question shoppers ask AI, so AI assistants have a page of yours to quote." />
        <section className="w-box">
          <p className="w-empty">Guide pages come with the Standard plan (4 a month, about one a week) and Done-for-you (12 a month, three a week).</p>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Guide calendar"
        intro={`One guide page per buying question AI doesn’t name you for, written two days before its day so you can read it first. ${
          plan.doneForYou ? "On Done-for-you they are written and OK’d for you." : "You OK each one, then it goes live on its day."
        }`}
        right={
          <>
            <span className="w-chip">{plan.perMonth} a month</span>
            <fetcher.Form method="post">
              <button className="w-btn w-btn-sm" type="submit" name="intent" value="autofill" disabled={filling}>
                {filling ? (
                  <>
                    <span className="w-spin" aria-hidden="true" /> Planning…
                  </>
                ) : (
                  "Autofill calendar"
                )}
              </button>
            </fetcher.Form>
          </>
        }
      />
      {fetcher.data?.ok ? (
        <p className="w-note" role="status">
          {fetcher.data.made ? `Planned ${fetcher.data.made} new ${fetcher.data.made === 1 ? "day" : "days"} for this month and next.` : "Nothing to add: this month and next are already planned."}
        </p>
      ) : null}

      <section className="w-box w-cal" aria-label={`Guide calendar, ${monthLabel(month)}`}>
        <header className="w-cal-head">
          {offset > -12 ? (
            <Link to={`?m=${shiftMonth(month, -1)}`} className="w-icon-btn" aria-label="Previous month" preventScrollReset>
              ‹
            </Link>
          ) : (
            <span className="w-icon-btn" aria-hidden="true" />
          )}
          <h2>{monthLabel(month)}</h2>
          {offset < 12 ? (
            <Link to={`?m=${shiftMonth(month, 1)}`} className="w-icon-btn" aria-label="Next month" preventScrollReset>
              ›
            </Link>
          ) : (
            <span className="w-icon-btn" aria-hidden="true" />
          )}
          <span className="w-note">
            {planned} of {plan.perMonth} planned{thisMonth ? " this month" : ""}
          </span>
        </header>

        <div className="w-cal-grid">
          {WEEKDAYS.map((d) => (
            <div key={d} className="w-cal-wd">
              {d}
            </div>
          ))}
          {weeks.flat().map((day, i) => {
            if (!day) return <div key={`e${i}`} className="w-cal-day empty" aria-hidden="true" />;
            const slot = byDay.get(day);
            const tone = slot ? STATE_TONE[slot.state] : "";
            return (
              <div key={day} className={`w-cal-day${day === today ? " today" : day < today ? " past" : ""}`}>
                <span className="w-cal-num">{Number(day.slice(8))}</span>
                {slot ? (
                  <Link to={`/dash/guides/${slot.id}`} className={`w-cal-slot${tone ? ` ${tone}` : ""}`} prefetch="intent" aria-label={`${dayLabel(day, "long")}: ${slot.title ?? slot.question?.text ?? "guide page"}, ${STATE_LABEL[slot.state]}`}>
                    <span className="w-cal-kind">
                      {kindLabel(slot.kind)}
                      {slot.question?.volume ? ` · ${formatNumber(slot.question.volume)} searches` : ""}
                    </span>
                    <span className="w-cal-q">{slot.title ?? slot.question?.text ?? "Guide page"}</span>
                    <span className={`w-pill${tone ? ` ${tone}` : ""}`}>{STATE_LABEL[slot.state]}</span>
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>

        <ul className="w-cal-list">
          {slots.length ? (
            slots.map((s) => {
              const tone = STATE_TONE[s.state];
              return (
                <li key={s.id}>
                  <Link to={`/dash/guides/${s.id}`} prefetch="intent">
                    <span className="w-cal-date">{dayLabel(s.day)}</span>
                    <span className="w-cal-q">{s.title ?? s.question?.text ?? "Guide page"}</span>
                    <span className={`w-pill${tone ? ` ${tone}` : ""}`}>{STATE_LABEL[s.state]}</span>
                  </Link>
                </li>
              );
            })
          ) : (
            <li className="w-empty">Nothing planned this month yet.</li>
          )}
        </ul>
      </section>

      <div className="w-two">
        <section className="w-box w-box-pad w-sec">
          <div className="w-sec-head">
            <h2>How a page gets onto your site</h2>
          </div>
          {connected ? (
            <p>Your store is connected to Shopify, so each guide goes live by itself on its day, as a page on your Online Store.</p>
          ) : (
            <p>
              On its day, a guide shows two-minute steps: copy the title, copy the content, paste them into Shopify’s “Add page” screen and click “I’ve added it”. One-click
              publishing is coming.
            </p>
          )}
          <p className="w-note">Every guide links to your own products with tracking, so sales from it show up on your dashboard.</p>
        </section>
        <section className="w-box w-box-pad w-sec">
          <div className="w-sec-head">
            <h2>What each guide is</h2>
          </div>
          <p>
            A buying guide in question-and-answer form, built around one question shoppers ask AI: a short answer, four to six answered questions and the products of yours
            that fit. The kind rotates: how to choose, comparison, use case, buying advice, one question in depth.
          </p>
          <p className="w-note">
            Each guide is planned from your <Link to="/dash/questions">buying questions</Link>, starting with the ones AI never names you for. Searches a month shows how many
            people ask it.
          </p>
          {searches ? <p className="w-note">The questions planned this month are asked about {formatNumber(searches)} times a month between them.</p> : null}
        </section>
      </div>
    </>
  );
}
