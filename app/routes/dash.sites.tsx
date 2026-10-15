import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import db from "../db.server";
import { requireWebShop } from "../lib/web-auth.server";
import { getPlan, ENGINE_LABELS, type Engine } from "../lib/plans";
import { outreachUsedThisMonth } from "../lib/outreach.server";
import { PITCHABLE, findWriter, pitchSite, trustedSites, writersUsedThisMonth } from "../lib/trusted-sites.server";
import { formatPct } from "../lib/format";
import { CopyButton, ICONS, PageHead, Stat } from "../components/web";

// usegeo.app/dash/sites: Sites AI trusts. The websites AI cites most for the store's buying questions, over every
// scan since it joined, with the writer behind each one and a pitch to send (or, on Done-for-you, that we send).

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await requireWebShop(request);
  const plan = getPlan(shop.plan);
  const [sites, writers, targets, writersUsed, pitchesUsed] = await Promise.all([
    trustedSites(shop.id, 40),
    db.siteWriter.findMany({ where: { shopId: shop.id } }),
    db.outreachTarget.findMany({ where: { shopId: shop.id, pitch: { not: null } }, select: { domain: true, url: true, subject: true, pitch: true, email: true } }),
    writersUsedThisMonth(shop.id),
    outreachUsedThisMonth(shop.id),
  ]);
  return {
    plan: { name: plan.name, writers: plan.writersPerMonth, pitches: plan.outreachPerMonth, doneForYou: plan.doneForYou },
    writersUsed,
    pitchesUsed,
    sites: sites.map((s) => {
      const w = writers.find((x) => x.domain === s.domain);
      const t = targets.find((x) => x.url === s.page.url);
      return {
        ...s,
        lastSeen: s.lastSeen.toISOString(),
        pitchable: PITCHABLE.includes(s.kind),
        writer: w ? { found: w.found, name: w.name, position: w.position, company: w.company, email: w.email, linkedin: w.linkedin, twitter: w.twitter } : null,
        pitch: t ? { subject: t.subject ?? "", body: t.pitch ?? "", email: t.email } : null,
      };
    }),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await requireWebShop(request);
  const form = await request.formData();
  const domain = String(form.get("domain") ?? "").slice(0, 200);
  const intent = form.get("intent");
  if (intent === "writer") return findWriter(shop.id, domain);
  if (intent === "pitch") return pitchSite(shop.id, domain);
  return { ok: false as const, error: "Unknown action" };
};

type Site = ReturnType<typeof useLoaderData<typeof loader>>["sites"][number];

const NEXT_STEP: Record<string, string> = {
  forum: "A forum or Reddit thread. Join the conversation as yourself and say who you are. The Reddit threads page lists posts worth a reply.",
  qa: "A question and answer site. Answer as yourself and say who you are.",
  directory: "A directory or review site. Get listed or claim your free profile. Never write reviews yourself.",
  retailer: "A shop or marketplace. Ask them to stock your products, or list them there.",
  other: "A brand or social page. There’s no honest pitch to send here.",
};

