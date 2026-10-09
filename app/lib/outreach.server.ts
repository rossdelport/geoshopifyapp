// Outreach: find articles AI assistants trust that name competitors but not the store,
// find who to contact, and draft an honest, short pitch the merchant sends themselves.

import { z } from "zod";
import db from "../db.server";
import { askJson } from "./ai.server";
import { findAuthorEmail } from "./treg.server";
import { cleanUrl, domainOf } from "./answers";
import { brandKey, sameBrand } from "./match";
import { getPlan } from "./plans";
import { remainingOutreach } from "./limits";
import { getUsageFor } from "./usage.server";
import { registerJob } from "./jobs.server";
import { trackedProductUrl } from "./fixes.server";
import { countryName } from "./onboarding.server";

interface Candidate {
  url: string;
  domain: string;
  title: string | null;
  cited: number;
  engines: Set<string>;
  brands: Set<string>;
  merchantNamed: number;
}

export async function findCandidates(shopId: string): Promise<Candidate[]> {
  const scans = await db.scan.findMany({
    where: { shopId, status: "done" },
    orderBy: { startedAt: "desc" },
    take: 3,
    select: { id: true },
  });
  if (!scans.length) return [];
  const answers = await db.aiAnswer.findMany({
    where: { scanId: { in: scans.map((s) => s.id) }, status: "parsed" },
    include: {
      citations: { where: { type: "editorial", isOwn: false } },
      mentions: { where: { isMerchant: false } },
    },
  });
  const competitors = await db.competitor.findMany({ where: { shopId } });
  const competitorKeys = competitors.map((c) => brandKey(c.name)).filter((k) => k.length >= 4);

  const byUrl = new Map<string, Candidate>();
  for (const a of answers) {
    for (const c of a.citations) {
      // Skip a competitor's own blog: they won't feature us.
      const flatDomain = c.domain.replace(/[^a-z0-9]/g, "");
      if (competitorKeys.some((k) => flatDomain.includes(k))) continue;
      const url = cleanUrl(c.url);
      const cand = byUrl.get(url) ?? {
        url,
        domain: c.domain,
        title: c.title,
        cited: 0,
        engines: new Set<string>(),
        brands: new Set<string>(),
        merchantNamed: 0,
      };
      cand.cited++;
      cand.engines.add(a.engine);
      for (const m of a.mentions) cand.brands.add(m.brand);
      if (a.mentioned) cand.merchantNamed++;
      byUrl.set(url, cand);
    }
  }
  return [...byUrl.values()]
    .filter((c) => c.merchantNamed < c.cited) // pages where we are often missing
    .sort((a, b) => b.cited * 2 + b.brands.size - b.merchantNamed * 3 - (a.cited * 2 + a.brands.size - a.merchantNamed * 3));
}

const IS_EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const JUNK_EMAIL = /example|sentry|wixpress|noreply|no-reply|@2x|\.png|\.jpg/i;

