// Sites AI trusts (the moat, Ross 2026-10-14): the websites AI cites most when it answers the store's buying
// questions, counted over every scan since the store joined (not just the latest). For each site: how many AI
// answers used it, on which assistants, how often those answers named the store, the rivals named next to it,
// and its most-used page. Then, within the plan's monthly allowances: look up the writer behind that page
// (Standard 10, Done-for-you 50) and draft an honest pitch to them (Standard 10, Done-for-you 40). On
// Done-for-you our team sends the pitch and follows up.

import { Prisma } from "@prisma/client";
import db from "../db.server";
import { getPlan } from "./plans";
import { startOfMonth } from "./limits";
import { findAuthor } from "./treg.server";
import { outreachKind, type OutreachKind } from "./sources";
import { draftPitch, outreachUsedThisMonth } from "./outreach.server";
import { enqueue, registerJob } from "./jobs.server";
import { emailConfigured, sendEmail } from "./email.server";
import { env } from "./env.server";

export interface TrustedSite {
  domain: string;
  answers: number; // AI answers that cited the site, all time
  engines: string[];
  namedShare: number; // of those answers, the share that named the store (0-1)
  rivals: string[]; // brands most often named in those answers
  page: { url: string; title: string | null };
  kind: OutreachKind; // what an honest next step looks like
  lastSeen: Date;
}

/** The most-cited sites for a store over all its scans, best first. The store's own site is left out. */
export async function trustedSites(shopId: string, limit = 40): Promise<TrustedSite[]> {
  const rows = await db.$queryRaw<{ domain: string; answers: number; named: number; engines: string[]; last_seen: Date }[]>`
    SELECT c.domain,
           COUNT(DISTINCT c."answerId")::int AS answers,
           COUNT(DISTINCT c."answerId") FILTER (WHERE a.mentioned)::int AS named,
           array_agg(DISTINCT a.engine) AS engines,
           MAX(s."startedAt") AS last_seen
    FROM "Citation" c
    JOIN "AiAnswer" a ON a.id = c."answerId"
    JOIN "Scan" s ON s.id = a."scanId"
    WHERE s."shopId" = ${shopId} AND c."isOwn" = false AND c.domain <> ''
    GROUP BY c.domain
    ORDER BY answers DESC, last_seen DESC
    LIMIT ${limit}`;
  if (!rows.length) return [];
  const domains = rows.map((r) => r.domain);

  // Each site's most-cited page (with its type, for the kind of next step).
  const pages = await db.$queryRaw<{ domain: string; url: string; title: string | null; type: string; n: number }[]>`
    SELECT DISTINCT ON (c.domain) c.domain, c.url, MAX(c.title) AS title, MAX(c.type) AS type, COUNT(*)::int AS n
    FROM "Citation" c
    JOIN "AiAnswer" a ON a.id = c."answerId"
    JOIN "Scan" s ON s.id = a."scanId"
    WHERE s."shopId" = ${shopId} AND c.domain IN (${Prisma.join(domains)})
    GROUP BY c.domain, c.url
    ORDER BY c.domain, n DESC, c.url`;

  // The rival brands named in the answers that used each site.
  const rivals = await db.$queryRaw<{ domain: string; brand: string; n: number }[]>`
    SELECT c.domain, m.brand, COUNT(DISTINCT m."answerId")::int AS n
    FROM "Citation" c
    JOIN "AiAnswer" a ON a.id = c."answerId"
    JOIN "Scan" s ON s.id = a."scanId"
    JOIN "Mention" m ON m."answerId" = a.id AND m."isMerchant" = false
    WHERE s."shopId" = ${shopId} AND c.domain IN (${Prisma.join(domains)})
    GROUP BY c.domain, m.brand
    ORDER BY c.domain, n DESC, m.brand`;
  const hidden = new Set(
    (await db.competitor.findMany({ where: { shopId, hidden: true }, select: { name: true } })).map((c) => c.name.toLowerCase()),
  );

  return rows.map((r) => {
    const page = pages.find((p) => p.domain === r.domain);
    return {
      domain: r.domain,
      answers: r.answers,
      engines: [...r.engines].sort(),
      namedShare: r.answers ? r.named / r.answers : 0,
      rivals: rivals
        .filter((x) => x.domain === r.domain && !hidden.has(x.brand.toLowerCase()))
        .slice(0, 3)
        .map((x) => x.brand),
      page: { url: page?.url ?? `https://${r.domain}/`, title: page?.title ?? null },
      kind: outreachKind(page?.url ?? `https://${r.domain}/`, r.domain, page?.type),
      lastSeen: r.last_seen,
    };
  });
}

/** Writers looked up this month (found or not: each lookup costs). */
export function writersUsedThisMonth(shopId: string, now = new Date()): Promise<number> {
  return db.siteWriter.count({ where: { shopId, createdAt: { gte: startOfMonth(now) } } });
}

