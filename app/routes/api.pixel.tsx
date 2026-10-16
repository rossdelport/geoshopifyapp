import { createHash } from "node:crypto";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import db from "../db.server";
import { env } from "../lib/env.server";
import { classifySearchVisit, classifyVisit } from "../lib/attribution";
import { clientIp } from "../lib/public-form.server";
import { recordPixelOrder } from "../lib/tracking-code.server";

// Receives one event per storefront visit (first page of each session) from our Shopify app's Web Pixel, or
// from a web app store's tracking code (a custom pixel, lib/tracking-code.server.ts), which also sends orders.
// Public endpoint: the pixel runs in shoppers' browsers. No personal data is accepted or stored.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

// At most this many events a minute from one address: a loop of forged orders or visits can't inflate a store's
// numbers. In memory, per server; enough against a script, and a restart simply starts over.
const PER_IP_PER_MINUTE = 120;
const hits = new Map<string, { n: number; until: number }>();
export function overLimit(ip: string | null, now = Date.now()): boolean {
  if (!ip) return false;
  const h = hits.get(ip);
  if (!h || h.until < now) {
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.until < now) hits.delete(k);
    hits.set(ip, { n: 1, until: now + 60_000 });
    return false;
  }
  h.n++;
  return h.n > PER_IP_PER_MINUTE;
}

/** The utm_source on a landing address, if it has one (a broken address has none). */
function utmSourceOf(landingUrl: string): string | null {
  try {
    return new URL(landingUrl, "https://x.invalid").searchParams.get("utm_source");
  } catch {
    return null;
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) =>
  new Response(null, { status: request.method === "OPTIONS" ? 204 : 405, headers: CORS });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (overLimit(clientIp(request))) return new Response(null, { status: 429, headers: CORS });
  let body: { shop?: string; k?: string; type?: string; ref?: string; url?: string; cid?: string } = {};
  try {
    body = JSON.parse((await request.text()).slice(0, 12000));
  } catch {
    return new Response(null, { status: 400, headers: CORS });
  }
  // Our Shopify app's pixel names the shop; a web app store's tracking code (custom pixel) carries its key.
  const key = typeof body.k === "string" && /^geo_[\w-]{10,60}$/.test(body.k) ? body.k : null;
  const domain = String(body.shop ?? "").toLowerCase();
  if (!key && !/^[a-z0-9-]+\.myshopify\.com$/.test(domain)) return new Response(null, { status: 400, headers: CORS });

  const shop = await db.shop.findUnique({
    where: key ? { trackKey: key } : { domain },
    select: { id: true, status: true, domain: true, pixelId: true },
  });
  if (!shop || shop.status !== "installed") return new Response(null, { status: 204, headers: CORS });
  // The first event from a store's tracking code: it's set up, so the dashboard shows the money.
  if (key && !shop.pixelId) await db.shop.update({ where: { id: shop.id }, data: { pixelId: "custom-pixel" } });
  if (key && body.type === "order") {
    await recordPixelOrder(shop.id, body);
    return new Response(null, { status: 204, headers: CORS });
  }

  const landingUrl = String(body.url ?? "").slice(0, 1000);
  const referrer = String(body.ref ?? "").slice(0, 1000);
  const visit = classifyVisit({ landingPage: landingUrl, referrerUrl: referrer }, env.utmSource);
  // Not from AI: was it from a search engine (Google, Bing and co)? Counted beside AI on the dashboard.
  const search = visit ? null : classifySearchVisit({ landingPage: landingUrl, referrerUrl: referrer });
  const today = new Date(new Date().toISOString().slice(0, 10));

  await db.trafficDay.upsert({
    where: { shopId_date: { shopId: shop.id, date: today } },
    create: { shopId: shop.id, date: today, sessions: 1, aiSessions: visit ? 1 : 0, searchSessions: search ? 1 : 0 },
    update: { sessions: { increment: 1 }, ...(visit ? { aiSessions: { increment: 1 } } : {}), ...(search ? { searchSessions: { increment: 1 } } : {}) },
  });

  if (visit) {
    const clientKey = body.cid ? createHash("sha256").update(`${shop.domain}:${body.cid}`).digest("hex").slice(0, 32) : null;
    // Keep only the page path + utm_ tags. Other query values (e.g. email tracking ids) are dropped.
    let cleanLanding = landingUrl;
    try {
      const u = new URL(landingUrl);
      const utm = [...u.searchParams].filter(([k]) => k.startsWith("utm_"));
      cleanLanding = `${u.pathname}${utm.length ? `?${new URLSearchParams(utm)}` : ""}`.slice(0, 500);
    } catch {
      /* keep as-is */
    }
    await db.aiSession
      .create({
        data: {
          shopId: shop.id,
          engine: visit.engine,
          referrer: referrer.slice(0, 300) || null,
          landingUrl: cleanLanding,
          utmSource: utmSourceOf(landingUrl),
          clientKey,
        },
      })
      .catch(() => {}); // duplicate visit from the same browser and page: ignore
  }
  return new Response(null, { status: 204, headers: CORS });
};
