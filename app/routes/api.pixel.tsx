import { createHash } from "node:crypto";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import db from "../db.server";
import { env } from "../lib/env.server";
import { classifyVisit } from "../lib/attribution";

// Receives one event per storefront visit from our Web Pixel (first page of each session).
// Public endpoint: the pixel runs in shoppers' browsers. No personal data is accepted or stored.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const loader = async ({ request }: LoaderFunctionArgs) =>
  new Response(null, { status: request.method === "OPTIONS" ? 204 : 405, headers: CORS });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  let body: { shop?: string; ref?: string; url?: string; cid?: string } = {};
  try {
    body = JSON.parse((await request.text()).slice(0, 4000));
  } catch {
    return new Response(null, { status: 400, headers: CORS });
  }
  const domain = String(body.shop ?? "").toLowerCase();
  if (!/^[a-z0-9-]+\.myshopify\.com$/.test(domain)) return new Response(null, { status: 400, headers: CORS });

  const shop = await db.shop.findUnique({ where: { domain }, select: { id: true, status: true } });
  if (!shop || shop.status !== "installed") return new Response(null, { status: 204, headers: CORS });

  const landingUrl = String(body.url ?? "").slice(0, 1000);
  const referrer = String(body.ref ?? "").slice(0, 1000);
  const visit = classifyVisit({ landingPage: landingUrl, referrerUrl: referrer }, env.utmSource);
  const today = new Date(new Date().toISOString().slice(0, 10));

  await db.trafficDay.upsert({
    where: { shopId_date: { shopId: shop.id, date: today } },
    create: { shopId: shop.id, date: today, sessions: 1, aiSessions: visit ? 1 : 0 },
    update: { sessions: { increment: 1 }, ...(visit ? { aiSessions: { increment: 1 } } : {}) },
  });

  if (visit) {
    const clientKey = body.cid ? createHash("sha256").update(`${domain}:${body.cid}`).digest("hex").slice(0, 32) : null;
    // Keep only the page path + query (no fragments), never personal data.
    let cleanLanding = landingUrl;
    try {
      const u = new URL(landingUrl);
      cleanLanding = `${u.pathname}${u.search}`.slice(0, 500);
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
          utmSource: new URL(landingUrl, "https://x.invalid").searchParams.get("utm_source"),
          clientKey,
        },
      })
      .catch(() => {}); // duplicate visit from the same browser and page: ignore
  }
  return new Response(null, { status: 204, headers: CORS });
};
