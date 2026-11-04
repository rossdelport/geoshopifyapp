import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, redirect, useActionData, useLoaderData, useNavigation, useRevalidator } from "react-router";
import { createReports, getReportItem } from "../lib/store-report.server";
import { clientIp, fromAnotherSite } from "../lib/public-form.server";
import webStyles from "../styles/web.css?url";
import styles from "../styles/report-maker.css?url";

// firstpicked.com.au/report-maker (Ross, 4 Nov 2026: "go to that on my phone, type in a store and it will run the entire
// thing and i can record it"). No sign-in, no key. Type a store's website, the report runs (about 3 minutes),
// then the report itself opens, ready to film. Same createReports and 40-a-day cap as Admin > Reports. The page
// only ever shows the report it started (followed by its id in the address), never anyone else's, and never the
// script (that stays in Admin > Reports).

// Reports per IP in the last day, kept in memory (a deploy starts again). Enough for Ross's 3 videos a day,
// and stops one stranger using up the day's 40.
const recent = new Map<string, number[]>();
const MAX_PER_IP = 10;
const DAY = 24 * 60 * 60 * 1000;

function tooManyFrom(ip: string | null): boolean {
  if (!ip) return false;
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((t) => now - t < DAY);
  if (times.length >= MAX_PER_IP) return true;
  recent.set(ip, [...times, now]);
  if (recent.size > 5000) recent.clear(); // never grows without end
  return false;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return { report: null, missing: false };
  const r = await getReportItem(id);
  if (!r) return { report: null, missing: true };
  // Only what the page needs: no tags, notes or script.
  return {
    report: { host: r.host, brand: r.brand, status: r.status, done: r.done, total: r.total, error: r.error, slug: r.slug },
    missing: false,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (fromAnotherSite(request)) return { error: "Please make reports from firstpicked.com.au/report-maker." };
  const form = await request.formData();
  // One store at a time: the first address typed.
  const store = String(form.get("store") ?? "").trim().split(/[\s,;]+/)[0] ?? "";
  if (!store) return { error: "Type a store's website, like bondiwash.com." };
  if (tooManyFrom(clientIp(request))) return { error: "That's a lot of reports today. Please try again tomorrow." };
  try {
    const result = await createReports(store, "report maker");
    if (!result.ok) return { error: result.error };
    if (!result.ids[0]) return { error: "That doesn't look like a store's website. Try one like bondiwash.com." };
    return redirect(`/report-maker?id=${result.ids[0]}`);
  } catch (err) {
    console.error("[report maker] couldn't start a report:", err);
    return { error: "Something went wrong starting the report. Please try again." };
  }
};

export const headers: HeadersFunction = () => new Headers({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });

export const meta: MetaFunction = () => [{ title: "Report maker | GEO" }, { name: "robots", content: "noindex" }];

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: webStyles },
  { rel: "stylesheet", href: styles },
];

type Report = NonNullable<Awaited<ReturnType<typeof loader>>["report"]>;

const running = (r: Report) => r.status !== "done" && r.status !== "failed";

function Progress({ r }: { r: Report }) {
  const text =
    r.status === "reading" ? "Reading the store" : r.status === "asking" ? `Asking AI: ${r.done} of ${r.total}` : r.status === "writing" ? "Writing the plan" : "Starting";
  // Rough share of the work: reading 5%, asking AI up to 85%, writing 92%.
  const share = r.status === "reading" ? 5 : r.status === "asking" ? 5 + Math.round((80 * r.done) / Math.max(1, r.total)) : r.status === "writing" ? 92 : 2;
  return (
    <>
      <span className="w-dot">{text}</span>
      <div className="rm-bar" aria-hidden="true">
        <i style={{ transform: `scaleX(${share / 100})` }} />
      </div>
      <p className="w-note">About 3 minutes. Keep this page open: the report opens by itself when it&apos;s ready.</p>
    </>
  );
}

function StoreForm({ value }: { value?: string }) {
  const busy = useNavigation().state !== "idle";
  const error = useActionData<typeof action>()?.error;
  return (
    <Form method="post" className="rm-form">
      <label htmlFor="rm-store">Store website</label>
      <input
        id="rm-store"
        name="store"
        className="w-input"
        type="text"
        inputMode="url"
        placeholder="bondiwash.com"
        defaultValue={value}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        required
      />
      <button className="w-btn" type="submit" disabled={busy}>
        {busy ? (
          <>
            <span className="w-spin" aria-hidden="true" /> Starting…
          </>
        ) : value ? (
          "Try again"
        ) : (
          "Make report"
        )}
      </button>
      {error ? (
        <p className="w-err" aria-live="polite">
          {error}
        </p>
      ) : null}
    </Form>
  );
}

export default function ReportMaker() {
  const { report: r, missing } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const working = !!r && running(r);
  const ready = r?.status === "done" && r.slug ? `/report/${r.slug}` : null;

  // Fresh progress every 4 seconds while the report is being made.
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => revalidator.state === "idle" && revalidator.revalidate(), 4000);
    return () => clearInterval(t);
  }, [working, revalidator]);

  // Ready: open the report itself, ready to film. Back goes to an empty report maker.
  useEffect(() => {
    if (ready) window.location.replace(ready);
  }, [ready]);

  return (
    <main className="w rm">
      <header className="rm-head">
        <span className="rm-mark" aria-hidden="true">
          <i />
          <i />
        </span>
        <span>GEO</span>
        <em>Report maker</em>
      </header>

      {!r ? (
        <>
          <StoreForm />
          {missing ? <p className="w-note rm-empty">We couldn&apos;t find that report. Type the store again to make a new one.</p> : null}
        </>
      ) : (
        <section className="rm-card" aria-live="polite">
          <div className="rm-top">
            <div className="rm-name">
              <b>{r.brand || r.host}</b>
              {r.brand ? <span>{r.host}</span> : null}
            </div>
            {r.status === "done" ? <span className="w-dot ok">Ready</span> : r.status === "failed" ? <span className="w-dot no">Failed</span> : null}
          </div>
          {working ? <Progress r={r} /> : null}
          {ready ? (
            <a className="w-btn" href={ready}>
              Open report
            </a>
          ) : null}
          {r.status === "failed" ? (
            <>
              <p className="w-note">{r.error || "Please run it again."}</p>
              <StoreForm value={r.host} />
            </>
          ) : null}
          <a className="rm-another" href="/report-maker">
            Make another report
          </a>
        </section>
      )}
    </main>
  );
}