/** Free first: read the article for an author name, a mailto link or a contact page. */
export async function findContact(url: string, shopId: string, allowPaidLookup: boolean) {
  let name: string | null = null;
  let email: string | null = null;
  let contactUrl: string | null = null;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; GEO-app/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const html = (await res.text()).slice(0, 600_000);
      name =
        html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']{3,60})/i)?.[1] ??
        html.match(/"author"\s*:\s*(?:\[\s*)?\{[^}]*"name"\s*:\s*"([^"]{3,60})"/i)?.[1] ??
        null;
      const mailtos = [...html.matchAll(/mailto:([^"'?>\s]+)/gi)].map((m) => decodeURIComponent(m[1]));
      const site = domainOf(url);
      const good = mailtos.filter((e) => IS_EMAIL.test(e) && !JUNK_EMAIL.test(e));
      const siteRoot = site.split(".").slice(-2).join(".");
      email = good.find((e) => e.toLowerCase().endsWith(siteRoot)) ?? good[0] ?? null;
      const contactHref = html.match(/href=["']([^"']*(contact|write-for-us|advertis|work-with-us)[^"']*)["']/i)?.[1];
      if (contactHref) contactUrl = new URL(contactHref, url).toString();
    }
  } catch {
    /* page blocked or slow: fall through */
  }
  if (!email && allowPaidLookup) {
    const found = await findAuthorEmail(url, shopId);
    email = found.email;
    name = name ?? found.name;
  }
  if (!contactUrl) contactUrl = `https://${domainOf(url)}/contact`;
  return { name, email, contactUrl };
}

const PitchSchema = z.object({
  subject: z.string().describe("Under 60 characters, specific to their article"),
  body: z.string().describe("Plain text email, 90-140 words, signed '[Your name]'"),
  product_index: z.number().int().describe("Which product to suggest, from the list"),
});

export async function draftPitch(targetId: string) {
  const target = await db.outreachTarget.findUniqueOrThrow({ where: { id: targetId }, include: { shop: { include: { profile: true } } } });
  const shop = target.shop;
  const products = await db.product.findMany({ where: { shopId: shop.id, status: "ACTIVE" }, take: 12 });
  const campaign = target.domain.replace(/\./g, "-");
  const links = products.map((p) => trackedProductUrl(shop, p.handle, "outreach", campaign));

  const pitch = await askJson({
    schema: PitchSchema,
    tier: "smart",
    label: "outreach-pitch",
    shopId: shop.id,
    maxTokens: 3000,
    system:
      "You write short, honest emails from a small store owner to the editor of an article, asking to be considered for it. Be warm and specific to their article. Never flatter falsely, never claim awards, reviews or facts that aren't given, never offer payment for a link, never pretend to be a customer. Include one product link exactly as given. Offer a free sample only as a question.",
    prompt: `Article: ${target.title ?? "(no title)"} — ${target.url}
Brands the article (or AI answers citing it) already feature: ${(target.namedBrands as string[]).slice(0, 6).join(", ") || "unknown"}
Author name: ${target.authorName ?? "unknown (use 'Hi there')"}

Our store: ${shop.profile?.brandName ?? shop.name} (${countryName(shop.country)})
About us: ${shop.profile?.summary ?? ""}

Our products (index. title | link | details):
${products.map((p, i) => `${i}. ${p.title} | ${links[i]} | ${(p.description ?? "").slice(0, 160)}`).join("\n")}

Write the email.`,
  });

  return db.outreachTarget.update({
    where: { id: targetId },
    data: { subject: pitch.subject, pitch: pitch.body, status: target.status === "new" ? "drafted" : target.status },
  });
}

export async function findOutreachTargets(shopId: string) {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
  const plan = getPlan(shop.plan);
  const budget = Math.min(remainingOutreach(plan, await getUsageFor(shopId)), 10);
  if (budget <= 0) return 0;

  const existing = await db.outreachTarget.findMany({ where: { shopId }, select: { url: true } });
  const known = new Set(existing.map((e) => e.url));
  const candidates = (await findCandidates(shopId)).filter((c) => !known.has(c.url)).slice(0, budget);

  let made = 0;
  for (const [i, c] of candidates.entries()) {
    const contact = await findContact(c.url, shopId, i < 3);
    const brands = [...c.brands].filter((b, idx, all) => all.findIndex((x) => sameBrand(x, b)) === idx);
    const target = await db.outreachTarget.create({
      data: {
        shopId,
        url: c.url,
        domain: c.domain,
        title: c.title,
        namedBrands: brands.slice(0, 10),
        timesCited: c.cited,
        engines: [...c.engines],
        authorName: contact.name,
        email: contact.email,
        contactUrl: contact.contactUrl,
      },
    });
    await draftPitch(target.id).catch((err) => console.error(`[outreach] pitch failed: ${err.message}`));
    made++;
  }
  return made;
}

registerJob("outreach.find", async (job) => {
  const n = await findOutreachTargets(job.shopId!);
  console.log(`[outreach] ${n} new targets for shop ${job.shopId}`);
});