function SiteRow({ site, rank, writersLeft, pitchesLeft, doneForYou, paid }: { site: Site; rank: number; writersLeft: number; pitchesLeft: number; doneForYou: boolean; paid: boolean }) {
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  const intent = fetcher.formData?.get("intent");
  const error = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  const w = site.writer;
  const send = (i: "writer" | "pitch") => fetcher.submit({ intent: i, domain: site.domain }, { method: "post" });

  return (
    <li className="w-site">
      <div className="w-site-main">
        <div className="w-site-top">
          <span className="w-site-rank">{rank}</span>
          <div>
            <b className="w-site-domain">{site.domain}</b>
            <a className="w-site-page" href={site.page.url} target="_blank" rel="noreferrer">
              {site.page.title || site.page.url}
            </a>
          </div>
        </div>
        <div className="w-site-facts">
          <span className="w-pill">Used in {site.answers} AI {site.answers === 1 ? "answer" : "answers"}</span>
          <span className={`w-pill ${site.namedShare >= 0.5 ? "ok" : site.namedShare > 0 ? "warn" : "no"}`}>
            {site.namedShare > 0 ? `Names you in ${formatPct(site.namedShare)}` : "Doesn’t name you"}
          </span>
          <span className="w-note">{site.engines.map((e) => ENGINE_LABELS[e as Engine] ?? e).join(", ")}</span>
        </div>
        {site.rivals.length ? <p className="w-note">AI names here instead: {site.rivals.join(", ")}</p> : null}
      </div>

      <div className="w-site-act">
        {!site.pitchable ? (
          <p className="w-note">{NEXT_STEP[site.kind] ?? NEXT_STEP.other}</p>
        ) : !paid ? (
          <p className="w-note">Finding the writer and a pitch come with a paid plan.</p>
        ) : (
          <>
            {w ? (
              w.found ? (
                <div className="w-writer">
                  <b>{w.name ?? "Writer found"}</b>
                  {w.position || w.company ? <span className="w-note">{[w.position, w.company].filter(Boolean).join(", ")}</span> : null}
                  {w.email ? (
                    <span className="w-writer-email">
                      {w.email} <CopyButton text={w.email} />
                    </span>
                  ) : (
                    <span className="w-note">No email found. Try their contact page.</span>
                  )}
                  <span className="w-writer-links">
                    {w.linkedin ? (
                      <a href={w.linkedin} target="_blank" rel="noreferrer">
                        LinkedIn
                      </a>
                    ) : null}
                    {w.twitter ? (
                      <a href={w.twitter} target="_blank" rel="noreferrer">
                        X
                      </a>
                    ) : null}
                  </span>
                </div>
              ) : (
                <p className="w-note">We couldn’t find the writer. Look for a contact page on the site.</p>
              )
            ) : (
              <button className="w-btn w-btn-sm" type="button" disabled={busy || writersLeft <= 0} onClick={() => send("writer")}>
                {busy && intent === "writer" ? (
                  <>
                    <span className="w-spin" aria-hidden="true" /> Looking…
                  </>
                ) : (
                  "Find the writer"
                )}
              </button>
            )}

            {site.pitch ? (
              <details className="w-pitch">
                <summary>{doneForYou ? "Pitch ready: our team sends it and follows up" : "See your pitch"}</summary>
                <p>
                  <b>Subject:</b> {site.pitch.subject}
                </p>
                <pre>{site.pitch.body}</pre>
                <div className="w-pitch-btns">
                  <CopyButton text={`${site.pitch.subject}\n\n${site.pitch.body}`} label="Copy pitch" />
                  {site.pitch.email && !doneForYou ? (
                    <a
                      className="w-btn w-btn-sm"
                      href={`mailto:${site.pitch.email}?subject=${encodeURIComponent(site.pitch.subject)}&body=${encodeURIComponent(site.pitch.body)}`}
                    >
                      Open in email
                    </a>
                  ) : null}
                </div>
              </details>
            ) : w ? (
              <button className="w-btn w-btn-ghost w-btn-sm" type="button" disabled={busy || pitchesLeft <= 0} onClick={() => send("pitch")}>
                {busy && intent === "pitch" ? (
                  <>
                    <span className="w-spin" aria-hidden="true" /> Writing…
                  </>
                ) : (
                  "Write a pitch"
                )}
              </button>
            ) : null}
          </>
        )}
        {error ? (
          <p className="w-err" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export default function Sites() {
  const { plan, sites, writersUsed, pitchesUsed } = useLoaderData<typeof loader>();
  const paid = plan.writers > 0;
  return (
    <>
      <PageHead
        title="Sites AI trusts"
        intro="The websites ChatGPT and the other AI assistants read most when they answer your buying questions, counted over every check since you joined. Get mentioned on these and AI is more likely to recommend you."
        right={
          paid ? (
            <>
              <span className="w-chip">
                {writersUsed}/{plan.writers} writers this month
              </span>
              <span className="w-chip">
                {pitchesUsed}/{plan.pitches} pitches this month
              </span>
            </>
          ) : null
        }
      />

      {paid ? (
        <div className="w-stats">
          <Stat label="Sites found" icon={ICONS.shield} value={sites.length} caption="Websites AI used in its answers to your questions" />
          <Stat
            label="Name you"
            icon={ICONS.gauge}
            value={sites.filter((s) => s.namedShare > 0).length}
            caption="Of those, sites whose answers also named you"
          />
          <Stat label="Writers found" icon={ICONS.user} value={writersUsed} caption={`Of ${plan.writers} this month: name, role, email and LinkedIn`} />
          <Stat
            label="Pitches"
            icon={ICONS.send}
            value={pitchesUsed}
            caption={plan.doneForYou ? `Of ${plan.pitches} this month. We send them and follow up.` : `Of ${plan.pitches} this month. Short, honest emails from you.`}
          />
        </div>
      ) : null}

      <section className="w-box w-box-pad">
        {sites.length ? (
          <ol className="w-sites">
            {sites.map((s, i) => (
              <SiteRow
                key={s.domain}
                site={s}
                rank={i + 1}
                paid={paid}
                writersLeft={plan.writers - writersUsed}
                pitchesLeft={plan.pitches - pitchesUsed}
                doneForYou={plan.doneForYou}
              />
            ))}
          </ol>
        ) : (
          <p className="w-empty">Once we’ve asked AI your buying questions, the sites it reads will show up here.</p>
        )}
      </section>
    </>
  );
}