export const SITE_ERRORS = {
  plan: "Finding writers comes with a paid plan.",
  writersUsed: "You’ve used this month’s writer lookups. More arrive on the 1st.",
  pitchesUsed: "You’ve used this month’s pitches. More arrive on the 1st.",
  notCited: "We couldn’t find that site in your AI answers.",
  noPitch: "There’s no email to write for this kind of site.",
};

/** Kinds of site that have a person to write to. */
export const PITCHABLE: OutreachKind[] = ["article", "video"];

/** Look up the writer behind a site's most-cited page. Once per site; counts against the monthly allowance. */
export async function findWriter(shopId: string, domain: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
  const plan = getPlan(shop.plan);
  if (!plan.writersPerMonth) return { ok: false, error: SITE_ERRORS.plan };
  if (await db.siteWriter.findUnique({ where: { shopId_domain: { shopId, domain } } })) return { ok: true };
  if ((await writersUsedThisMonth(shopId)) >= plan.writersPerMonth) return { ok: false, error: SITE_ERRORS.writersUsed };
  const site = (await trustedSites(shopId, 200)).find((s) => s.domain === domain);
  if (!site) return { ok: false, error: SITE_ERRORS.notCited };

  const a = await findAuthor(site.page.url, shopId);
  const found = Boolean(a.email || a.name || a.linkedin);
  try {
    await db.siteWriter.create({
      data: { shopId, domain, pageUrl: site.page.url, pageTitle: site.page.title, found, ...a },
    });
  } catch {
    // Two clicks at once: the other one saved it.
  }
  return { ok: true };
}

/**
 * Draft a pitch to a site's writer: saved as an outreach target (so it counts against the plan's monthly
 * pitches, like the Outreach screen) and written by the pitch writer. Done-for-you: our team is told to send it.
 */
export async function pitchSite(shopId: string, domain: string): Promise<{ ok: true; targetId: string } | { ok: false; error: string }> {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
  const plan = getPlan(shop.plan);
  if (!plan.writersPerMonth) return { ok: false, error: SITE_ERRORS.plan };
  const site = (await trustedSites(shopId, 200)).find((s) => s.domain === domain);
  if (!site) return { ok: false, error: SITE_ERRORS.notCited };
  if (!PITCHABLE.includes(site.kind)) return { ok: false, error: SITE_ERRORS.noPitch };

  const existing = await db.outreachTarget.findUnique({ where: { shopId_url: { shopId, url: site.page.url } } });
  if (existing?.pitch) return { ok: true, targetId: existing.id };
  if (!existing && (await outreachUsedThisMonth(shopId)) >= plan.outreachPerMonth) return { ok: false, error: SITE_ERRORS.pitchesUsed };

  const writer = await db.siteWriter.findUnique({ where: { shopId_domain: { shopId, domain } } });
  const target =
    existing ??
    (await db.outreachTarget.create({
      data: {
        shopId,
        url: site.page.url,
        domain,
        title: site.page.title,
        namedBrands: site.rivals,
        timesCited: site.answers,
        engines: site.engines,
        kind: site.kind,
        authorName: writer?.name ?? null,
        email: writer?.email ?? null,
      },
    }));
  await draftPitch(target.id);
  if (plan.doneForYou && env.alertEmail && emailConfigured()) {
    await enqueue("founder.pitch", { targetId: target.id }, { shopId, dedupeKey: `founder-pitch:${target.id}` });
  }
  return { ok: true, targetId: target.id };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Done-for-you: tell our team a pitch is ready to send by hand (and follow up). */
registerJob("founder.pitch", async (job) => {
  const id = String((job.payload as { targetId?: string }).targetId ?? "");
  const t = await db.outreachTarget.findUnique({ where: { id }, include: { shop: true } });
  if (!t || !t.pitch) return;
  if (!env.alertEmail || !emailConfigured()) throw new Error("GEO_ALERT_EMAIL or email is not set up");
  const store = t.shop.name || t.shop.primaryDomain || t.shop.domain;
  await sendEmail(
    [env.alertEmail],
    `Done-for-you pitch to send: ${store} → ${t.domain}`,
    `<p><b>Store:</b> ${esc(store)}<br><b>Page:</b> <a href="${esc(t.url)}">${esc(t.title ?? t.url)}</a><br>` +
      `<b>Writer:</b> ${esc(t.authorName ?? "unknown")}${t.email ? ` (${esc(t.email)})` : ""}</p>` +
      `<p><b>Subject:</b> ${esc(t.subject ?? "")}</p><pre style="white-space:pre-wrap;font:inherit">${esc(t.pitch)}</pre>` +
      `<p>Send it from the store's side, then follow up once after a week if there's no reply.</p>`,
  );
});
